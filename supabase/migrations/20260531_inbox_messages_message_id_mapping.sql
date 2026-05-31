alter table if exists public.inbox_messages
  add column if not exists meta_message_id text,
  add column if not exists message_id text;

update public.inbox_messages
set
  meta_message_id = coalesce(meta_message_id, metadata->>'meta_message_id', metadata->>'message_id'),
  message_id = coalesce(message_id, metadata->>'message_id', metadata->>'meta_message_id')
where (meta_message_id is null or message_id is null)
  and metadata is not null
  and coalesce(metadata->>'message_id', metadata->>'meta_message_id') is not null;

create index if not exists inbox_messages_meta_message_id_idx
  on public.inbox_messages(meta_message_id);

create index if not exists inbox_messages_message_id_idx
  on public.inbox_messages(message_id);

create or replace function public.sync_inbox_message_id_from_metadata()
returns trigger
language plpgsql
as $$
begin
  if new.meta_message_id is null and new.metadata is not null then
    new.meta_message_id := coalesce(new.metadata->>'meta_message_id', new.metadata->>'message_id');
  end if;

  if new.message_id is null and new.metadata is not null then
    new.message_id := coalesce(new.metadata->>'message_id', new.meta_message_id, new.metadata->>'meta_message_id');
  end if;

  return new;
end;
$$;

drop trigger if exists inbox_messages_sync_message_id on public.inbox_messages;
create trigger inbox_messages_sync_message_id
  before insert or update of meta_message_id, message_id, metadata on public.inbox_messages
  for each row
  execute function public.sync_inbox_message_id_from_metadata();
