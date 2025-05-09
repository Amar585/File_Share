"use client"

import { useState, useEffect } from "react"

/**
 * A custom hook that initializes application storage buckets
 * This ensures all required storage buckets exist with proper permissions
 */
export function useBucketInit() {
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializeBuckets = async () => {
      try {
        setLoading(true)
        // Call the API route to ensure avatar bucket exists with proper permissions
        const avatarBucketRes = await fetch('/api/storage/fix-avatar-bucket')
        
        if (!avatarBucketRes.ok) {
          const errorData = await avatarBucketRes.json()
          console.error('Avatar bucket initialization failed:', errorData)
          setError('Failed to initialize avatar storage bucket')
          return
        }
        
        const avatarData = await avatarBucketRes.json()
        console.log('Avatar bucket initialized:', avatarData)
        
        // Mark initialization as successful
        setInitialized(true)
        setError(null)
      } catch (err) {
        console.error('Error initializing storage buckets:', err)
        setError('Failed to initialize storage')
      } finally {
        setLoading(false)
      }
    }

    initializeBuckets()
  }, [])

  return { initialized, error, loading }
}
