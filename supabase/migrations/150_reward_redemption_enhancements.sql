-- Reward redemption & points configuration enhancements

-- QR type classification for visits
alter table if exists public.visit_registrations
  add column if not exists qr_type text not null default 'standard'
    check (qr_type in ('standard','bonus')),
  add column if not exists reward_id text references public.rewards(id) on delete set null;

create index if not exists visit_registrations_qr_type_idx on public.visit_registrations (qr_type, created_at desc);

-- Link rewards to dedicated redemption forms
alter table if exists public.rewards
  add column if not exists redemption_form_id uuid references public.partner_forms(id) on delete set null;

-- Expand partner forms with usage type metadata
alter table if exists public.partner_forms
  add column if not exists usage_type text not null default 'visit'
    check (usage_type in ('visit','reward')),
  add column if not exists reward_id text references public.rewards(id) on delete set null;

create index if not exists partner_forms_usage_type_idx on public.partner_forms (usage_type);

-- Track point calculation mode
alter table if exists public.points_history
  add column if not exists source text not null default 'visit'
    check (source in ('visit','reward_redemption','manual_adjustment')),
  add column if not exists note text;

-- Configurable CZK to point ratio
create table if not exists public.point_settings (
  id bigserial primary key,
  ratio_czk numeric(12,2) not null check (ratio_czk > 0),
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists point_settings_created_at_idx on public.point_settings (created_at desc);
