alter table public.internships
  add column if not exists ats_stage_mode text;

update public.internships
set ats_stage_mode = 'curated'
where apply_mode in ('ats_link', 'hybrid')
  and ats_stage_mode is null;

alter table public.internships
  drop constraint if exists internships_ats_stage_mode_check;
alter table public.internships
  add constraint internships_ats_stage_mode_check
  check (
    (apply_mode = 'native' and ats_stage_mode is null)
    or (apply_mode in ('ats_link', 'hybrid') and ats_stage_mode in ('immediate', 'curated'))
  );

alter table public.applications
  add column if not exists ats_invite_status text not null default 'not_invited',
  add column if not exists ats_invited_at timestamptz,
  add column if not exists ats_invited_by uuid references public.users(id) on delete set null,
  add column if not exists ats_invite_message text;

alter table public.applications
  drop constraint if exists applications_ats_invite_status_check;
alter table public.applications
  add constraint applications_ats_invite_status_check
  check (ats_invite_status in ('not_invited', 'invited', 'clicked', 'self_reported_complete', 'employer_confirmed'));

update public.applications
set ats_invite_status = case
  when coalesce(external_apply_required, false) = true and external_apply_completed_at is null then 'invited'
  when external_apply_completed_at is not null then 'self_reported_complete'
  else 'not_invited'
end
where ats_invite_status is null
   or ats_invite_status = 'not_invited';

create or replace function public.sync_application_external_apply_required()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.ats_invite_status in ('invited', 'clicked', 'self_reported_complete', 'employer_confirmed') then
    new.external_apply_required := true;
  else
    new.external_apply_required := false;
  end if;

  if new.ats_invite_status = 'not_invited' then
    new.external_apply_completed_at := null;
  end if;

  return new;
end
$$;

drop trigger if exists applications_sync_external_apply_required on public.applications;
create trigger applications_sync_external_apply_required
before insert or update on public.applications
for each row
execute function public.sync_application_external_apply_required();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_at_idx
  on public.notifications(user_id, created_at desc);

create table if not exists public.user_notification_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  application_submitted boolean not null default true,
  ats_invite_sent boolean not null default true,
  ats_completed_self_reported boolean not null default true,
  message_received boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists application_messages_application_created_at_idx
  on public.application_messages(application_id, created_at asc);

alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

alter table public.user_notification_settings enable row level security;
drop policy if exists user_notification_settings_select_own on public.user_notification_settings;
create policy user_notification_settings_select_own
  on public.user_notification_settings
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists user_notification_settings_upsert_own on public.user_notification_settings;
create policy user_notification_settings_upsert_own
  on public.user_notification_settings
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

alter table public.application_messages enable row level security;
drop policy if exists application_messages_select_participants on public.application_messages;
create policy application_messages_select_participants
  on public.application_messages
  for select
  to authenticated
  using (
    sender_user_id = (select auth.uid())
    or recipient_user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists application_messages_insert_participants on public.application_messages;
create policy application_messages_insert_participants
  on public.application_messages
  for insert
  to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and (
      exists (
        select 1
        from public.applications a
        join public.internships i on i.id = a.internship_id
        where a.id = application_id
          and (
            (sender_user_id = a.student_id and recipient_user_id = i.employer_id)
            or (sender_user_id = i.employer_id and recipient_user_id = a.student_id)
          )
      )
      or public.is_admin_user((select auth.uid()))
    )
  );

create or replace function public.submit_application_with_cap_v2(
  in_internship_id uuid,
  in_student_id uuid,
  in_resume_url text,
  in_status text default 'submitted',
  in_external_apply_required boolean default false,
  in_quick_apply_note text default null,
  in_match_score integer default null,
  in_match_reasons jsonb default null,
  in_match_gaps jsonb default null,
  in_matching_version text default null,
  in_ats_invite_status text default 'not_invited'
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
  v_ats_invite_status text;
  v_external_required boolean;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if v_actor <> in_student_id and not public.is_admin_user(v_actor) then
    raise exception 'forbidden';
  end if;

  v_ats_invite_status := case
    when in_ats_invite_status in ('not_invited', 'invited', 'clicked', 'self_reported_complete', 'employer_confirmed') then in_ats_invite_status
    else 'not_invited'
  end;
  v_external_required := coalesce(in_external_apply_required, false)
    or v_ats_invite_status in ('invited', 'clicked', 'self_reported_complete', 'employer_confirmed');

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
      external_apply_required = v_external_required,
      quick_apply_note = in_quick_apply_note,
      match_score = in_match_score,
      match_reasons = in_match_reasons,
      match_gaps = in_match_gaps,
      matching_version = in_matching_version,
      ats_invite_status = v_ats_invite_status,
      ats_invited_at = case when v_ats_invite_status = 'invited' then now() else null end,
      ats_invited_by = null,
      ats_invite_message = null,
      external_apply_completed_at = null
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
    matching_version,
    ats_invite_status,
    ats_invited_at,
    ats_invited_by,
    ats_invite_message
  )
  values (
    in_internship_id,
    in_student_id,
    in_resume_url,
    coalesce(nullif(in_status, ''), 'submitted'),
    now(),
    v_external_required,
    in_quick_apply_note,
    in_match_score,
    in_match_reasons,
    in_match_gaps,
    in_matching_version,
    v_ats_invite_status,
    case when v_ats_invite_status = 'invited' then now() else null end,
    null,
    null
  )
  returning * into v_existing;

  return v_existing;
end
$$;

revoke all on function public.submit_application_with_cap_v2(
  uuid,
  uuid,
  text,
  text,
  boolean,
  text,
  integer,
  jsonb,
  jsonb,
  text,
  text
) from public;
grant execute on function public.submit_application_with_cap_v2(
  uuid,
  uuid,
  text,
  text,
  boolean,
  text,
  integer,
  jsonb,
  jsonb,
  text,
  text
) to authenticated;

create or replace function public.student_mark_ats_invite_complete(in_application_id uuid)
returns public.applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.applications%rowtype;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select a.*
  into v_row
  from public.applications a
  where a.id = in_application_id
    and a.student_id = v_actor
  limit 1;

  if not found then
    raise exception 'forbidden';
  end if;

  if v_row.ats_invite_status not in ('invited', 'clicked', 'self_reported_complete', 'employer_confirmed') then
    raise exception 'ats_invite_required';
  end if;

  if v_row.ats_invite_status = 'employer_confirmed' then
    return v_row;
  end if;

  update public.applications
  set
    ats_invite_status = 'self_reported_complete',
    external_apply_completed_at = coalesce(external_apply_completed_at, now())
  where id = v_row.id
  returning * into v_row;

  return v_row;
end
$$;

revoke all on function public.student_mark_ats_invite_complete(uuid) from public;
grant execute on function public.student_mark_ats_invite_complete(uuid) to authenticated;
