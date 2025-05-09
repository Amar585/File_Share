import { configureSupabaseEmail } from './email-config'
import { initializeStorage } from './storage-init'

// Initialize Supabase configuration
export async function initializeSupabase() {
  // Verify SMTP settings for authentication
  await configureSupabaseEmail()
  
  // Initialize storage buckets
  const storageResult = await initializeStorage()
  if (!storageResult.success) {
    console.warn('Storage initialization warning:', storageResult.message)
  } else {
    console.log('Storage initialization completed successfully')
  }
  
  console.log('Supabase initialization process completed')
  
  return {
    success: true,
    message: 'Supabase initialization process completed',
    storageInitialized: storageResult.success
  }
} 