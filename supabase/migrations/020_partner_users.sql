-- Accounts for partner and admin users
create table if not exists public.partner_users (
  email citext primary key,
  password_hash text not null,
  partner_id text references public.partners(id) on delete set null,
  role text not null default 'partner' check (role in ('partner','admin')),
  name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists partner_users_partner_id_idx on public.partner_users (partner_id);
create index if not exists partner_users_role_idx on public.partner_users (role);
