-- Extend rewards with valid from date and availability date visibility option

alter table public.rewards
  add column if not exists valid_from timestamptz;

alter table public.rewards
  add column if not exists show_availability_date boolean not null default false;

create index if not exists rewards_valid_from_idx on public.rewards (valid_from);

