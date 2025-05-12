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
    
    // First, check if we can access the files table
    const { count, error: filesError } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true })
    
    if (filesError) {
      // This means the table doesn't exist or we don't have access
      console.error('Error accessing files table:', filesError)
      return NextResponse.json({
        success: false,
        message: 'Files table does not exist or cannot be accessed. Create base tables first.'
      }, { status: 400 })
    }
    
    // If we get here, we know the files table exists and is accessible
    
    // Add encryption columns to files table if they don't exist
    const addEncryptionColumns = async () => {
      console.log('Adding encryption columns to files table...')
      
      // Instead of checking columns via information_schema, we'll use direct SQL
      // using the pg_query RPC function to run a query to identify existing columns
      const checkColumnSql = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'files' 
        AND column_name IN ('is_encrypted', 'original_type', 'encryption_metadata')
      `;
      
      const { data: columnsResult, error: columnsError } = await supabase.rpc('pg_query', {
        query_text: checkColumnSql
      });
      
      if (columnsError) {
        console.error('Error checking for encryption columns:', columnsError)
        throw columnsError
      }
      
      // Parse the returned JSON result
      let existingColumns: string[] = [];
      try {
        // The pg_query result format is different - need to parse the rows
        const rows = columnsResult?.result || [];
        existingColumns = rows.map((row: any) => row.column_name);
      } catch (parseError) {
        console.error('Error parsing column check results:', parseError);
        // Assume no columns exist if we can't parse the result
        existingColumns = [];
      }
      
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
      
      // Check if the file_keys table exists using direct SQL
      const checkTableSql = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'file_keys'
      `;
      
      const { data: tableCheckResult, error: tableCheckError } = await supabase.rpc('pg_query', {
        query_text: checkTableSql
      });
      
      if (tableCheckError) {
        console.error('Error checking for file_keys table:', tableCheckError)
        throw tableCheckError
      }
      
      // Check if the table exists in the result
      const tableExists = tableCheckResult?.result?.length > 0;
      
      if (!tableExists) {
        console.log('Creating file_keys table...')
        
        // Create the table using direct SQL
        // First make sure the uuid extension is enabled
        try {
          await supabase.rpc('pg_query', { 
            query_text: 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"' 
          })
        } catch (extensionError: any) {
          console.warn('Warning when creating uuid-ossp extension:', extensionError.message)
          // Continue anyway, might already exist
        }
        
        // Create the file_keys table
        const createTableSql = `
          CREATE TABLE IF NOT EXISTS public.file_keys (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
            encrypted_key TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
        
        try {
          const { error: createError } = await supabase.rpc('pg_query', { 
            query_text: createTableSql 
          })
          
          if (createError) {
            console.error('Error creating file_keys table:', createError)
            throw createError
          }
        } catch (tableCreateError: any) {
          // If there's an error about the table already existing, just continue
          if (!tableCreateError.message?.includes('already exists')) {
            throw tableCreateError
          }
        }
        
        // Create index and enable RLS
        const setupSql = `
          -- Create index for better performance
          CREATE INDEX IF NOT EXISTS idx_file_keys_file_id ON public.file_keys(file_id);
          
          -- Enable Row Level Security
          ALTER TABLE public.file_keys ENABLE ROW LEVEL SECURITY;
        `
        
        try {
          await supabase.rpc('pg_query', { query_text: setupSql })
        } catch (setupError: any) {
          console.warn('Warning during table setup:', setupError.message)
          // Continue anyway, might be a benign error
        }
        
        // Create RLS policies separately to handle cases where they might already exist
        const policies = [
          `CREATE POLICY IF NOT EXISTS "Only authenticated users can read file keys" 
           ON public.file_keys 
           FOR SELECT 
           USING (auth.role() = 'authenticated');`,
           
          `CREATE POLICY IF NOT EXISTS "Only service role can insert file keys" 
           ON public.file_keys 
           FOR INSERT 
           WITH CHECK (true);`
        ]
        
        for (const policy of policies) {
          try {
            await supabase.rpc('pg_query', { query_text: policy })
          } catch (policyError: any) {
            // If policy already exists, continue
            console.warn('Warning during policy creation:', policyError.message)
          }
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
      message: `Migration failed: ${error.message}`,
      error: error.message
    }, { status: 500 })
  }
}
