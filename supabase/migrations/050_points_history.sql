-- Track points earned and redeemed per user
create table if not exists public.points_history (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  type text not null check (type in ('earned','redemption','adjustment')),
  points integer not null,
  partner_id text references public.partners(id) on delete set null,
  partner_name text,
  visit_id uuid references public.visit_registrations(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists points_history_email_idx on public.points_history (email, created_at desc);
create index if not exists points_history_visit_idx on public.points_history (visit_id);
