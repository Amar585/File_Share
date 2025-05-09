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

    // Check if the bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      throw listError
    }
    
    // Find the files bucket
    const filesBucket = buckets?.find(bucket => bucket.name === 'files')
    
    if (!filesBucket) {
      return NextResponse.json({ 
        success: false, 
        message: 'Files bucket not found',
        buckets: buckets?.map(b => b.name) || []
      })
    }
    
    // Try to list files in the bucket to verify access
    const { data: files, error: filesError } = await supabase.storage
      .from('files')
      .list()
      
    if (filesError) {
      return NextResponse.json({ 
        success: false, 
        message: `Bucket exists but cannot access files: ${filesError.message}`,
        bucket: filesBucket.name
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Files bucket exists and is accessible',
      bucket: filesBucket,
      fileCount: files?.length || 0,
      files: files?.map(f => f.name).slice(0, 5) || [] // Show first 5 files
    })
  } catch (error: any) {
    console.error('Error checking bucket:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: `Failed to check bucket: ${error.message}` 
      },
      { status: 500 }
    )
  }
} 