-- Add bio field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
