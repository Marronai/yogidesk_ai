create table if not exists public.app_system_releases (
  id uuid primary key default gen_random_uuid(),
  version_code text not null,
  changelog_notes text,
  apk_url text not null,
  storage_path text not null unique,
  file_name text,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_system_releases_updated_at on public.app_system_releases (updated_at desc);

alter table public.app_system_releases enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-releases',
  'app-releases',
  true,
  314572800,
  array['application/vnd.android.package-archive', 'application/octet-stream']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_system_releases' and policyname = 'Public can read app releases'
  ) then
    create policy "Public can read app releases"
    on public.app_system_releases
    for select
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_system_releases' and policyname = 'Super admins can insert app releases'
  ) then
    create policy "Super admins can insert app releases"
    on public.app_system_releases
    for insert
    with check (
      lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public can read app release files'
  ) then
    create policy "Public can read app release files"
    on storage.objects
    for select
    using (bucket_id = 'app-releases');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Super admins can upload app release files'
  ) then
    create policy "Super admins can upload app release files"
    on storage.objects
    for insert
    with check (
      bucket_id = 'app-releases'
      and lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'user_role', '')) in ('superadmin', 'super_admin')
    );
  end if;
end $$;
