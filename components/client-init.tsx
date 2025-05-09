'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export default function ClientInit() {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const initializeApp = async () => {
      if (initialized) return

      try {
        // Initialize API routes
        const initResponse = await fetch('/api/init')
        if (!initResponse.ok) {
          throw new Error('Failed to initialize Supabase')
        }
        
        // Create storage bucket via API route
        const bucketResponse = await fetch('/api/storage/create-bucket')
        if (!bucketResponse.ok) {
          const bucketData = await bucketResponse.json()
          console.warn('Storage bucket creation warning:', bucketData.message)
        } else {
          console.log('Storage bucket initialization completed')
        }

        setInitialized(true)
      } catch (error: any) {
        console.error('Initialization error:', error)
        toast.error(`Error initializing app: ${error.message}`)
      }
    }

    initializeApp()
  }, [initialized])

  // This component doesn't render anything visually
  return null
} 