-- Partner type classification and associations
alter table if exists public.partners
  add column if not exists type text not null default 'standard'
    check (type in ('standard', 'transport', 'taxi'));

-- Ensure existing records default to standard
update public.partners
  set type = 'standard'
  where type is null;

create table if not exists public.partner_relationships (
  id bigserial primary key,
  parent_partner_id text not null references public.partners (id) on delete cascade,
  child_partner_id text not null references public.partners (id) on delete cascade,
  relationship text not null check (relationship in ('transport', 'taxi')),
  created_at timestamptz not null default now()
);

create unique index if not exists partner_relationships_parent_child_relationship_idx
  on public.partner_relationships (parent_partner_id, child_partner_id, relationship);

create index if not exists partner_relationships_child_idx
  on public.partner_relationships (child_partner_id);
