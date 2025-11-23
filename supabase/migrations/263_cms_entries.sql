-- CMS entries for public marketing/legal content
create table if not exists public.cms_entries (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  locale text not null default 'en',
  title text not null,
  content jsonb not null default '{}'::jsonb,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, locale)
);

create index if not exists cms_entries_slug_locale_idx
  on public.cms_entries (slug, locale);

create trigger set_cms_entries_updated_at
  before update on public.cms_entries
  for each row execute procedure update_updated_at_column();

