-- Adjust reward pricing defaults and add monthly redemption limit
alter table if exists public.rewards
  add column if not exists monthly_redemption_limit integer;

alter table if exists public.rewards
  add column if not exists stock_window_days integer;

alter table if exists public.rewards
  alter column points_cost set default 0,
  drop constraint if exists rewards_points_cost_check,
  add constraint rewards_points_cost_check check (points_cost >= 0);

comment on column public.rewards.monthly_redemption_limit is 'Maximum number of times this reward can be redeemed per calendar month';
comment on column public.rewards.stock_window_days is 'Number of days for rolling stock reset. NULL means entire validity window.';
