-- Partner billing settings for statements and auto-send
create table if not exists public.partner_billing_settings (
  partner_id text primary key references public.partners(id) on delete cascade,
  billing_email text,
  auto_send_enabled boolean not null default false,
  auto_send_day integer not null default 1,
  listing_fee_amount numeric not null default 0,
  listing_fee_currency text not null default 'CZK',
  commission_basis text not null default 'discounted',
  last_sent_at timestamptz,
  next_scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.partner_billing_settings is 'Per-partner billing preferences';
comment on column public.partner_billing_settings.billing_email is 'Email to receive billing statements';
comment on column public.partner_billing_settings.auto_send_enabled is 'Whether statements are auto-sent monthly';
comment on column public.partner_billing_settings.auto_send_day is 'Day of month for auto-send (1-28)';
comment on column public.partner_billing_settings.listing_fee_amount is 'Recurring listing fee amount charged to partner per period';
comment on column public.partner_billing_settings.listing_fee_currency is 'Currency for listing fee and commissions';
comment on column public.partner_billing_settings.commission_basis is 'commission basis: discounted or original';
