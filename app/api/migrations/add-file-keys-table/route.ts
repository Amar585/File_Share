import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    // Create admin client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Execute SQL to create file_keys table
    const { error: tableError } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS public.file_keys (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
          encrypted_key TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
        );
        
        -- Add a unique constraint on file_id to ensure one key per file
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'file_keys_file_id_key'
          ) THEN
            ALTER TABLE public.file_keys ADD CONSTRAINT file_keys_file_id_key UNIQUE (file_id);
          END IF;
        END$$;
      `
    });

    if (tableError) {
      console.error('Error creating file_keys table:', tableError)
      throw tableError
    }

    // Execute SQL to modify the files table to include encryption metadata
    const { error: filesError } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Add encryption-related columns to files table if they don't exist
        ALTER TABLE public.files 
        ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS original_type TEXT,
        ADD COLUMN IF NOT EXISTS encryption_metadata JSONB DEFAULT '{}'::jsonb;
      `
    });

    if (filesError) {
      console.error('Error updating files table:', filesError)
      throw filesError
    }

    // Set up RLS policies for the file_keys table
    const { error: policyError } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Enable RLS
        ALTER TABLE public.file_keys ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for users to view their own file keys
        CREATE POLICY IF NOT EXISTS "Users can view keys for files they have access to" 
        ON public.file_keys
        FOR SELECT
        TO authenticated
        USING (
          -- User owns the file OR the file is shared
          EXISTS (
            SELECT 1 FROM public.files
            WHERE files.id = file_keys.file_id
            AND (files.user_id = auth.uid() OR files.shared = true)
          )
        );
        
        -- Create policy for inserting file keys
        CREATE POLICY IF NOT EXISTS "Users can insert keys for their own files" 
        ON public.file_keys
        FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.files
            WHERE files.id = file_keys.file_id
            AND files.user_id = auth.uid()
          )
        );
      `
    });

    if (policyError) {
      console.error('Error setting up RLS policies:', policyError)
      throw policyError
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully created file_keys table and updated files table'
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      message: `Migration failed: ${error.message}`
    }, { status: 500 })
  }
}
