-- Extend partner forms to support deal-based workflows

-- Allow usage_type to include deal forms
alter table public.partner_forms
  add column if not exists deal_id uuid references public.flash_deals(id) on delete set null;

alter table public.partner_forms
  drop constraint if exists partner_forms_usage_type_check;

alter table public.partner_forms
  add constraint partner_forms_usage_type_check
    check (usage_type in ('visit','reward','deal'));

create index if not exists partner_forms_deal_id_idx on public.partner_forms (deal_id);
