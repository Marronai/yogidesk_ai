create table if not exists public.clinic_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctor_profiles(id) on delete cascade,
  clinic_timing text,
  consultation_fees text,
  clinic_location text,
  services_offered text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_knowledge_base_doctor_unique unique (doctor_id)
);

alter table public.clinic_knowledge_base enable row level security;

drop policy if exists "Doctors can read own clinic knowledge base" on public.clinic_knowledge_base;
create policy "Doctors can read own clinic knowledge base"
  on public.clinic_knowledge_base
  for select
  using (auth.uid() = doctor_id);

drop policy if exists "Doctors can insert own clinic knowledge base" on public.clinic_knowledge_base;
create policy "Doctors can insert own clinic knowledge base"
  on public.clinic_knowledge_base
  for insert
  with check (auth.uid() = doctor_id);

drop policy if exists "Doctors can update own clinic knowledge base" on public.clinic_knowledge_base;
create policy "Doctors can update own clinic knowledge base"
  on public.clinic_knowledge_base
  for update
  using (auth.uid() = doctor_id)
  with check (auth.uid() = doctor_id);

create index if not exists clinic_knowledge_base_doctor_id_idx
  on public.clinic_knowledge_base (doctor_id);
