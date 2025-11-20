-- Remove the hardcoded category constraint to allow flexible categories from global values
-- The application now uses a flexible category system via global_values table
-- This constraint was defined in 070_rewards.sql and restricts categories to:
-- 'discount','freebie','experience','merchandise','other'

-- Drop the constraint by name (PostgreSQL auto-generates this name)
alter table public.rewards
  drop constraint if exists rewards_category_check;

-- If the constraint has a different name, we can also find and drop it dynamically
-- This handles edge cases where the constraint might have been manually renamed
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.rewards'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%category%'
    and pg_get_constraintdef(oid) like '%discount%';
  
  if constraint_name is not null then
    execute format('alter table public.rewards drop constraint %I', constraint_name);
  end if;
end $$;

