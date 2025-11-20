-- reward metadata extensions
alter table rewards
  add column if not exists age_groups text[] default '{}'::text[] not null,
  add column if not exists tags text[] default '{}'::text[] not null,
  add column if not exists savings_value numeric default 0,
  add column if not exists hero_images text[] default '{}'::text[] not null,
  add column if not exists partner_logo_url text;
