create table if not exists public.wallet_passbook (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  doctor_id uuid,
  patient_number text,
  entry_type text not null,
  amount numeric(12,2) not null default 0,
  messages_delta integer not null default 0,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_passbook_user_created_idx
  on public.wallet_passbook (user_id, created_at desc);

create index if not exists wallet_passbook_doctor_created_idx
  on public.wallet_passbook (doctor_id, created_at desc);

do $$
declare
  target_table text;
begin
  foreach target_table in array array['doctor_profiles', 'profiles', 'doctors']
  loop
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format('alter table public.%I add column if not exists ai_message_balance integer not null default 0', target_table);
      execute format('alter table public.%I add column if not exists ai_message_used integer not null default 0', target_table);
      execute format('alter table public.%I add column if not exists last_ai_usage jsonb not null default %L::jsonb', target_table, '{}');
    end if;
  end loop;
end $$;

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
