import { createClient } from '@supabase/supabase-js'

// Initialize storage buckets needed for the application
export async function initializeStorage() {
  try {
    // Create a service role client for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Check if the files bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      return { success: false, message: `Error listing buckets: ${listError.message}` }
    }
    
    // Create the files bucket if it doesn't exist
    const filesBucketExists = buckets?.some(bucket => bucket.name === 'files')
    
    if (!filesBucketExists) {
      console.log('Creating files bucket...')
      const { error: createError } = await supabase.storage.createBucket('files', {
        public: false,
        // Reduce file size limit to avoid storage API errors
        fileSizeLimit: 50 * 1024 * 1024, // 50MB file size limit
      })
      
      if (createError) {
        console.error('Error creating files bucket:', createError)
        return { success: false, message: `Error creating files bucket: ${createError.message}` }
      }
      
      console.log('Files bucket created successfully')
    } else {
      console.log('Files bucket already exists')
    }
    
    return { success: true, message: 'Storage initialized successfully' }
  } catch (error: any) {
    console.error('Failed to initialize storage:', error)
    return { success: false, message: `Failed to initialize storage: ${error.message}` }
  }
} 