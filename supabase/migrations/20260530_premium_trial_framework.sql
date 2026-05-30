alter table if exists public.doctor_profiles
  add column if not exists email text,
  add column if not exists subscription_tier text default 'GROWTH',
  add column if not exists subscription_status text default 'trialing',
  add column if not exists trial_start_at timestamptz default now(),
  add column if not exists trial_end_at timestamptz default (now() + interval '7 days'),
  add column if not exists trial_last_reminder_at timestamptz,
  add column if not exists wallet_balance numeric(12,2) default 50.00,
  add column if not exists onboarding_tour_completed boolean default false,
  add column if not exists active_subscription_started_at timestamptz,
  add column if not exists plan_limits jsonb default '{"patient_limit":2000,"staff_limit":3,"template_limit":50}'::jsonb,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tier text not null,
  event_type text not null,
  payment_reference text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_doctor_profiles_trial_end
  on public.doctor_profiles (trial_end_at)
  where subscription_status in ('trialing', 'trial');

create index if not exists idx_subscription_events_user_id
  on public.subscription_events (user_id, created_at desc);
