alter table if exists public.team_members
  add column if not exists invite_expires_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists deleted_at timestamptz;

update public.team_members
set invite_expires_at = created_at + interval '3 days'
where invite_expires_at is null
  and upper(coalesce(status, 'PENDING')) = 'PENDING';

update public.team_members
set status = 'EXPIRED'
where upper(coalesce(status, '')) = 'PENDING'
  and invite_expires_at is not null
  and invite_expires_at <= now();

create index if not exists team_members_admin_status_idx
  on public.team_members (admin_id, status);

create index if not exists team_members_admin_deleted_at_idx
  on public.team_members (admin_id, deleted_at);

create index if not exists team_members_invite_expires_at_idx
  on public.team_members (invite_expires_at);
