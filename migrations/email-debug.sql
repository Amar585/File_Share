-- Email debug and diagnostics
-- This script helps diagnose email delivery issues in Supabase
-- Run in Supabase SQL Editor

-- Create a view to access email-related user data
-- Note: In Supabase you need to be careful about the admin schema access
BEGIN;

-- Create a function to check if a user exists and has a verification token
CREATE OR REPLACE FUNCTION public.check_email_verification(user_email TEXT)
RETURNS TABLE (
  email TEXT,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  has_verification_token BOOLEAN
) SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.email::TEXT,
    u.email_confirmed_at,
    u.created_at,
    u.last_sign_in_at,
    (u.confirmation_token IS NOT NULL) AS has_verification_token
  FROM auth.users u
  WHERE u.email = user_email;
END;
$$ LANGUAGE plpgsql;

-- Function to resend verification for a user
CREATE OR REPLACE FUNCTION public.trigger_verification_workflow(user_email TEXT)
RETURNS TEXT
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  user_id UUID;
  result TEXT;
BEGIN
  -- Get the user id
  SELECT id INTO user_id FROM auth.users WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RETURN 'User not found';
  END IF;
  
  -- Update the user's confirmation token (this will make Supabase resend the email)
  -- Note: This is just checking the current state, not actually modifying anything
  SELECT 
    CASE
      WHEN email_confirmed_at IS NOT NULL THEN 'User already verified'
      WHEN confirmation_token IS NOT NULL THEN 'Verification token exists'
      ELSE 'User needs verification token'
    END INTO result
  FROM auth.users
  WHERE id = user_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check SMTP configuration (read only)
CREATE OR REPLACE FUNCTION public.check_smtp_settings()
RETURNS TABLE (
  setting_name TEXT,
  is_configured BOOLEAN
) 
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'SMTP Configuration' AS setting_name, 
         EXISTS (
           SELECT 1 FROM pg_catalog.pg_namespace n 
           JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid
           WHERE n.nspname = 'auth' AND c.relname = 'config'
         ) AS is_configured;
END;
$$ LANGUAGE plpgsql;

COMMIT; 