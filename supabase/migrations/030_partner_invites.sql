-- Time-bound invites for partner/admin onboarding
create table if not exists public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email citext not null,
  partner_id text references public.partners(id) on delete cascade,
  role text not null default 'partner' check (role in ('partner','admin')),
  name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used boolean not null default false,
  used_at timestamptz
);

create index if not exists partner_invites_email_idx on public.partner_invites (email);
create index if not exists partner_invites_partner_id_idx on public.partner_invites (partner_id, created_at desc);
create index if not exists partner_invites_active_idx on public.partner_invites (token) where used = false;
