import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'migration-file-shares' })

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    // Create file_shares table if it doesn't exist
    const { error: createTableError } = await supabase.rpc('execute_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS file_shares (
          id UUID PRIMARY KEY,
          file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
          created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          token UUID NOT NULL,
          has_password BOOLEAN DEFAULT FALSE,
          password TEXT,
          expires_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(id, token)
        );
        
        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON file_shares(file_id);
        CREATE INDEX IF NOT EXISTS idx_file_shares_created_by ON file_shares(created_by);
      `
    })
    
    if (createTableError) {
      // If execute_sql is not available, try direct SQL
      log.warn('execute_sql function not found, trying direct SQL', { error: createTableError })
      
      // Check if table exists
      const { data: tableExists } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'file_shares')
        .eq('table_schema', 'public')
      
      if (!tableExists || tableExists.length === 0) {
        log.info('file_shares table does not exist, creating it')
        
        // Create the table using direct SQL through Supabase REST API
        const { error: directError } = await supabase.from('_sql').select(`
          CREATE TABLE IF NOT EXISTS public.file_shares (
            id UUID PRIMARY KEY,
            file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
            created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            token UUID NOT NULL,
            has_password BOOLEAN DEFAULT FALSE,
            password TEXT,
            expires_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(id, token)
          );
          
          CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON public.file_shares(file_id);
          CREATE INDEX IF NOT EXISTS idx_file_shares_created_by ON public.file_shares(created_by);
        `)
        
        if (directError) {
          log.error('Error creating file_shares table with direct SQL', { error: directError })
          return NextResponse.json({ 
            success: false, 
            error: 'Failed to create file_shares table', 
            details: directError 
          }, { status: 500 })
        }
      }
    }
    
    // Create RLS policies for the file_shares table
    const { error: policyError } = await supabase.rpc('execute_sql', {
      query: `
        -- Enable Row Level Security
        ALTER TABLE file_shares ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies
        
        -- Policy for selecting all shares created by the user
        DROP POLICY IF EXISTS "Users can view their own shares" ON file_shares;
        CREATE POLICY "Users can view their own shares" 
          ON file_shares 
          FOR SELECT 
          USING (auth.uid() = created_by);
        
        -- Policy for inserting new shares
        DROP POLICY IF EXISTS "Users can create new shares" ON file_shares;
        CREATE POLICY "Users can create new shares" 
          ON file_shares 
          FOR INSERT 
          WITH CHECK (auth.uid() = created_by);
        
        -- Policy for updating shares
        DROP POLICY IF EXISTS "Users can update their own shares" ON file_shares;
        CREATE POLICY "Users can update their own shares" 
          ON file_shares 
          FOR UPDATE 
          USING (auth.uid() = created_by);
        
        -- Policy for deleting shares
        DROP POLICY IF EXISTS "Users can delete their own shares" ON file_shares;
        CREATE POLICY "Users can delete their own shares" 
          ON file_shares 
          FOR DELETE 
          USING (auth.uid() = created_by);
        
        -- For shared access - allow anyone to select a share when verifying
        DROP POLICY IF EXISTS "Anyone can access a shared file with valid token" ON file_shares;
        CREATE POLICY "Anyone can access a shared file with valid token" 
          ON file_shares 
          FOR SELECT 
          USING (true);
      `
    })
    
    if (policyError) {
      log.error('Error creating RLS policies for file_shares table', { error: policyError })
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create RLS policies', 
        details: policyError 
      }, { status: 500 })
    }
    
    // Return success response
    return NextResponse.json({ 
      success: true, 
      message: 'File shares table and policies created successfully' 
    })
    
  } catch (error) {
    log.error('Error in migration', { error })
    return NextResponse.json({ 
      success: false, 
      error: 'Migration failed', 
      details: error 
    }, { status: 500 })
  }
}
