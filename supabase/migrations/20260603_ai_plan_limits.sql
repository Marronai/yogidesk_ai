alter table if exists public.doctor_profiles
  add column if not exists plan text not null default 'Basic',
  add column if not exists ai_enabled boolean not null default false,
  add column if not exists token_limit integer not null default 0,
  add column if not exists token_used integer not null default 0,
  add column if not exists is_ai_paused boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'doctor_profiles_plan_check'
      and conrelid = 'public.doctor_profiles'::regclass
  ) then
    alter table public.doctor_profiles
      add constraint doctor_profiles_plan_check
      check (plan in ('Basic', 'Growth', 'Multi-Specialty'));
  end if;
end $$;

update public.doctor_profiles
set
  plan = coalesce(plan, 'Basic'),
  ai_enabled = coalesce(ai_enabled, false),
  token_limit = coalesce(token_limit, 0),
  token_used = coalesce(token_used, 0),
  is_ai_paused = coalesce(is_ai_paused, false);
