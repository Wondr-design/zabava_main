-- Core partner directory
create table if not exists public.partners (
  id text primary key,
  display_name text,
  status text not null default 'active' check (status in ('active','pending','inactive')),
  contact_email citext,
  contact_name text,
  tags text[] default array[]::text[],
  website text,
  contract jsonb not null default '{}'::jsonb,
  ticketing jsonb not null default '{}'::jsonb,
  info jsonb not null default '{}'::jsonb,
  media jsonb not null default '{}'::jsonb,
  bonus_program_enabled boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partners_status_idx on public.partners (status);
create index if not exists partners_bonus_program_enabled_idx on public.partners (bonus_program_enabled) where bonus_program_enabled;
