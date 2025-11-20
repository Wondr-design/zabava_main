-- Global reference data for admin-managed classifications

create table if not exists public.global_values (
  id uuid primary key default gen_random_uuid(),
  value_type text not null check (value_type in ('ticket_type', 'category', 'tag')),
  key text not null,
  label text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists global_values_type_key_idx
  on public.global_values (value_type, key);

create index if not exists global_values_type_sort_idx
  on public.global_values (value_type, sort_order, label);

create trigger set_global_values_updated_at
  before update on public.global_values
  for each row execute procedure update_updated_at_column();
