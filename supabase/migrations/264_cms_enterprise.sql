-- Enterprise CMS tables for multi-page, multi-locale content

create table if not exists public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.cms_pages(id) on delete cascade,
  locale text not null default 'en',
  version_number integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  summary text,
  created_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, locale, version_number)
);

create table if not exists public.cms_blocks (
  id uuid primary key default gen_random_uuid(),
  page_version_id uuid not null references public.cms_page_versions(id) on delete cascade,
  sort_order integer not null default 0,
  block_type text not null,
  data jsonb not null default '{}'::jsonb,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cms_page_versions_lookup_idx
  on public.cms_page_versions (page_id, locale, status, updated_at desc);

create index if not exists cms_blocks_version_sort_idx
  on public.cms_blocks (page_version_id, sort_order);

create trigger set_cms_pages_updated_at
  before update on public.cms_pages
  for each row execute procedure update_updated_at_column();

create trigger set_cms_page_versions_updated_at
  before update on public.cms_page_versions
  for each row execute procedure update_updated_at_column();

create trigger set_cms_blocks_updated_at
  before update on public.cms_blocks
  for each row execute procedure update_updated_at_column();

