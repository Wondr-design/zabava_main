-- Store ephemeral share links for bonus dashboards

create table if not exists public.bonus_secure_links (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bonus_secure_links_email_idx
  on public.bonus_secure_links (email);

create index if not exists bonus_secure_links_expires_idx
  on public.bonus_secure_links (expires_at);
