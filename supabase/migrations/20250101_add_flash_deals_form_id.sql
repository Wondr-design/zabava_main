-- Add a nullable form_id to flash_deals to link published deal forms
alter table public.flash_deals
  add column if not exists form_id uuid null;

-- Optional: maintain referential integrity to partner_forms (if the table exists)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'partner_forms'
  ) then
    alter table public.flash_deals
      add constraint flash_deals_form_id_fkey
      foreign key (form_id) references public.partner_forms(id)
      on delete set null;
  end if;
exception
  when duplicate_object then
    null;
end $$;

-- Index for lookups by linked form
create index if not exists flash_deals_form_id_idx on public.flash_deals(form_id);
