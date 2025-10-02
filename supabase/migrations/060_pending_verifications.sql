-- Pending verification records for QR flows
create table if not exists public.pending_verifications (
  id uuid primary key default gen_random_uuid(),
  rid text unique,
  email citext,
  verify_url text,
  qr_url text,
  visit_id uuid references public.visit_registrations(id) on delete set null,
  legacy_key text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists pending_verifications_email_idx on public.pending_verifications (email);
create index if not exists pending_verifications_expiry_idx on public.pending_verifications (expires_at);
