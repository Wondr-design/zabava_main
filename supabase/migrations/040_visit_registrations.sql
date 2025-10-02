-- Visit registrations and membership metadata
create table if not exists public.visit_registrations (
  id uuid primary key default gen_random_uuid(),
  submission_id text,
  email citext not null,
  partner_id text references public.partners(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','visited','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  estimated_points integer not null default 0,
  points_awarded integer not null default 0,
  total_price numeric(12,2) not null default 0,
  num_people integer not null default 1,
  ticket_type text,
  transport text,
  categories text,
  visited_at timestamptz,
  visit_notes text,
  has_redemption boolean not null default false,
  redemption_code text,
  redemption_reward text,
  redemption_value integer,
  legacy_qr_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visit_registrations_email_idx on public.visit_registrations (email, created_at desc);
create index if not exists visit_registrations_partner_idx on public.visit_registrations (partner_id, created_at desc);
create index if not exists visit_registrations_status_idx on public.visit_registrations (status, visited_at);
create index if not exists visit_registrations_submission_idx on public.visit_registrations (submission_id);

create table if not exists public.partner_members (
  partner_id text references public.partners(id) on delete cascade,
  email citext not null,
  first_seen_at timestamptz not null default now(),
  primary key (partner_id, email)
);

create index if not exists partner_members_email_idx on public.partner_members (email);
