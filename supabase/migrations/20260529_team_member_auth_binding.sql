alter table if exists public.team_members
  add column if not exists auth_user_id uuid,
  add column if not exists user_id uuid;

create index if not exists team_members_auth_user_id_idx
  on public.team_members (auth_user_id);

create index if not exists team_members_email_status_idx
  on public.team_members (email, status);
