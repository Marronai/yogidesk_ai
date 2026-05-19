alter table if exists public.doctor_profiles
  add column if not exists lifetime_patients_count integer not null default 0;

create or replace function public.increment_lifetime_patients_count(profile_id uuid, increment_by integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  update public.doctor_profiles
  set lifetime_patients_count = coalesce(lifetime_patients_count, 0) + greatest(increment_by, 0)
  where id = profile_id
  returning lifetime_patients_count into next_count;

  return coalesce(next_count, 0);
end;
$$;
