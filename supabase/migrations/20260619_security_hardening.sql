-- Production security hardening for RPC, RLS, and storage access.

alter table if exists public.wallet_passbook enable row level security;
alter table if exists public.staff_members enable row level security;
alter table if exists public.team_members enable row level security;
alter table if exists public.submitted_meta_templates enable row level security;
alter table if exists public.subscription_events enable row level security;
alter table if exists public.whatsapp_webhook_events enable row level security;
alter table if exists public.superadmin_webhook_errors enable row level security;
alter table if exists public.superadmin_template_sync_alerts enable row level security;
alter table if exists public.superadmin_master_key_audit_logs enable row level security;
alter table if exists public.superadmin_staff enable row level security;
alter table if exists public.pre_made_templates enable row level security;

create table if not exists public.payment_processing_locks (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  payment_id text not null,
  order_id text,
  user_id uuid,
  purpose text,
  created_at timestamptz not null default now(),
  unique (provider, payment_id)
);

alter table public.payment_processing_locks enable row level security;

revoke all on table public.payment_processing_locks from anon, authenticated;

drop policy if exists "Public can read pre made templates" on public.pre_made_templates;
create policy "Public can read pre made templates"
  on public.pre_made_templates
  for select
  using (true);

drop policy if exists "Doctors can read own submitted templates" on public.submitted_meta_templates;
create policy "Doctors can read own submitted templates"
  on public.submitted_meta_templates
  for select
  using (auth.uid() = user_id);

drop policy if exists "Doctors can insert own submitted templates" on public.submitted_meta_templates;
create policy "Doctors can insert own submitted templates"
  on public.submitted_meta_templates
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Doctors can update own submitted templates" on public.submitted_meta_templates;
create policy "Doctors can update own submitted templates"
  on public.submitted_meta_templates
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Doctors can read own subscription events" on public.subscription_events;
create policy "Doctors can read own subscription events"
  on public.subscription_events
  for select
  using (auth.uid() = user_id);

do $$
begin
  if to_regclass('public.staff_members') is not null then
    drop policy if exists "Team owners and staff can read staff rows" on public.staff_members;
    create policy "Team owners and staff can read staff rows"
      on public.staff_members
      for select
      using (auth.uid() = admin_id or auth.uid() = auth_user_id);

    drop policy if exists "Team owners can insert staff rows" on public.staff_members;
    create policy "Team owners can insert staff rows"
      on public.staff_members
      for insert
      with check (auth.uid() = admin_id);

    drop policy if exists "Team owners can update staff rows" on public.staff_members;
    create policy "Team owners can update staff rows"
      on public.staff_members
      for update
      using (auth.uid() = admin_id)
      with check (auth.uid() = admin_id);

    drop policy if exists "Team owners can delete staff rows" on public.staff_members;
    create policy "Team owners can delete staff rows"
      on public.staff_members
      for delete
      using (auth.uid() = admin_id);
  end if;

  if to_regclass('public.team_members') is not null then
    drop policy if exists "Team owners and members can read legacy team rows" on public.team_members;
    create policy "Team owners and members can read legacy team rows"
      on public.team_members
      for select
      using (auth.uid() = admin_id or auth.uid() = auth_user_id);

    drop policy if exists "Team owners can write legacy team rows" on public.team_members;
    create policy "Team owners can write legacy team rows"
      on public.team_members
      for all
      using (auth.uid() = admin_id)
      with check (auth.uid() = admin_id);
  end if;
end $$;

drop policy if exists "Super admins can read webhook audit logs" on public.whatsapp_webhook_events;
create policy "Super admins can read webhook audit logs"
  on public.whatsapp_webhook_events
  for select
  using (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
  );

drop policy if exists "Super admins can read operational webhook errors" on public.superadmin_webhook_errors;
create policy "Super admins can read operational webhook errors"
  on public.superadmin_webhook_errors
  for select
  using (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
  );

drop policy if exists "Super admins can read template sync alerts" on public.superadmin_template_sync_alerts;
create policy "Super admins can read template sync alerts"
  on public.superadmin_template_sync_alerts
  for select
  using (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
  );

drop policy if exists "Super admins can read master key audit logs" on public.superadmin_master_key_audit_logs;
create policy "Super admins can read master key audit logs"
  on public.superadmin_master_key_audit_logs
  for select
  using (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
  );

drop policy if exists "Super admins can read internal staff rows" on public.superadmin_staff;
create policy "Super admins can read internal staff rows"
  on public.superadmin_staff
  for select
  using (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
  );

drop policy if exists "Wallet passbook owners can read own rows" on public.wallet_passbook;
create policy "Wallet passbook owners can read own rows"
  on public.wallet_passbook
  for select
  using (auth.uid() = user_id or auth.uid() = doctor_id);

