-- Create the storage bucket used for hosting QR codes
insert into storage.buckets (id, name, public)
values ('qr-codes', 'QR codes', false)
on conflict (id) do nothing;

-- Allow service role to manage QR assets
create policy if not exists "Service role full access"
on storage.objects for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Optional: allow partners to fetch their own QR codes via signed URLs only
-- Signed URLs do not require extra policies; if you later need public access,
-- create appropriate read policies here.
