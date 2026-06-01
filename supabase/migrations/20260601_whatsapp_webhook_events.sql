create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'meta_webhook',
  message_id text,
  status text,
  recipient_phone text,
  business_account_id text,
  phone_number_id text,
  display_phone_number text,
  matched_message_count integer not null default 0,
  matched_chat_ids jsonb not null default '[]'::jsonb,
  processing_error text,
  payload jsonb
);

create index if not exists whatsapp_webhook_events_message_id_idx
  on public.whatsapp_webhook_events(message_id);

create index if not exists whatsapp_webhook_events_status_created_at_idx
  on public.whatsapp_webhook_events(status, created_at desc);

create index if not exists whatsapp_webhook_events_created_at_idx
  on public.whatsapp_webhook_events(created_at desc);
