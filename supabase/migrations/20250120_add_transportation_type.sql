-- Add transportation subtype for transport partners
begin;

alter table if exists public.partners
  add column if not exists transportation_type text;

update public.partners
  set transportation_type = 'taxi'
  where type = 'transport' and coalesce(transportation_type, '') = '';

alter table if exists public.partners
  drop constraint if exists partners_transportation_type_check;

alter table if exists public.partners
  add constraint partners_transportation_type_check
  check (
    transportation_type is null
    or transportation_type in ('taxi', 'bus', 'limousine')
  );

alter table if exists public.partners
  drop constraint if exists partners_transportation_type_required;

alter table if exists public.partners
  add constraint partners_transportation_type_required
  check (
    type <> 'transport' or transportation_type is not null
  );

commit;
