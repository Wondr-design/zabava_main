-- Remove taxi partner type and relationships
begin;

-- Delete taxi relationships first
delete from public.partner_relationships
  where relationship = 'taxi';

-- Delete taxi partners (cascades to child relationships)
delete from public.partners
  where type = 'taxi';

-- Refresh relationship constraint to allow only transport
alter table if exists public.partner_relationships
  drop constraint if exists partner_relationships_relationship_check;

alter table if exists public.partner_relationships
  add constraint partner_relationships_relationship_check
  check (relationship in ('transport'));

-- Refresh partner type constraint to drop taxi option
alter table if exists public.partners
  drop constraint if exists partners_type_check;

alter table if exists public.partners
  add constraint partners_type_check
  check (type in ('standard', 'transport'));

commit;
