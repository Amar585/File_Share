'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function MigrationRunner() {
  const [isRunning, setIsRunning] = useState(false)
  
  const runMigration = async () => {
    setIsRunning(true)
    try {
      // Call the migration API endpoint
      const response = await fetch('/api/migrations/add-shared-column')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Migration failed')
      }
      
      // Also fix RLS policies to ensure shared files are visible
      const rlsResponse = await fetch('/api/fix-files-rls')
      const rlsData = await rlsResponse.json()
      
      if (!rlsResponse.ok) {
        console.error('Warning: RLS policy update failed but column was added')
      }
      
      toast.success('Database structure has been updated. Please refresh the page.')
      
      // Reload the page after a short delay to reflect changes
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error: any) {
      console.error('Migration error:', error)
      toast.error(`Error updating database: ${error.message}`)
    } finally {
      setIsRunning(false)
    }
  }
  
  return (
    <Button 
      variant="destructive" 
      onClick={runMigration} 
      disabled={isRunning}
    >
      {isRunning ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Updating Database...
        </>
      ) : (
        'Fix Database Structure'
      )}
    </Button>
  )
} 