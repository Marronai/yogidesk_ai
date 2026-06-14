create table if not exists public.superadmin_webhook_errors (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'meta_whatsapp_webhook',
  doctor_id uuid,
  clinic_id uuid,
  message_id text,
  status text,
  error_code text,
  error_title text,
  error_message text,
  recipient_phone text,
  business_account_id text,
  phone_number_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_superadmin_webhook_errors_created_at on public.superadmin_webhook_errors (created_at desc);
create index if not exists idx_superadmin_webhook_errors_error_code on public.superadmin_webhook_errors (error_code);

create table if not exists public.superadmin_template_sync_alerts (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid,
  clinic_id uuid,
  template_id text,
  template_name text,
  status text not null,
  business_account_id text,
  alert_level text not null default 'INFO',
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_superadmin_template_sync_alerts_created_at on public.superadmin_template_sync_alerts (created_at desc);
create index if not exists idx_superadmin_template_sync_alerts_status on public.superadmin_template_sync_alerts (status);

create table if not exists public.superadmin_master_key_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  target_user_id uuid not null,
  target_email text,
  target_clinic_id uuid,
  ip_address text,
  user_agent text,
  event_type text not null default 'MASTER_KEY_GHOST_LOGIN',
  created_at timestamptz not null default now()
);

create index if not exists idx_superadmin_master_key_audit_logs_created_at on public.superadmin_master_key_audit_logs (created_at desc);
create index if not exists idx_superadmin_master_key_audit_logs_target_user_id on public.superadmin_master_key_audit_logs (target_user_id);
