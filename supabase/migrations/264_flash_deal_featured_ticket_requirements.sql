-- Add featured toggle, banner lead time, and ticket requirements to flash deals
alter table public.flash_deals
  add column if not exists is_featured boolean not null default false,
  add column if not exists banner_lead_hours integer not null default 0,
  add column if not exists ticket_requirements jsonb;

comment on column public.flash_deals.is_featured is 'Show deal on public site listings';
comment on column public.flash_deals.banner_lead_hours is 'Hours before expiry to surface banners';
comment on column public.flash_deals.ticket_requirements is 'Array of { ticketType, quantity } rules';
