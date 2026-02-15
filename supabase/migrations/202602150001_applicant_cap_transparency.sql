alter table public.internships
  add column if not exists application_cap integer not null default 60,
  add column if not exists applications_count integer not null default 0;

alter table public.applications
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists employer_viewed_at timestamptz;

update public.applications
set submitted_at = coalesce(submitted_at, created_at, now())
where submitted_at is null;

alter table public.applications
  alter column status set default 'submitted';

update public.applications
set status = 'submitted'
where status is null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'applications_status_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications drop constraint applications_status_check;
  end if;

  alter table public.applications
    add constraint applications_status_check
    check (status in ('submitted', 'reviewing', 'interview', 'rejected', 'accepted', 'withdrawn'));
end
$$;

create index if not exists applications_internship_status_submitted_at_idx
  on public.applications(internship_id, status, submitted_at desc);

create index if not exists applications_student_submitted_at_idx
  on public.applications(student_id, submitted_at desc);

create index if not exists applications_internship_employer_viewed_at_idx
  on public.applications(internship_id, employer_viewed_at);

create or replace function public.recompute_internship_applications_count(p_internship_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_internship_id is null then
    return;
  end if;

  update public.internships i
  set applications_count = (
    select count(*)
    from public.applications a
    where a.internship_id = p_internship_id
      and coalesce(a.status, 'submitted') <> 'withdrawn'
  )
  where i.id = p_internship_id;
end
$$;

create or replace function public.sync_internship_applications_count_trigger()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recompute_internship_applications_count(new.internship_id);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.recompute_internship_applications_count(old.internship_id);
    return old;
  end if;

  perform public.recompute_internship_applications_count(old.internship_id);
  perform public.recompute_internship_applications_count(new.internship_id);
  return new;
end
$$;

drop trigger if exists applications_sync_internship_applications_count on public.applications;
create trigger applications_sync_internship_applications_count
after insert or update or delete
on public.applications
for each row
execute function public.sync_internship_applications_count_trigger();

update public.internships i
set applications_count = counts.count_value
from (
  select a.internship_id, count(*)::integer as count_value
  from public.applications a
  where coalesce(a.status, 'submitted') <> 'withdrawn'
  group by a.internship_id
) counts
where i.id = counts.internship_id;

update public.internships
set applications_count = 0
where applications_count is null;

create or replace function public.submit_application_with_cap(
  in_internship_id uuid,
  in_student_id uuid,
  in_resume_url text,
  in_status text default 'submitted',
  in_external_apply_required boolean default false,
  in_quick_apply_note text default null,
  in_match_score integer default null,
  in_match_reasons jsonb default null,
  in_match_gaps jsonb default null,
  in_matching_version text default null
)
returns public.applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.applications%rowtype;
  v_cap integer;
  v_current_count integer;
  v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if v_actor <> in_student_id and not public.is_admin_user(v_actor) then
    raise exception 'forbidden';
  end if;

  select a.*
  into v_existing
  from public.applications a
  where a.internship_id = in_internship_id
    and a.student_id = in_student_id
    and coalesce(a.status, 'submitted') <> 'withdrawn'
  limit 1;

  if found then
    return v_existing;
  end if;

  perform pg_advisory_xact_lock(hashtext(in_internship_id::text));

  select coalesce(i.application_cap, 60)
  into v_cap
  from public.internships i
  where i.id = in_internship_id
    and i.is_active = true
  for update;

  if v_cap is null then
    raise exception 'listing_not_found';
  end if;

  select count(*)
  into v_current_count
  from public.applications a
  where a.internship_id = in_internship_id
    and coalesce(a.status, 'submitted') <> 'withdrawn';

  if v_current_count >= v_cap then
    raise exception using message = 'cap_reached';
  end if;

  select a.*
  into v_existing
  from public.applications a
  where a.internship_id = in_internship_id
    and a.student_id = in_student_id
    and coalesce(a.status, 'submitted') = 'withdrawn'
  limit 1;

  if found then
    update public.applications
    set
      resume_url = in_resume_url,
      status = coalesce(nullif(in_status, ''), 'submitted'),
      submitted_at = now(),
      employer_viewed_at = null,
      reviewed_at = null,
      external_apply_required = coalesce(in_external_apply_required, false),
      quick_apply_note = in_quick_apply_note,
      match_score = in_match_score,
      match_reasons = in_match_reasons,
      match_gaps = in_match_gaps,
      matching_version = in_matching_version
    where id = v_existing.id
    returning * into v_existing;

    return v_existing;
  end if;

  insert into public.applications (
    internship_id,
    student_id,
    resume_url,
    status,
    submitted_at,
    external_apply_required,
    quick_apply_note,
    match_score,
    match_reasons,
    match_gaps,
    matching_version
  )
  values (
    in_internship_id,
    in_student_id,
    in_resume_url,
    coalesce(nullif(in_status, ''), 'submitted'),
    now(),
    coalesce(in_external_apply_required, false),
    in_quick_apply_note,
    in_match_score,
    in_match_reasons,
    in_match_gaps,
    in_matching_version
  )
  returning * into v_existing;

  return v_existing;
end
$$;

revoke all on function public.submit_application_with_cap(
  uuid,
  uuid,
  text,
  text,
  boolean,
  text,
  integer,
  jsonb,
  jsonb,
  text
) from public;
grant execute on function public.submit_application_with_cap(
  uuid,
  uuid,
  text,
  text,
  boolean,
  text,
  integer,
  jsonb,
  jsonb,
  text
) to authenticated;

create or replace view public.employer_response_rate_stats as
select
  i.employer_id,
  count(a.id)::integer as applications_total,
  round(
    100.0 * count(*) filter (
      where a.id is not null
        and a.employer_viewed_at is not null
        and a.employer_viewed_at <= a.submitted_at + interval '7 days'
    )::numeric / nullif(count(a.id), 0)::numeric,
    1
  ) as viewed_within_7d_rate
from public.internships i
left join public.applications a
  on a.internship_id = i.id
 and coalesce(a.status, 'submitted') <> 'withdrawn'
where i.employer_id is not null
group by i.employer_id;

grant select on public.employer_response_rate_stats to anon, authenticated;
