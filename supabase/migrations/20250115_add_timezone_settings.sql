-- Track the preferred timezone configuration that drives flash deals and other global workflows.
create table if not exists public.timezone_settings (
  id serial primary key,
  admin_time_zone text not null,
  source text not null check (source in ('admin','partner')),
  created_by text null,
  created_at timestamptz not null default now()
);

create index if not exists timezone_settings_created_at_idx on public.timezone_settings(created_at desc nulls last);
