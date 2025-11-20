-- Partner-specific form configurations for embed generator
create table if not exists public.partner_forms (
  id uuid primary key default gen_random_uuid(),
  partner_id text references public.partners(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  description text,
  embed_version text not null default 'v1',
  config jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_forms_partner_slug_idx on public.partner_forms (partner_id, slug);
create index if not exists partner_forms_status_idx on public.partner_forms (status);
