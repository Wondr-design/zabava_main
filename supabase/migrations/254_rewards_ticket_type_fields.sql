-- Extend rewards with ticket type, availability, and transport flags

alter table public.rewards
  add column if not exists ticket_type text not null default 'general';

alter table public.rewards
  add column if not exists is_available boolean not null default true;

alter table public.rewards
  add column if not exists transport_included boolean not null default false;

