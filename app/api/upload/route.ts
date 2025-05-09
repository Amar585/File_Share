import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

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
    
    // Parse the form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string
    
    if (!file || !userId) {
      return NextResponse.json({
        success: false,
        message: 'File and userId are required'
      }, { status: 400 })
    }
    
    // Generate a unique file path
    const filePath = `${userId}/${uuidv4()}-${file.name}`
    
    // Ensure the storage bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError)
      throw bucketsError
    }
    
    if (!buckets?.some(bucket => bucket.name === 'files')) {
      // Create the bucket if it doesn't exist
      const { error: createError } = await supabase.storage.createBucket('files', {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024 // 50MB
      })
      
      if (createError) {
        console.error('Error creating bucket:', createError)
        throw createError
      }
    }
    
    // Upload the file using service role (bypassing RLS)
    const { data, error: uploadError } = await supabase.storage
      .from('files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })
    
    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      throw uploadError
    }
    
    // Add the file to the database
    // Try with shared column first
    try {
      const { data: dbData, error: dbError } = await supabase
        .from('files')
        .insert({
          name: file.name,
          size: file.size,
          type: file.type,
          path: filePath,
          user_id: userId,
          shared: false
        })
        .select()
      
      if (dbError) {
        // Check if it's a missing column error
        if (dbError.message && dbError.message.includes('column') && dbError.message.includes('shared')) {
          throw new Error('shared_column_missing')
        }
        throw dbError
      }
      
      return NextResponse.json({
        success: true,
        message: 'File uploaded successfully',
        path: filePath,
        fileId: dbData?.[0]?.id
      })
    } catch (e: any) {
      // If it's the missing shared column, try without it
      if (e.message === 'shared_column_missing') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('files')
          .insert({
            name: file.name,
            size: file.size,
            type: file.type,
            path: filePath,
            user_id: userId
          })
          .select()
        
        if (fallbackError) {
          throw fallbackError
        }
        
        return NextResponse.json({
          success: true,
          message: 'File uploaded successfully (legacy schema)',
          path: filePath,
          fileId: fallbackData?.[0]?.id,
          needsMigration: true
        })
      } else {
        throw e
      }
    }
  } catch (error: any) {
    console.error('Server upload error:', error)
    return NextResponse.json({
      success: false,
      message: `Upload failed: ${error.message}`
    }, { status: 500 })
  }
} 