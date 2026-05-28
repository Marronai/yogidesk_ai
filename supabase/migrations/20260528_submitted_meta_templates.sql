create extension if not exists pgcrypto;

create table if not exists public.submitted_meta_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  template_name text not null,
  category text default 'MARKETING',
  language text default 'en_US',
  body_content text,
  status text default 'PENDING_APPROVAL',
  header_type text default 'NONE',
  header_url text,
  buttons jsonb default '[]'::jsonb,
  components jsonb default '[]'::jsonb,
  meta_template_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists public.submitted_meta_templates
  add column if not exists user_id uuid,
  add column if not exists template_name text,
  add column if not exists category text default 'MARKETING',
  add column if not exists language text default 'en_US',
  add column if not exists body_content text,
  add column if not exists status text default 'PENDING_APPROVAL',
  add column if not exists header_type text default 'NONE',
  add column if not exists header_url text,
  add column if not exists buttons jsonb default '[]'::jsonb,
  add column if not exists components jsonb default '[]'::jsonb,
  add column if not exists meta_template_id text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists submitted_meta_templates_user_status_idx
  on public.submitted_meta_templates (user_id, status);

create index if not exists submitted_meta_templates_meta_id_idx
  on public.submitted_meta_templates (meta_template_id);

insert into storage.buckets (id, name, public)
values ('template-media', 'template-media', true)
on conflict (id) do update set public = excluded.public;
