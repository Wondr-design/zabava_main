-- Staff accounts attached to partners
create table if not exists public.partner_staff (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.partners(id) on delete cascade,
  email citext not null unique,
  password_hash text not null,
  name text,
  status text not null default 'active' check (status in ('active','inactive','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists partner_staff_partner_idx on public.partner_staff (partner_id);
create index if not exists partner_staff_status_idx on public.partner_staff (status);

-- Invitations that partners send to staff members
create table if not exists public.partner_staff_invites (
  token text primary key,
  partner_id text not null references public.partners(id) on delete cascade,
  email citext,
  name text,
  status text not null default 'pending' check (status in ('pending','used','revoked','expired')),
  expires_at timestamptz,
  used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  created_by_email citext
);

create index if not exists partner_staff_invites_partner_idx on public.partner_staff_invites (partner_id);
create index if not exists partner_staff_invites_status_idx on public.partner_staff_invites (status);
create index if not exists partner_staff_invites_email_idx on public.partner_staff_invites (email);

-- Track which staff member checked in a visit
alter table public.visit_registrations
  add column if not exists checked_in_by_staff_id uuid references public.partner_staff(id) on delete set null;

create index if not exists visit_registrations_checked_by_staff_idx
  on public.visit_registrations (checked_in_by_staff_id);
