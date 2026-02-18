create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists api_rate_limits_updated_at_idx
  on public.api_rate_limits (updated_at desc);

alter table public.api_rate_limits enable row level security;

drop policy if exists api_rate_limits_select_admin on public.api_rate_limits;
create policy api_rate_limits_select_admin
  on public.api_rate_limits
  for select
  to authenticated
  using (public.is_admin_user((select auth.uid())));

create or replace function public.check_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_window_started_at timestamptz;
  v_request_count integer;
  v_reset_at timestamptz;
begin
  if p_bucket_key is null or length(trim(p_bucket_key)) = 0 then
    raise exception 'bucket key is required';
  end if;
  if p_limit is null or p_limit <= 0 then
    raise exception 'limit must be positive';
  end if;
  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'window_seconds must be positive';
  end if;

  loop
    update public.api_rate_limits arl
    set
      request_count = case
        when arl.window_started_at <= (v_now - make_interval(secs => p_window_seconds))
          then 1
        else arl.request_count + 1
      end,
      window_started_at = case
        when arl.window_started_at <= (v_now - make_interval(secs => p_window_seconds))
          then v_now
        else arl.window_started_at
      end,
      updated_at = v_now
    where arl.bucket_key = p_bucket_key
    returning arl.window_started_at, arl.request_count
    into v_window_started_at, v_request_count;

    if found then
      exit;
    end if;

    begin
      insert into public.api_rate_limits (
        bucket_key,
        window_started_at,
        request_count,
        updated_at
      ) values (
        p_bucket_key,
        v_now,
        1,
        v_now
      )
      returning window_started_at, request_count
      into v_window_started_at, v_request_count;

      exit;
    exception
      when unique_violation then
        -- Retry on race.
    end;
  end loop;

  v_reset_at := v_window_started_at + make_interval(secs => p_window_seconds);

  if v_request_count > p_limit then
    allowed := false;
    retry_after_seconds := greatest(1, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
  else
    allowed := true;
    retry_after_seconds := 0;
  end if;

  return next;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
