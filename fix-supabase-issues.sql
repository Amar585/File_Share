-- SQL script to fix cascade deletion and other common Supabase issues
-- Run this in your Supabase SQL Editor

-- Part 1: Fix foreign key constraints with missing ON DELETE CASCADE
-- First, check the existing constraint
SELECT tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'profiles'
  AND kcu.column_name = 'id';

-- Drop existing foreign key constraint on profiles table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'profiles'
    AND ccu.column_name = 'id'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
  END IF;
END $$;

-- Add new foreign key with ON DELETE CASCADE
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Part 2: Fix any other tables that might have the same issue
-- Find all foreign keys that might need CASCADE
SELECT tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND rc.delete_rule <> 'CASCADE'
  AND ccu.table_name IN ('profiles', 'users');

-- Part 3: Clean up orphaned profiles (profiles without users)
DELETE FROM public.profiles
WHERE id NOT IN (
  SELECT id FROM auth.users
);

-- Part 4: Enable RLS and add policies if needed
-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create/update RLS policies for profiles
-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow users to view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;

-- Create read policy
CREATE POLICY "Allow users to view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Create update policy
CREATE POLICY "Allow users to update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- Part 5: Check and update email templates
-- Note: You can't update email templates via SQL, must use dashboard
-- This query just provides info about existing templates
SELECT * FROM auth.mfa_factors LIMIT 1;  -- Just checking if auth schema is accessible

-- Part 6: Cleanup - Delete unverified users older than 7 days
-- This requires a manual process or edge function
-- But can be used as reference

-- Verify that our constraints are configured correctly
SELECT tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'profiles'; 