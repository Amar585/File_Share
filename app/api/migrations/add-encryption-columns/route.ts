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

    // Execute SQL to add encryption-related columns
    const { error } = await supabase.rpc('execute_sql', {
      sql_query: `
        ALTER TABLE public.files 
        ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS original_type TEXT,
        ADD COLUMN IF NOT EXISTS encryption_metadata JSONB DEFAULT '{}'::jsonb;
      `
    })

    if (error) {
      console.error('Error adding encryption columns:', error)
      throw error
    }

    // Update RLS policies to allow access to the new columns
    const { error: policyError } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Users can view their own files" ON "public"."files";
        
        -- Create new policy with updated columns
        CREATE POLICY "Users can view their own files" 
        ON "public"."files"
        FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
        
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Users can insert their own files" ON "public"."files";
        
        -- Create new policy with updated columns
        CREATE POLICY "Users can insert their own files" 
        ON "public"."files"
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);
        
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Users can update their own files" ON "public"."files";
        
        -- Create new policy with updated columns
        CREATE POLICY "Users can update their own files" 
        ON "public"."files"
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id);
        
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Users can delete their own files" ON "public"."files";
        
        -- Create new policy with updated columns
        CREATE POLICY "Users can delete their own files" 
        ON "public"."files"
        FOR DELETE
        TO authenticated
        USING (auth.uid() = user_id);
      `
    })

    if (policyError) {
      console.error('Error updating RLS policies:', policyError)
      throw policyError
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully added encryption columns to files table and updated RLS policies'
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      message: `Migration failed: ${error.message}`
    }, { status: 500 })
  }
}
