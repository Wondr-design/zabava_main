-- Email templates store for Resend/React Email content
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null,
  locale text not null default 'en',
  subject text not null,
  body text not null,
  description text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_type, locale)
);

comment on table public.email_templates is 'Customizable email templates for system notifications';
comment on column public.email_templates.template_type is 'Template key (qr_delivery, visit_confirmed, visit_updated, invite_partner, invite_staff, verification_code, billing_report)';
comment on column public.email_templates.locale is 'Locale for the template (e.g., en, cs)';
comment on column public.email_templates.subject is 'Email subject for this template and locale';
comment on column public.email_templates.body is 'Email body markdown/plaintext for this template and locale';
