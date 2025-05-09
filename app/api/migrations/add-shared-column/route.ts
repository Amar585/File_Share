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
    
    // SQL to add shared column if it doesn't exist
    const addSharedColumnSQL = `
    DO $$
    BEGIN
      -- Check if the column exists
      IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'files' 
        AND column_name = 'shared'
      ) THEN
        -- Add the column with a default value of false
        ALTER TABLE public.files ADD COLUMN shared BOOLEAN DEFAULT false;
        
        -- Create an index on the shared column for better query performance
        CREATE INDEX IF NOT EXISTS idx_files_shared ON public.files(shared);
        
        -- Update RLS policy for files to allow access to shared files
        DROP POLICY IF EXISTS "Users can view own files" ON public.files;
        CREATE POLICY "Users can view own files" 
          ON public.files FOR SELECT 
          USING (auth.uid() = user_id OR shared = true);
        
        -- Create a policy to access files storage for shared files
        DROP POLICY IF EXISTS "Allow users to download shared files" ON storage.objects;
        CREATE POLICY "Allow users to download shared files" 
          ON storage.objects FOR SELECT 
          USING (
            bucket_id = 'files' AND 
            EXISTS (
              SELECT 1 FROM public.files
              WHERE 
                storage.foldername(storage.objects.name)[1] = files.user_id::text AND
                position(files.path in storage.objects.name) > 0 AND
                files.shared = true
            )
          );
      END IF;
    END
    $$;
    `
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', {
      query: addSharedColumnSQL
    })
    
    if (error) {
      console.error('Error adding shared column:', error)
      return NextResponse.json({ 
        success: false, 
        message: `Failed to add shared column: ${error.message}` 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'The shared column has been added to the files table'
    })
  } catch (error: any) {
    console.error('Error in migration:', error)
    return NextResponse.json({ 
      success: false, 
      message: `Migration failed: ${error.message}`
    }, { status: 500 })
  }
} 