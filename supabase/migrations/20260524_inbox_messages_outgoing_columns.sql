alter table if exists public.inbox_messages
  add column if not exists body text,
  add column if not exists text text,
  add column if not exists sender text,
  add column if not exists from_me boolean default false,
  add column if not exists type text default 'public',
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

create index if not exists inbox_messages_created_at_idx
  on public.inbox_messages(created_at);
