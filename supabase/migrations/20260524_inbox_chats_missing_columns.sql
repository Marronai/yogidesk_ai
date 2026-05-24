alter table if exists public.inbox_chats
  add column if not exists user_id uuid,
  add column if not exists doctor_id uuid,
  add column if not exists name text,
  add column if not exists patient_name text,
  add column if not exists phone text,
  add column if not exists patient_phone text,
  add column if not exists last_message text,
  add column if not exists status text default 'Offline',
  add column if not exists scheduled_at timestamptz,
  add column if not exists assigned_agent_id text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists unread_count integer default 0,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists created_at timestamptz default now();

create index if not exists inbox_chats_phone_idx
  on public.inbox_chats(phone);

create index if not exists inbox_chats_updated_at_idx
  on public.inbox_chats(updated_at desc);

create index if not exists inbox_chats_doctor_id_idx
  on public.inbox_chats(doctor_id);
