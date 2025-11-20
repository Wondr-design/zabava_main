-- Extend global value type whitelist to cover new catalogs

alter table public.global_values
  drop constraint if exists global_values_value_type_check;

alter table public.global_values
  add constraint global_values_value_type_check
  check (
    value_type in (
      'ticket_type',
      'category',
      'tag',
      'listing_tier',
      'cash_currency',
      'accepted_payment',
      'facility'
    )
  );
