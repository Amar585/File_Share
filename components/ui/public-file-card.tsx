'use client'

import { useState, useEffect } from 'react'
import { Download, File, FileText, ImageIcon, Loader2, LockIcon, ClockIcon } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatBytes, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

// Define type for file record without relying on database types
interface FileRecord {
  id: string
  name: string
  type: string
  size: number
  user_id: string
  path: string
  created_at: string
  shared: boolean
}

interface PublicFileCardProps {
  file: FileRecord
  className?: string
}

export function PublicFileCard({ 
  file, 
  className
}: PublicFileCardProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [isRequestingAccess, setIsRequestingAccess] = useState(false)
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [requestMessage, setRequestMessage] = useState('')
  const [accessStatus, setAccessStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none')
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  
  // Check for existing access requests
  useEffect(() => {
    async function checkAccessStatus() {
      try {
        setIsCheckingAccess(true)
        // Try to get existing access requests for this file
        try {
          const { data, error } = await supabase
            .from('file_access_requests')
            .select('status')
            .eq('file_id', file.id)
            .order('created_at', { ascending: false })
            .limit(1)
          
          if (error) {
            // If the table doesn't exist yet, we'll assume no access
            console.error('Error checking access status:', error)
            setAccessStatus('none')
            return
          }
          
          // If there's a request, set the status
          if (data && data.length > 0) {
            setAccessStatus(data[0].status as any)
          } else {
            setAccessStatus('none')
          }
        } catch (error) {
          // If any error occurs during the query, default to 'none'
          console.error('Error checking access status:', error)
          setAccessStatus('none')
        }
      } finally {
        setIsCheckingAccess(false)
      }
    }
    
    checkAccessStatus()
  }, [file.id])
  
  const getFileIcon = () => {
    if (file.type.includes('image')) {
      return <ImageIcon className="h-6 w-6 text-brand-blue" />
    } else if (file.type.includes('pdf')) {
      return <FileText className="h-6 w-6 text-brand-purple" />
    } else {
      return <File className="h-6 w-6 text-brand-teal" />
    }
  }

  const handleRequestAccess = async () => {
    setRequestDialogOpen(true)
  }

  const submitAccessRequest = async () => {
    if (!requestMessage.trim()) {
      toast.error('Please enter a reason for your request')
      return
    }

    try {
      setIsRequestingAccess(true)
      
      const response = await fetch('/api/access-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: file.id,
          message: requestMessage,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error?.includes('relation') && data.error?.includes('does not exist')) {
          // Show special message if the table doesn't exist
          toast.error('The database is not fully configured. Please click "Set Up Database Tables" at the top of the page.')
        } else {
          throw new Error(data.error || 'Failed to submit access request')
        }
      } else {
        toast.success('Access request submitted successfully')
        setRequestDialogOpen(false)
        setRequestMessage('')
        setAccessStatus('pending')
      }
    } catch (error: any) {
      console.error('Access request failed:', error)
      toast.error(`Failed to request access: ${error.message}`)
    } finally {
      setIsRequestingAccess(false)
    }
  }

  const handleDownload = async () => {
    try {
      setIsDownloading(true)
      
      console.log('Attempting to download shared file:', file.path)
      
      const { data, error } = await supabase.storage
        .from('files')
        .download(file.path)

      if (error) {
        console.error('Download error:', error)
        if (error.message?.includes('storage/object-not-found')) {
          throw new Error('File not found. It may have been removed.')
        }
        if (error.message?.includes('No such')) {
          throw new Error('File access error. You might not have permission to download this file.')
        }
        throw error
      }

      if (!data) {
        throw new Error('No data received from storage.')
      }

      // Create a URL for the downloaded file
      const url = URL.createObjectURL(data)
      
      // Create a temporary link and trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      
      // Clean up
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('File downloaded successfully')
    } catch (error: any) {
      console.error('Download failed:', error)
      toast.error(`Download failed: ${error.message}`)
    } finally {
      setIsDownloading(false)
    }
  }

  // Render the appropriate button based on access status
  const renderActionButton = () => {
    if (isCheckingAccess) {
      return (
        <Button variant="default" size="sm" className="w-full" disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking access...
        </Button>
      )
    }
    
    switch (accessStatus) {
      case 'approved':
        return (
          <Button 
            variant="default"
            size="sm"
            className="w-full"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download File
              </>
            )}
          </Button>
        )
      
      case 'pending':
        return (
          <Button 
            variant="outline"
            size="sm"
            className="w-full"
            disabled
          >
            <ClockIcon className="mr-2 h-4 w-4" />
            Request Pending
          </Button>
        )
      
      case 'rejected':
        return (
          <Button 
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleRequestAccess}
            disabled={isRequestingAccess}
          >
            {isRequestingAccess ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting...
              </>
            ) : (
              <>
                <LockIcon className="mr-2 h-4 w-4" />
                Request Again
              </>
            )}
          </Button>
        )
      
      case 'none':
      default:
        return (
          <Button 
            variant="default"
            size="sm"
            className="w-full"
            onClick={handleRequestAccess}
            disabled={isRequestingAccess}
          >
            {isRequestingAccess ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting...
              </>
            ) : (
              <>
                <LockIcon className="mr-2 h-4 w-4" />
                Request Access
              </>
            )}
          </Button>
        )
    }
  }

  return (
    <>
      <Card className={cn("overflow-hidden transition-all hover:shadow-md", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 bg-gradient-to-r from-background to-muted/20">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-md bg-background/80 shadow-sm">{getFileIcon()}</div>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="mt-2 text-xs text-muted-foreground">
            <p>Shared: {formatDate(new Date(file.created_at))}</p>
            <p>Type: {file.type.split('/')[1]?.toUpperCase() || file.type}</p>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0">
          {renderActionButton()}
        </CardFooter>
      </Card>

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Access to {file.name}</DialogTitle>
            <DialogDescription>
              Please provide a reason why you need access to this file.
              The file owner will review your request.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              id="request-reason"
              placeholder="I need access to this file because..."
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRequestDialogOpen(false)}
              disabled={isRequestingAccess}
            >
              Cancel
            </Button>
            <Button 
              onClick={submitAccessRequest}
              disabled={isRequestingAccess || !requestMessage.trim()}
            >
              {isRequestingAccess ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
} 