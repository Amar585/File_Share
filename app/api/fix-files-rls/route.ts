import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    // Create an admin client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Fix files table RLS policies to ensure shared files are visible
    const filesRlsPolicy = `
    -- Check if the policy exists
    DO $$
    BEGIN
      -- Drop the policy if it exists
      DROP POLICY IF EXISTS "Users can view own files" ON public.files;
      
      -- Create a policy that allows users to view their own files and shared files from others
      CREATE POLICY "Users can view own files" 
      ON public.files FOR SELECT 
      USING (auth.uid() = user_id OR shared = true);
      
      -- Also create storage policy for shared files access
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
      
      -- Enable RLS if not already enabled
      ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
    END
    $$;
    `
    
    const { error: filesRlsError } = await supabase.rpc('exec_sql', {
      query: filesRlsPolicy
    })
    
    if (filesRlsError) {
      console.error('Error updating files RLS policy:', filesRlsError)
      return NextResponse.json({ 
        success: false, 
        message: `Failed to update files RLS policy: ${filesRlsError.message}` 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Files RLS policy fixed successfully. Shared files should now be visible in the browse files section.'
    })
  } catch (error: any) {
    console.error('Error fixing files RLS policy:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: `Failed to fix files RLS policy: ${error.message}` 
      },
      { status: 500 }
    )
  }
} 