-- Partner-specific reward configuration
-- Allow different forms and points costs per partner

alter table public.reward_partner_visibility
  add column if not exists form_id uuid references public.partner_forms(id) on delete set null,
  add column if not exists points_cost integer check (points_cost is null or points_cost >= 1);

-- Ticket points pricing for rewards (similar to ticket pricing in visit forms)
alter table public.rewards
  add column if not exists ticket_points jsonb default '[]'::jsonb;

create index if not exists reward_partner_visibility_form_idx on public.reward_partner_visibility (form_id);

comment on column public.reward_partner_visibility.form_id is 'Partner-specific redemption form. If null, uses reward.redemption_form_id';
comment on column public.reward_partner_visibility.points_cost is 'Partner-specific points cost. If null, uses reward.points_cost or ticket_points';
comment on column public.rewards.ticket_points is 'Array of {ticketType, label, points} for ticket-based point pricing';

