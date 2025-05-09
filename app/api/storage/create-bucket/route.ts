import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This route will create the required storage bucket
export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Check if the bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      throw listError
    }
    
    // Create the bucket if it doesn't exist
    if (!buckets?.some(bucket => bucket.name === 'files')) {
      const { error: createError } = await supabase.storage.createBucket('files', {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024 // 50MB - reduced size to avoid errors
      })
      
      if (createError) {
        console.error('Error creating bucket:', createError)
        throw createError
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Storage bucket created successfully' 
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Storage bucket already exists' 
    })
  } catch (error: any) {
    console.error('Error in storage bucket creation:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: `Failed to create storage bucket: ${error.message}` 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Get the bucket name from request body
    const { name } = await request.json()
    
    if (!name) {
      return NextResponse.json({ 
        success: false, 
        message: 'Bucket name is required' 
      }, { status: 400 })
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    // Create admin client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      throw listError
    }
    
    if (buckets?.some(bucket => bucket.name === name)) {
      return NextResponse.json({ 
        success: true, 
        message: `Bucket '${name}' already exists` 
      })
    }
    
    // Create the bucket with admin privileges
    const { error: createError } = await supabase.storage.createBucket(name, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024 // 50MB
    })
    
    if (createError) {
      throw createError
    }
    
    // Set up proper policies for the bucket
    const setUpPoliciesSQL = `
    DO $$
    BEGIN
      -- Drop existing policies (if any)
      DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
      DROP POLICY IF EXISTS "Allow users to download their own files" ON storage.objects;
      DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
      DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
      
      -- Create policies
      CREATE POLICY "Allow authenticated users to upload files" 
      ON storage.objects FOR INSERT 
      WITH CHECK (bucket_id = '${name}' AND auth.role() = 'authenticated');
      
      CREATE POLICY "Allow users to download their own files" 
      ON storage.objects FOR SELECT 
      USING (
        bucket_id = '${name}' AND 
        ((storage.foldername(name))[1] = auth.uid()::text OR auth.role() = 'service_role')
      );
      
      CREATE POLICY "Users can update their own files" 
      ON storage.objects FOR UPDATE 
      USING (
        bucket_id = '${name}' AND 
        (storage.foldername(name))[1] = auth.uid()::text
      );
      
      CREATE POLICY "Users can delete their own files" 
      ON storage.objects FOR DELETE 
      USING (
        bucket_id = '${name}' AND 
        (storage.foldername(name))[1] = auth.uid()::text
      );
    END
    $$;
    `
    
    try {
      // Execute the SQL for policies
      await supabase.rpc('exec_sql', {
        query: setUpPoliciesSQL
      })
    } catch (policyError) {
      console.error('Error setting up bucket policies:', policyError)
      // Continue anyway, as the bucket is created
    }
    
    return NextResponse.json({
      success: true,
      message: `Bucket '${name}' created successfully`
    })
  } catch (error: any) {
    console.error('Error creating bucket:', error)
    return NextResponse.json({ 
      success: false, 
      message: `Failed to create bucket: ${error.message}` 
    }, { status: 500 })
  }
} 