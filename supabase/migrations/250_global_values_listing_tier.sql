-- Expand global values to support listing tiers used for partner ranking
alter table if exists public.global_values
  drop constraint if exists global_values_value_type_check;

alter table if exists public.global_values
  add constraint global_values_value_type_check
  check (value_type in ('ticket_type', 'category', 'tag', 'listing_tier'));

alter table if exists public.partners
  add column if not exists listing_tier_key text;

create index if not exists partners_listing_tier_key_idx
  on public.partners (listing_tier_key);
