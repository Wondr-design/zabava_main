-- Extend partner categories with card content for embeds
alter table if exists public.partner_categories
  add column if not exists card_content jsonb not null default '{}'::jsonb;

