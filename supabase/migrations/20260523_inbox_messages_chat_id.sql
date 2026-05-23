alter table if exists public.inbox_messages
  add column if not exists chat_id uuid references public.inbox_chats(id) on delete cascade;

create index if not exists inbox_messages_chat_id_created_at_idx
  on public.inbox_messages(chat_id, created_at);
