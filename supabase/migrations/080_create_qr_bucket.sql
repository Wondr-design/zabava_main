-- Create the storage bucket used for hosting QR codes
insert into storage.buckets (id, name, public)
values ('qr-codes', 'QR codes', false)
on conflict (id) do nothing;

-- Create the storage bucket for profile assets
insert into storage.buckets (id, name, public)
values ('profile-assets', 'Profile assets', false)
on conflict (id) do nothing;

-- Create the storage bucket for public assets (images, media)
insert into storage.buckets (id, name, public)
values ('public-assets', 'Public assets', true)
on conflict (id) do nothing;

-- Allow service role to manage all storage assets
drop policy if exists "Service role full access" on storage.objects;
create policy "Service role full access"
on storage.objects for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Allow public read access to public-assets bucket
drop policy if exists "Public read access for public-assets" on storage.objects;
create policy "Public read access for public-assets"
on storage.objects for select
using (bucket_id = 'public-assets');

-- Optional: allow partners to fetch their own QR codes via signed URLs only
-- Signed URLs do not require extra policies; if you later need public access,
-- create appropriate read policies here.
