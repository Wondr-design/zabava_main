-- Redemptions table to support reward redemption lifecycle (pending, applied, used, rejected)
-- Mirrors KV-based code lifecycle with optional linkage to visit registrations

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  email citext not null,
  reward_id text not null references public.rewards(id) on delete restrict,
  partner_id text references public.partners(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','applied','used','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz,
  used_at timestamptz,
  expires_at timestamptz,
  applied_to_visit_id uuid references public.visit_registrations(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists redemptions_email_idx on public.redemptions (email);
create index if not exists redemptions_code_idx on public.redemptions (code);
create index if not exists redemptions_status_idx on public.redemptions (status);