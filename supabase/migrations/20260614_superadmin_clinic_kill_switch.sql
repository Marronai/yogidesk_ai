alter table if exists public.clinics
  add column if not exists is_blocked boolean not null default false;

create index if not exists clinics_is_blocked_idx
  on public.clinics (is_blocked);
