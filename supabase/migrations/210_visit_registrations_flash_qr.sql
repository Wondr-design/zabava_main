-- Allow flash deal QR registrations
alter table public.visit_registrations
  drop constraint if exists visit_registrations_qr_type_check;

alter table public.visit_registrations
  add constraint visit_registrations_qr_type_check
    check (qr_type in ('standard','bonus','flash','transport'));