drop policy if exists "Wallet passbook owners can insert own rows" on public.wallet_passbook;
create policy "Wallet passbook owners can insert own rows"
  on public.wallet_passbook
  for insert
  with check (auth.uid() = user_id or auth.uid() = doctor_id);

create or replace function public.increment_lifetime_patients_count(profile_id uuid, increment_by integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres', 'supabase_admin')
     and auth.uid() <> profile_id then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  update public.doctor_profiles
  set lifetime_patients_count = coalesce(lifetime_patients_count, 0) + greatest(increment_by, 0)
  where id = profile_id
  returning lifetime_patients_count into next_count;

  return coalesce(next_count, 0);
end;
$$;

create or replace function public.credit_ai_message_balance(
  p_user_id uuid,
  p_messages integer,
  p_usage jsonb default '{}'::jsonb
)
returns table(ai_message_balance integer, ai_message_used integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_user_id is null or coalesce(p_messages, 0) <= 0 then
    raise exception 'Invalid AI message credit payload';
  end if;

  update public.doctor_profiles
     set ai_message_balance = coalesce(ai_message_balance, 0) + p_messages,
         last_ai_usage = coalesce(p_usage, '{}'::jsonb)
   where id = p_user_id
   returning doctor_profiles.ai_message_balance, doctor_profiles.ai_message_used
   into ai_message_balance, ai_message_used;

  if found then
    return next;
    return;
  end if;

  update public.profiles
     set ai_message_balance = coalesce(ai_message_balance, 0) + p_messages,
         last_ai_usage = coalesce(p_usage, '{}'::jsonb)
   where id = p_user_id
   returning profiles.ai_message_balance, profiles.ai_message_used
   into ai_message_balance, ai_message_used;

  if found then
    return next;
    return;
  end if;

  raise exception 'AI profile not found';
end;
$$;

create or replace function public.debit_ai_message_balance(
  p_user_id uuid,
  p_messages integer,
  p_usage jsonb default '{}'::jsonb
)
returns table(ai_message_balance integer, ai_message_used integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_user_id is null or coalesce(p_messages, 0) <= 0 then
    raise exception 'Invalid AI message debit payload';
  end if;

  update public.doctor_profiles
     set ai_message_balance = greatest(0, coalesce(ai_message_balance, 0) - p_messages),
         ai_message_used = coalesce(ai_message_used, 0) + p_messages,
         token_used = coalesce(token_used, 0) + p_messages,
         last_ai_usage = coalesce(p_usage, '{}'::jsonb)
   where id = p_user_id
     and coalesce(ai_message_balance, 0) > 0
   returning doctor_profiles.ai_message_balance, doctor_profiles.ai_message_used
   into ai_message_balance, ai_message_used;

  if found then
    return next;
    return;
  end if;

  update public.profiles
     set ai_message_balance = greatest(0, coalesce(ai_message_balance, 0) - p_messages),
         ai_message_used = coalesce(ai_message_used, 0) + p_messages,
         token_used = coalesce(token_used, 0) + p_messages,
         last_ai_usage = coalesce(p_usage, '{}'::jsonb)
   where id = p_user_id
     and coalesce(ai_message_balance, 0) > 0
   returning profiles.ai_message_balance, profiles.ai_message_used
   into ai_message_balance, ai_message_used;

  if found then
    return next;
    return;
  end if;

  raise exception 'AI message balance depleted';
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
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  delete from public.staff_members
  where deleted_at is not null
    and deleted_at <= now() - interval '30 days';

  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;

revoke execute on function public.increment_lifetime_patients_count(uuid, integer) from public, anon, authenticated;
revoke execute on function public.credit_ai_message_balance(uuid, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.debit_ai_message_balance(uuid, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.purge_expired_deleted_staff() from public, anon, authenticated;

grant execute on function public.increment_lifetime_patients_count(uuid, integer) to service_role;
grant execute on function public.credit_ai_message_balance(uuid, integer, jsonb) to service_role;
grant execute on function public.debit_ai_message_balance(uuid, integer, jsonb) to service_role;
grant execute on function public.purge_expired_deleted_staff() to service_role;

drop policy if exists "Super admins can update app releases" on public.app_system_releases;
create policy "Super admins can update app releases"
  on public.app_system_releases
  for update
  using (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
  )
  with check (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
  );

drop policy if exists "Super admins can delete app releases" on public.app_system_releases;
create policy "Super admins can delete app releases"
  on public.app_system_releases
  for delete
  using (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
  );

drop policy if exists "Super admins can update app release files" on storage.objects;
create policy "Super admins can update app release files"
  on storage.objects
  for update
  using (
    bucket_id = 'app-releases'
    and lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
  )
  with check (
    bucket_id = 'app-releases'
    and lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
  );

drop policy if exists "Super admins can delete app release files" on storage.objects;
create policy "Super admins can delete app release files"
  on storage.objects
  for delete
  using (
    bucket_id = 'app-releases'
    and lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
  );
