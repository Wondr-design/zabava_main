-- Ensure required extensions exist for Supabase Postgres
create extension if not exists "pgcrypto";
create extension if not exists "citext";
