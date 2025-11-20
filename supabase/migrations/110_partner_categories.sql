-- Partner showcase categories and content
create table if not exists public.partner_categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_categories_sort_idx
  on public.partner_categories (sort_order, name);

create table if not exists public.partner_category_assignments (
  partner_id text not null references public.partners (id) on delete cascade,
  category_id text not null references public.partner_categories (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (partner_id, category_id)
);

create index if not exists partner_category_assignments_category_idx
  on public.partner_category_assignments (category_id);

create table if not exists public.partner_showcase (
  partner_id text primary key references public.partners (id) on delete cascade,
  title text,
  subtitle text,
  description text,
  hero_image_url text,
  gallery jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  cta_primary_label text,
  cta_primary_url text,
  cta_secondary_label text,
  cta_secondary_url text,
  age_min integer,
  age_max integer,
  form_url text,
  detail_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_showcase_age_idx
  on public.partner_showcase (age_min, age_max);
