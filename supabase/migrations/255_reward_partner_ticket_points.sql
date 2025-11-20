-- Add ticket_points payload to reward partner visibility to support per-partner ticket pricing
alter table if exists public.reward_partner_visibility
  add column if not exists ticket_points jsonb;

-- points_cost remains for backward compatibility but is no longer used
