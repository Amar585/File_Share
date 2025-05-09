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

    // Update RLS policies for the files bucket
    // First, get the policies
    const { data: policies, error: policiesError } = await supabase.rpc('get_policies')
    
    if (policiesError) {
      console.error('Error getting policies:', policiesError)
      
      // Try creating access policies directly
      try {
        await createStoragePolicies(supabase)
        return NextResponse.json({ 
          success: true, 
          message: 'Storage access policies created successfully',
        })
      } catch (policyCreateError: any) {
        return NextResponse.json({ 
          success: false, 
          message: `Error creating storage policies: ${policyCreateError.message}`,
          error: policyCreateError
        }, { status: 500 })
      }
    }
    
    // Check if storage policies exist
    const hasPolicies = Array.isArray(policies) && 
      policies.some(p => p.table === 'objects' && p.schema === 'storage')
    
    if (!hasPolicies) {
      await createStoragePolicies(supabase)
    }
    
    // Enable public access to bucket
    const { error: updateError } = await supabase.storage
      .updateBucket('files', {
        public: true,
        allowedMimeTypes: ['*/*'],
        fileSizeLimit: 52428800 // 50MB
      })
    
    if (updateError) {
      console.error('Error updating bucket:', updateError)
      throw updateError
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Storage access enabled',
    })
  } catch (error: any) {
    console.error('Error enabling storage access:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: `Failed to enable storage access: ${error.message}` 
      },
      { status: 500 }
    )
  }
}

async function createStoragePolicies(supabase: any) {
  // Enable authenticated users to upload and read files
  const queries = [
    // Allow anyone to read files
    `
    CREATE POLICY "Anyone can read storage objects" 
    ON storage.objects FOR SELECT USING (true);
    `,
    // Allow users to upload files
    `
    CREATE POLICY "Users can upload their own files" 
    ON storage.objects FOR INSERT TO authenticated 
    WITH CHECK (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);
    `,
    // Allow users to update their own files
    `
    CREATE POLICY "Users can update their own files" 
    ON storage.objects FOR UPDATE TO authenticated 
    USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);
    `,
    // Allow users to delete their own files
    `
    CREATE POLICY "Users can delete their own files" 
    ON storage.objects FOR DELETE TO authenticated 
    USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);
    `
  ]
  
  // Execute each policy query
  for (const query of queries) {
    try {
      await supabase.rpc('exec_sql', { query })
    } catch (policyError: any) {
      // Policy might already exist - this is okay
      console.warn('Policy creation warning:', policyError.message)
    }
  }
} 