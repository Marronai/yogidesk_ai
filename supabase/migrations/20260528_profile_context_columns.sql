alter table if exists public.doctor_profiles
  add column if not exists specialization text,
  add column if not exists meta_business_manager_id text,
  add column if not exists meta_business_id text,
  add column if not exists business_id text,
  add column if not exists clinic_booking_link text,
  add column if not exists booking_link text;
