import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Create a simple test file (a small JSON object)
    const testData = {
      test: true,
      message: 'Test file created at ' + new Date().toISOString(),
      id: uuidv4()
    }
    
    // Use a proper UUID for the user ID
    const testUserId = uuidv4()
    const fileName = `test-file-${uuidv4().substring(0, 8)}.json`
    const filePath = `${testUserId}/${fileName}`
    
    // Convert to JSON string and then to Blob
    const jsonString = JSON.stringify(testData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const arrayBuffer = await blob.arrayBuffer()
    
    console.log(`Attempting to upload test file to path: ${filePath}`)
    
    // Upload the file
    const { data, error } = await supabase.storage
      .from('files')
      .upload(filePath, arrayBuffer, {
        contentType: 'application/json',
        cacheControl: '3600',
        upsert: false
      })
      
    if (error) {
      console.error('Test upload error:', error)
      return NextResponse.json({ 
        success: false, 
        message: `Upload failed: ${error.message}`,
        filePath
      }, { status: 500 })
    }
    
    // Try to create a database record for the file
    const { data: dbData, error: dbError } = await supabase
      .from('files')
      .insert({
        name: fileName,
        size: jsonString.length,
        type: 'application/json',
        path: filePath,
        user_id: testUserId,
        shared: false
      })
      .select()
      
    if (dbError) {
      console.error('Database record creation error:', dbError)
      return NextResponse.json({
        success: true,
        warning: 'File uploaded but database record failed',
        message: dbError.message,
        file: {
          path: filePath,
          name: fileName,
          url: data?.path
        }
      })
    }
    
    // Create a public URL for the file
    const { data: urlData } = await supabase.storage
      .from('files')
      .createSignedUrl(filePath, 60 * 60) // 1 hour expiry
    
    return NextResponse.json({
      success: true,
      message: 'Test file uploaded successfully',
      file: {
        path: filePath,
        name: fileName,
        url: urlData?.signedUrl || null,
        record: dbData?.[0] || null
      }
    })
    
  } catch (error: any) {
    console.error('Test upload error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: `Test upload failed: ${error.message}` 
      },
      { status: 500 }
    )
  }
} 