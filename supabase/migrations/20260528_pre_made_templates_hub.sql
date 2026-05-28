create extension if not exists pgcrypto;

create table if not exists public.pre_made_templates (
  id uuid primary key default gen_random_uuid(),
  slug text,
  title text,
  category text,
  specialization text,
  language text,
  body_text text,
  has_media boolean default false,
  media_type text,
  variable_schema jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table if exists public.pre_made_templates
  add column if not exists slug text,
  add column if not exists title text,
  add column if not exists category text,
  add column if not exists specialization text,
  add column if not exists language text,
  add column if not exists body_text text,
  add column if not exists has_media boolean default false,
  add column if not exists media_type text,
  add column if not exists variable_schema jsonb default '[]'::jsonb,
  add column if not exists created_at timestamptz default now();

create unique index if not exists pre_made_templates_specialization_slug_uidx
  on public.pre_made_templates (specialization, slug);

with
specialties(specialization, tag) as (
  values
    ('Dentist', 'dental'),
    ('Gynecologist', 'women_health'),
    ('General Physician', 'general_care'),
    ('Orthopedic', 'bone_joint')
),
hinglish_templates(position, title, category, body_text, has_media, media_type) as (
  values
    (1, 'Appointment Reminder', 'UTILITY', 'Namaste {{1}}, aapka appointment {{2}} par scheduled hai. Kripya time par clinic pahunchein.', false, null),
    (2, 'Follow-up Check', 'UTILITY', 'Hello {{1}}, doctor ne aapka follow-up {{2}} par suggest kiya hai. Booking link: {{3}}', false, null),
    (3, 'Report Review', 'UTILITY', 'Namaste {{1}}, agar aapki reports ready hain, kripya review visit ke liye slot book karein: {{2}}', true, 'DOCUMENT'),
    (4, 'Health Tip', 'MARKETING', 'Hello {{1}}, apni health ka dhyan rakhein. Is week ka simple care tip dekhne ke liye clinic se connect karein: {{2}}', true, 'IMAGE'),
    (5, 'Camp Invite', 'MARKETING', 'Namaste {{1}}, hamare clinic me preventive health camp available hai. Slot details ke liye yahan click karein: {{2}}', true, 'IMAGE'),
    (6, 'Medication Reminder', 'UTILITY', 'Hello {{1}}, doctor ke advice ke mutabik apni dawai time par lein. Kisi concern ke liye clinic se sampark karein.', false, null),
    (7, 'Booking Nudge', 'MARKETING', 'Namaste {{1}}, routine checkup delay na karein. Convenient slot book karne ke liye click karein: {{2}}', false, null),
    (8, 'Care Plan Reminder', 'UTILITY', 'Hello {{1}}, aapka care plan active hai. Agla step complete karne ke liye clinic team se connect karein: {{2}}', false, null),
    (9, 'Seasonal Care', 'MARKETING', 'Namaste {{1}}, season change ke dauran preventive checkup helpful hota hai. Appointment: {{2}}', true, 'IMAGE'),
    (10, 'Clinic Update', 'UTILITY', 'Hello {{1}}, clinic timing ya appointment update ke liye yeh official message hai. Details: {{2}}', false, null)
),
hindi_templates(position, title, category, body_text, has_media, media_type) as (
  values
    (1, 'Niyamit Janch Reminder', 'UTILITY', 'नमस्ते {{1}}, आपकी नियमित जांच {{2}} पर निर्धारित है। कृपया समय पर क्लिनिक आएं।', false, null),
    (2, 'Follow-up Suchna', 'UTILITY', 'नमस्ते {{1}}, डॉक्टर ने आपके लिए फॉलो-अप विजिट सुझाई है। बुकिंग लिंक: {{2}}', false, null),
    (3, 'Report Review', 'UTILITY', 'नमस्ते {{1}}, रिपोर्ट समीक्षा के लिए कृपया अपना स्लॉट बुक करें: {{2}}', true, 'DOCUMENT'),
    (4, 'Swasthya Salah', 'MARKETING', 'नमस्ते {{1}}, बेहतर स्वास्थ्य के लिए नियमित जांच जरूरी है। जानकारी के लिए क्लिक करें: {{2}}', true, 'IMAGE'),
    (5, 'Camp Invite', 'MARKETING', 'नमस्ते {{1}}, हमारे क्लिनिक में स्वास्थ्य शिविर उपलब्ध है। स्लॉट बुक करें: {{2}}', true, 'IMAGE'),
    (6, 'Dawai Reminder', 'UTILITY', 'नमस्ते {{1}}, कृपया डॉक्टर की सलाह के अनुसार दवाइयां समय पर लें।', false, null),
    (7, 'Booking Reminder', 'MARKETING', 'नमस्ते {{1}}, अपनी जांच के लिए सुविधाजनक समय यहां बुक करें: {{2}}', false, null)
),
english_templates(position, title, category, body_text, has_media, media_type) as (
  values
    (1, 'Routine Checkup', 'UTILITY', 'Hello {{1}}, your routine checkup is due. Please book a convenient slot here: {{2}}', false, null),
    (2, 'Clinic Health Tip', 'MARKETING', 'Hello {{1}}, stay proactive with preventive care. View clinic details here: {{2}}', true, 'IMAGE'),
    (3, 'Follow-up Visit', 'UTILITY', 'Hello {{1}}, your follow-up visit is recommended. Please confirm your slot: {{2}}', false, null)
),
expanded as (
  select
    s.specialization,
    lower(replace(s.specialization, ' ', '_')) || '_hinglish_' || h.position || '_' || n as slug,
    h.title || ' ' || ((h.position - 1) * 4 + n) as title,
    h.category,
    'Hinglish' as language,
    case s.specialization
      when 'Dentist' then replace(h.body_text, 'routine checkup', 'dental checkup')
      when 'Gynecologist' then replace(h.body_text, 'routine checkup', 'regular women health checkup')
      when 'Orthopedic' then replace(h.body_text, 'routine checkup', 'bone aur joint checkup')
      else h.body_text
    end as body_text,
    h.has_media,
    h.media_type,
    h.position
  from specialties s
  cross join hinglish_templates h
  cross join generate_series(1, 4) n
  union all
  select s.specialization, lower(replace(s.specialization, ' ', '_')) || '_hindi_' || h.position, h.title, h.category, 'Hindi', h.body_text, h.has_media, h.media_type, h.position
  from specialties s cross join hindi_templates h
  union all
  select s.specialization, lower(replace(s.specialization, ' ', '_')) || '_english_' || e.position, e.title, e.category, 'English', e.body_text, e.has_media, e.media_type, e.position
  from specialties s cross join english_templates e
)
insert into public.pre_made_templates (
  slug,
  title,
  category,
  specialization,
  language,
  body_text,
  has_media,
  media_type,
  variable_schema
)
select
  slug,
  title,
  category,
  specialization,
  language,
  body_text,
  has_media,
  media_type,
  '[{"index":1,"field":"patient_name","label":"Patient Name"},{"index":2,"field":"booking_link","label":"Clinic Booking Link"},{"index":3,"field":"booking_link","label":"Clinic Booking Link"}]'::jsonb
from expanded
on conflict (specialization, slug) do update set
  title = excluded.title,
  category = excluded.category,
  language = excluded.language,
  body_text = excluded.body_text,
  has_media = excluded.has_media,
  media_type = excluded.media_type,
  variable_schema = excluded.variable_schema;
