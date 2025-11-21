-- Add structure column to email_templates table for visual template builder
alter table public.email_templates
add column if not exists structure jsonb;

comment on column public.email_templates.structure is 'JSON structure defining email template elements, their order, and visibility settings';

