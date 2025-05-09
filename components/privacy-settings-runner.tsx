'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { toast } from 'sonner'

export function PrivacySettingsRunner() {
  const [isRunning, setIsRunning] = useState(false)
  
  const runMigrations = async () => {
    try {
      setIsRunning(true)
      
      // Call the storage policies fix endpoint
      const response = await fetch('/api/storage/fix-policy')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to apply storage policies')
      }
      
      // Log detailed results for debugging
      console.log('Storage policies applied:', data)
      
      toast.success('Storage policies applied successfully')
      
      // Refresh the page to make sure the new settings are loaded
      window.location.reload()
    } catch (error: any) {
      console.error('Storage policy fix error:', error)
      toast.error(`Failed to apply storage policies: ${error.message}`)
    } finally {
      setIsRunning(false)
    }
  }
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={runMigrations}
      disabled={isRunning}
    >
      {isRunning ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Applying Storage Policies...
        </>
      ) : (
        "Initialize Storage"
      )}
    </Button>
  )
} 