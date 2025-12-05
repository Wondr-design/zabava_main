-- Ensure required extensions exist for Supabase Postgres
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Common utility function to auto-update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
