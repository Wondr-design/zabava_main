-- Rewards catalog for bonus program
create table if not exists public.rewards (
  id text primary key,
  name text not null,
  description text not null default ''::text,
  points_cost integer not null check (points_cost >= 1),
  category text not null check (category in ('discount','freebie','experience','merchandise','other')),
  stock integer check (stock >= 0),
  image_url text,
  redemption_instructions text,
  valid_until timestamptz,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.reward_partner_visibility (
  reward_id text references public.rewards(id) on delete cascade,
  partner_id text references public.partners(id) on delete cascade,
  primary key (reward_id, partner_id)
);

create index if not exists rewards_status_idx on public.rewards (status);
create index if not exists rewards_valid_until_idx on public.rewards (valid_until);
create index if not exists reward_partner_visibility_partner_idx on public.reward_partner_visibility (partner_id);
