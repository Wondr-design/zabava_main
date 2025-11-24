-- Store the timezone that governs valid-day checks for each flash deal.
alter table public.flash_deals
  add column if not exists time_zone text not null default 'Europe/Prague';

comment on column public.flash_deals.time_zone is
  'IANA timezone identifier that describes how valid_days should be evaluated.';

create index if not exists flash_deals_time_zone_idx on public.flash_deals(time_zone);
