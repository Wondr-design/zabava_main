-- Ensure partner showcase entries track homepage visibility
alter table if exists public.partner_showcase
  add column if not exists is_featured boolean not null default false;

create index if not exists partner_showcase_featured_idx
  on public.partner_showcase (is_featured);
