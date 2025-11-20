-- Extend reward limits with daily cap
alter table if exists public.rewards
  add column if not exists daily_redemption_limit integer;

comment on column public.rewards.daily_redemption_limit is 'Maximum redemptions per calendar day';
