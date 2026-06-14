alter table if exists public.staff_members
  add column if not exists is_active boolean not null default true;

alter table if exists public.clinics
  add column if not exists last_staff_deleted_at timestamptz;

alter table if exists public.doctor_profiles
  add column if not exists last_staff_deleted_at timestamptz;

update public.staff_members
set is_active = false
where deleted_at is not null
   or upper(coalesce(status, '')) = 'DELETED';

create index if not exists staff_members_active_admin_idx
  on public.staff_members (admin_id, is_active, status)
  where deleted_at is null;

do $$
begin
  if to_regclass('public.clinics') is not null then
    create index if not exists clinics_last_staff_deleted_at_idx
      on public.clinics (last_staff_deleted_at);
  end if;

  if to_regclass('public.doctor_profiles') is not null then
    create index if not exists doctor_profiles_last_staff_deleted_at_idx
      on public.doctor_profiles (last_staff_deleted_at);
  end if;
end;
$$;

create or replace function public.purge_expired_deleted_staff()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged_count integer := 0;
begin
  delete from public.staff_members
  where deleted_at is not null
    and deleted_at <= now() - interval '30 days';

  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('purge-expired-deleted-staff');
    perform cron.schedule(
      'purge-expired-deleted-staff',
      '17 2 * * *',
      'select public.purge_expired_deleted_staff();'
    );
  end if;
exception
  when undefined_schema or undefined_function then
    null;
end;
$$;
