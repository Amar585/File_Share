import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // SQL to check if the column exists and add it if missing
    const checkAddColumnSQL = `
    DO $$
    BEGIN
      -- Check if 'shared' column exists in 'files' table
      IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'files' AND column_name = 'shared'
      ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE public.files ADD COLUMN shared BOOLEAN DEFAULT false;
        
        -- Update existing rows to set shared = false
        UPDATE public.files SET shared = false WHERE shared IS NULL;
        
        RAISE NOTICE 'Added shared column to files table';
      ELSE
        RAISE NOTICE 'shared column already exists in files table';
      END IF;
    END $$;
    `
    
    const { error } = await supabase.rpc('exec_sql', { query: checkAddColumnSQL })
    
    if (error) {
      console.error('Error adding shared column:', error)
      return NextResponse.json({ 
        success: false, 
        message: `Error adding shared column: ${error.message}` 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Shared column checked/added successfully' 
    })
  } catch (error: any) {
    console.error('Error updating database schema:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: `Failed to update database schema: ${error.message}` 
      },
      { status: 500 }
    )
  }
} 