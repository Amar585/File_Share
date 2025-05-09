import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    )
    
    // Apply the missing shared column migration
    const sharedColumnMigration = `
    -- Add shared column to files table if it doesn't exist
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'files' AND column_name = 'shared'
      ) THEN
        ALTER TABLE public.files ADD COLUMN shared BOOLEAN DEFAULT false;
        
        -- Update any existing rows to have shared = false
        UPDATE public.files SET shared = false WHERE shared IS NULL;
      END IF;
    END $$;
    `
    
    const { error } = await supabase.rpc('exec_sql', {
      query: sharedColumnMigration
    })
    
    if (error) {
      console.error('Error applying migration:', error)
      throw error
    }
    
    // Create notifications table and user_settings if they don't exist
    const notificationsTableMigration = `
    -- Create notifications table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read BOOLEAN DEFAULT FALSE,
      metadata JSONB
    );

    -- Create user_settings table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.user_settings (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      private_files_by_default BOOLEAN DEFAULT TRUE,
      require_approval_for_access BOOLEAN DEFAULT TRUE,
      email_notifications_enabled BOOLEAN DEFAULT TRUE,
      push_notifications_enabled BOOLEAN DEFAULT TRUE,
      language VARCHAR(50) DEFAULT 'english',
      notification_types JSONB DEFAULT '{"file_shared": true, "file_downloaded": true, "access_requested": true}'::jsonb
    );

    -- Set up RLS policies for notifications table
    DO $$ 
    BEGIN
      -- Drop any existing policies
      DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
      
      -- Enable RLS on the table
      ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for notifications
      CREATE POLICY "Users can view their own notifications" 
      ON public.notifications FOR SELECT 
      USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can update their own notifications" 
      ON public.notifications FOR UPDATE 
      USING (auth.uid() = user_id);
      
      -- Add INSERT policy for notifications
      CREATE POLICY "Users can insert their own notifications" 
      ON public.notifications FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
      
      -- Add DELETE policy for notifications 
      CREATE POLICY "Users can delete their own notifications" 
      ON public.notifications FOR DELETE 
      USING (auth.uid() = user_id);
    END $$;
    
    -- Create function to initialize user settings on user creation if it doesn't exist
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, full_name)
      VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name'
      );
      
      INSERT INTO public.user_settings (id)
      VALUES (NEW.id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Backfill existing users without settings
    INSERT INTO public.user_settings (id)
    SELECT id FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.user_settings);
    `
    
    const { error: notificationsError } = await supabase.rpc('exec_sql', {
      query: notificationsTableMigration
    })
    
    if (notificationsError) {
      console.error('Error creating notifications table:', notificationsError)
      // Continue anyway
    }
    
    // Create file access requests table if it doesn't exist
    const fileAccessRequestsMigration = `
    -- Create file_access_requests table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.file_access_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
      requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending' NOT NULL,
      message TEXT NOT NULL,
      response_message TEXT,
      responded_at TIMESTAMP WITH TIME ZONE
    );

    -- Set up RLS policies for file_access_requests table
    DO $$ 
    BEGIN
      -- Drop any existing policies
      DROP POLICY IF EXISTS "Users can view their own requests" ON public.file_access_requests;
      DROP POLICY IF EXISTS "Users can view requests for their files" ON public.file_access_requests;
      DROP POLICY IF EXISTS "Users can create requests" ON public.file_access_requests;
      DROP POLICY IF EXISTS "Users can update their own requests" ON public.file_access_requests;
      DROP POLICY IF EXISTS "File owners can update requests" ON public.file_access_requests;
      
      -- Enable RLS on the table
      ALTER TABLE public.file_access_requests ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for file_access_requests
      -- Users can view requests they've made
      CREATE POLICY "Users can view their own requests" 
      ON public.file_access_requests FOR SELECT 
      USING (auth.uid() = requester_id);
      
      -- Users can view requests for files they own
      CREATE POLICY "Users can view requests for their files" 
      ON public.file_access_requests FOR SELECT 
      USING (auth.uid() = owner_id);
      
      -- Users can create new access requests
      CREATE POLICY "Users can create requests" 
      ON public.file_access_requests FOR INSERT 
      WITH CHECK (auth.uid() = requester_id);
      
      -- Users can update their own requests (e.g., cancel them)
      CREATE POLICY "Users can update their own requests" 
      ON public.file_access_requests FOR UPDATE 
      USING (auth.uid() = requester_id AND status = 'pending');
      
      -- File owners can update requests (approve/reject)
      CREATE POLICY "File owners can update requests" 
      ON public.file_access_requests FOR UPDATE 
      USING (auth.uid() = owner_id);
    END $$;
    `
    
    const { error: fileAccessRequestsError } = await supabase.rpc('exec_sql', {
      query: fileAccessRequestsMigration
    })
    
    if (fileAccessRequestsError) {
      console.error('Error creating file_access_requests table:', fileAccessRequestsError)
      // Continue anyway
    }
    
    // Update storage policies for file uploads and downloads
    const storagePolicy = `
    -- First, drop any existing policies with these names
    BEGIN;
    DROP POLICY IF EXISTS "Anyone can read storage objects" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to download their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can access their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view own files in storage" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload own files to storage" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update own files in storage" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete own files in storage" ON storage.objects;
    
    -- Now create the new policies
    CREATE POLICY "Allow authenticated users to upload files" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'files' AND auth.role() = 'authenticated');
    
    CREATE POLICY "Allow users to download their own files" 
    ON storage.objects FOR SELECT 
    USING (
      bucket_id = 'files' AND 
      ((storage.foldername(name))[1] = auth.uid()::text 
      OR auth.role() = 'service_role')
    );
    
    CREATE POLICY "Users can update their own files" 
    ON storage.objects FOR UPDATE 
    USING (
      bucket_id = 'files' AND 
      (storage.foldername(name))[1] = auth.uid()::text
    );
    
    CREATE POLICY "Users can delete their own files" 
    ON storage.objects FOR DELETE 
    USING (
      bucket_id = 'files' AND 
      (storage.foldername(name))[1] = auth.uid()::text
    );
    COMMIT;
    `
    
    const { error: policyError } = await supabase.rpc('exec_sql', {
      query: storagePolicy
    })
    
    if (policyError) {
      console.error('Error updating storage policy:', policyError)
      // Continue anyway
    }
    
    // Fix files table RLS policies to ensure shared files are visible
    const filesRlsPolicy = `
    -- Drop and recreate the file visibility policy to ensure shared files are visible
    DROP POLICY IF EXISTS "Users can view own files" ON public.files;
    
    -- Create a policy that allows users to view their own files and shared files from others
    CREATE POLICY "Users can view own files" 
    ON public.files FOR SELECT 
    USING (auth.uid() = user_id OR shared = true);
    `
    
    const { error: filesRlsError } = await supabase.rpc('exec_sql', {
      query: filesRlsPolicy
    })
    
    if (filesRlsError) {
      console.error('Error updating files RLS policy:', filesRlsError)
      // Continue anyway
    }
    
    return NextResponse.json({
      success: true,
      message: 'Migrations applied successfully'
    })
  } catch (error: any) {
    console.error('Error applying migrations:', error)
    return NextResponse.json({
      success: false,
      message: `Error applying migrations: ${error.message}`
    }, { status: 500 })
  }
}