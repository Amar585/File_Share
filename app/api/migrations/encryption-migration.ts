import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * This migration script adds the necessary columns to the files table for encryption
 * and creates the file_keys table if it doesn't exist yet.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    // Create admin client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    console.log('Running file encryption migration...')
    
    // Check if files table exists
    const { data: tablesData, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'files')
    
    if (tablesError) {
      console.error('Error checking for files table:', tablesError)
      throw tablesError
    }
    
    if (!tablesData || tablesData.length === 0) {
      console.error('Files table does not exist!')
      return NextResponse.json({
        success: false,
        message: 'Files table does not exist. Create base tables first.'
      }, { status: 400 })
    }
    
    // Add encryption columns to files table if they don't exist
    const addEncryptionColumns = async () => {
      console.log('Adding encryption columns to files table...')
      
      // Check if the columns already exist
      const { data: columnsData, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'files')
        .in('column_name', ['is_encrypted', 'original_type', 'encryption_metadata'])
      
      if (columnsError) {
        console.error('Error checking for encryption columns:', columnsError)
        throw columnsError
      }
      
      const existingColumns = columnsData?.map(col => col.column_name) || []
      
      // Add missing columns
      const columnsToAdd = []
      
      if (!existingColumns.includes('is_encrypted')) {
        columnsToAdd.push(`ALTER TABLE public.files ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;`)
      }
      
      if (!existingColumns.includes('original_type')) {
        columnsToAdd.push(`ALTER TABLE public.files ADD COLUMN IF NOT EXISTS original_type TEXT;`)
      }
      
      if (!existingColumns.includes('encryption_metadata')) {
        columnsToAdd.push(`ALTER TABLE public.files ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;`)
      }
      
      if (columnsToAdd.length > 0) {
        // Execute each column addition
        for (const sqlStatement of columnsToAdd) {
          const { error } = await supabase.rpc('pg_query', { query_text: sqlStatement })
          if (error) {
            console.error(`Error executing SQL: ${sqlStatement}`, error)
            throw error
          }
        }
        console.log('Successfully added encryption columns to files table')
      } else {
        console.log('All encryption columns already exist in files table')
      }
    }
    
    // Create file_keys table if it doesn't exist
    const createFileKeysTable = async () => {
      console.log('Checking file_keys table...')
      
      const { data: keysTableData, error: keysTableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'file_keys')
      
      if (keysTableError) {
        console.error('Error checking for file_keys table:', keysTableError)
        throw keysTableError
      }
      
      if (!keysTableData || keysTableData.length === 0) {
        console.log('Creating file_keys table...')
        
        // Create the table
        const createTableSql = `
          CREATE TABLE IF NOT EXISTS public.file_keys (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
            encrypted_key TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- Create index for better performance
          CREATE INDEX IF NOT EXISTS idx_file_keys_file_id ON public.file_keys(file_id);
          
          -- Enable Row Level Security
          ALTER TABLE public.file_keys ENABLE ROW LEVEL SECURITY;
          
          -- Create RLS policies
          -- Only service role can read file keys
          CREATE POLICY IF NOT EXISTS "Only authenticated users can read file keys" 
            ON public.file_keys 
            FOR SELECT 
            USING (auth.role() = 'authenticated');
            
          -- Only service role can insert file keys
          CREATE POLICY IF NOT EXISTS "Only service role can insert file keys" 
            ON public.file_keys 
            FOR INSERT 
            WITH CHECK (true);
        `
        
        const { error } = await supabase.rpc('pg_query', { query_text: createTableSql })
        if (error) {
          console.error('Error creating file_keys table:', error)
          throw error
        }
        
        console.log('Successfully created file_keys table')
      } else {
        console.log('File_keys table already exists')
      }
    }
    
    // Run migrations
    await addEncryptionColumns()
    await createFileKeysTable()
    
    return NextResponse.json({
      success: true,
      message: 'File encryption migration completed successfully'
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      message: `Migration failed: ${error.message}`
    }, { status: 500 })
  }
}
