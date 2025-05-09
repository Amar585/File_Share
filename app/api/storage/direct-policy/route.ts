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

    // First, make sure the bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError)
      return NextResponse.json({ 
        success: false, 
        message: `Error listing buckets: ${bucketsError.message}` 
      }, { status: 500 })
    }
    
    // Check if the files bucket exists, create it if it doesn't
    const filesBucket = buckets?.find(bucket => bucket.name === 'files')
    
    if (!filesBucket) {
      // Create the bucket
      const { error: createError } = await supabase.storage.createBucket('files', {
        public: true,
        fileSizeLimit: 50 * 1024 * 1024 // 50MB
      })
      
      if (createError) {
        console.error('Error creating bucket:', createError)
        return NextResponse.json({ 
          success: false, 
          message: `Error creating bucket: ${createError.message}` 
        }, { status: 500 })
      }
    } else {
      // Update the bucket to make it public
      try {
        const { error: updateError } = await supabase.storage
          .updateBucket('files', { public: true })
        
        if (updateError) {
          console.error('Error updating bucket visibility:', updateError)
        }
      } catch (updateError: any) {
        console.warn('Error updating bucket visibility:', updateError.message)
      }
    }
    
    // Create a simple test file to validate access
    const testData = 'This is a test file to validate storage access.'
    const testFilePath = `test-access/access-check-${Date.now()}.txt`
    
    // Try to upload as admin
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('files')
        .upload(testFilePath, testData, {
          contentType: 'text/plain',
          upsert: true
        })
      
      if (uploadError) {
        console.error('Error uploading test file:', uploadError)
        
        return NextResponse.json({ 
          success: false, 
          message: `Error uploading test file: ${uploadError.message}` 
        }, { status: 500 })
      }
      
      console.log('Test file uploaded successfully')
      
      // Make the file public for testing
      const { data: publicData } = await supabase.storage
        .from('files')
        .getPublicUrl(testFilePath)
      
      return NextResponse.json({
        success: true,
        message: 'Storage policy check completed, bucket is accessible',
        publicUrl: publicData?.publicUrl || null
      })
    } catch (testError: any) {
      console.error('Error testing storage access:', testError)
      return NextResponse.json({ 
        success: false, 
        message: `Error testing storage access: ${testError.message}` 
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Error setting up storage policies:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: `Error setting up storage policies: ${error.message}` 
      },
      { status: 500 }
    )
  }
} 