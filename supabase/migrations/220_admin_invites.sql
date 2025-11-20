-- Admin invite support for self-service onboarding
create table if not exists public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  inviter_email text,
  token text not null,
  role text not null default 'admin',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_invites_role_check check (role in ('admin'))
);

create unique index if not exists admin_invites_token_key on public.admin_invites (token);
create index if not exists admin_invites_email_status_idx on public.admin_invites (email, accepted_at, expires_at);

alter table public.partner_users
  add column if not exists verified_at timestamptz,
  add column if not exists last_invited_at timestamptz,
  add column if not exists invited_by text;
