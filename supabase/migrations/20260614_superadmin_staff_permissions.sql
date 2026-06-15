create table if not exists public.superadmin_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  mobile text,
  otp_validation_string text,
  auth_user_id uuid unique,
  is_active boolean not null default true,
  status text not null default 'INVITED',
  can_view_owner_overview boolean not null default false,
  can_view_universal_matrix boolean not null default false,
  can_override_plan_wallet boolean not null default false,
  can_manage_meta_compliance boolean not null default false,
  can_use_kill_switch boolean not null default false,
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_superadmin_staff_email on public.superadmin_staff (email);
create index if not exists idx_superadmin_staff_auth_user_id on public.superadmin_staff (auth_user_id);

alter table public.superadmin_staff add column if not exists mobile text;
alter table public.superadmin_staff add column if not exists otp_validation_string text;
