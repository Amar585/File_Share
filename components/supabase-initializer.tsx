"use client"

import { useEffect, useState } from "react"

export function SupabaseInitializer() {
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initSupabase = async () => {
      try {
        // Initialize Supabase config
        const response = await fetch('/api/init')
        const data = await response.json()
        if (!data.success) {
          console.error('Failed to initialize Supabase:', data.message)
          return
        }
        
        console.log('Supabase initialized successfully')
        
        // Create storage bucket via API route
        try {
          const bucketResponse = await fetch('/api/storage/create-bucket')
          const bucketData = await bucketResponse.json()
          
          if (bucketData.success) {
            console.log('Storage bucket initialized:', bucketData.message)
          } else {
            console.warn('Storage bucket initialization warning:', bucketData.message)
          }
        } catch (storageError) {
          console.error('Error initializing storage bucket:', storageError)
        }
        
        // Fix storage policies
        try {
          const policyResponse = await fetch('/api/storage/fix-policy')
          const policyData = await policyResponse.json()
          
          if (policyData.success) {
            console.log('Storage policies updated:', policyData.message)
          } else {
            console.warn('Storage policy update warning:', policyData.message)
          }
        } catch (policyError) {
          console.error('Error updating storage policies:', policyError)
        }
        
        // Check and add shared column to files table
        try {
          const schemaResponse = await fetch('/api/db/add-shared-column')
          const schemaData = await schemaResponse.json()
          
          if (schemaData.success) {
            console.log('Database schema check complete:', schemaData.message)
          } else {
            console.warn('Database schema check warning:', schemaData.message)
          }
        } catch (schemaError) {
          console.error('Error checking database schema:', schemaError)
        }
        
        setIsInitialized(true)
      } catch (error) {
        console.error('Error initializing Supabase:', error)
      }
    }

    initSupabase()
  }, [])

  // This component doesn't render anything
  return null
} 