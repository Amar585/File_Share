"use server"

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// Initialize storage bucket
export async function initializeStorageBucket() {
  try {
    // Create a service client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
    
    // Check if the bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error("Error listing buckets:", listError)
      return { success: false, message: listError.message }
    }
    
    // Check if files bucket exists
    const filesBucket = buckets?.find(bucket => bucket.name === 'files')
    if (filesBucket) {
      return { success: true, message: "Bucket already exists", bucket: filesBucket }
    }
    
    // Create bucket if it doesn't exist
    const { data, error: createError } = await supabase.storage.createBucket('files', {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024 // 50MB
    })
    
    if (createError) {
      console.error("Error creating bucket:", createError)
      return { success: false, message: createError.message }
    }
    
    return { success: true, message: "Bucket created successfully", bucket: data }
  } catch (error: any) {
    console.error("Error in storage bucket initialization:", error)
    return { success: false, message: error.message || "Unknown error" }
  }
}

// Create a public bucket for the files that need to be shared
export async function ensurePublicBucket() {
  try {
    // Create a service client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
    
    // Check if the bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error("Error listing buckets:", listError)
      return { success: false, message: listError.message }
    }
    
    // Check if public bucket exists
    const publicBucket = buckets?.find(bucket => bucket.name === 'public')
    if (publicBucket) {
      return { success: true, message: "Public bucket already exists", bucket: publicBucket }
    }
    
    // Create public bucket if it doesn't exist
    const { data, error: createError } = await supabase.storage.createBucket('public', {
      public: true,
      fileSizeLimit: 50 * 1024 * 1024 // 50MB
    })
    
    if (createError) {
      console.error("Error creating public bucket:", createError)
      return { success: false, message: createError.message }
    }
    
    return { success: true, message: "Public bucket created successfully", bucket: data }
  } catch (error: any) {
    console.error("Error ensuring public bucket:", error)
    return { success: false, message: error.message || "Unknown error" }
  }
} 