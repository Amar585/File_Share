'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download, KeyRound, Eye, Lock, FileQuestion } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatBytes } from '@/lib/utils'
import { PageHeader } from '@/components/layout/page-header'
import { decryptFile } from '@/lib/encryption'

interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  isEncrypted: boolean;
}

interface SharedLinkParams {
  shareId: string;
  token: string;
}

export default function SharedPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [sharedLink, setSharedLink] = useState('')
  const [password, setPassword] = useState('')
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [fileInfo, setFileInfo] = useState<SharedFile | null>(null)
  const [linkParams, setLinkParams] = useState<SharedLinkParams | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const supabase = createClientComponentClient()
  
  // Check if we have URL parameters for a shared file
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shareId = params.get('id')
    const token = params.get('token')
    
    if (shareId && token) {
      setLinkParams({ shareId, token })
      verifySharedLink(shareId, token)
    }
  }, [])
  
  // Verify a shared link
  const verifySharedLink = async (shareId: string, token: string, providedPassword?: string) => {
    try {
      setIsLoading(true)
      
      // Construct API URL
      let url = `/api/share?shareId=${shareId}&token=${token}`
      if (providedPassword) {
        url += `&password=${encodeURIComponent(providedPassword)}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (response.ok) {
        if (data.requiresPassword && !providedPassword) {
          // File requires a password
          setRequiresPassword(true)
          setShowPasswordDialog(true)
          if (data.fileInfo) {
            setFileInfo({
              id: '',
              name: data.fileInfo.name,
              size: data.fileInfo.size,
              type: data.fileInfo.type,
              path: '',
              isEncrypted: false
            })
          }
        } else if (data.success) {
          // We have access to the file
          setFileInfo(data.fileInfo)
          setRequiresPassword(false)
          setShowPasswordDialog(false)
          
          // Add the file info to URL if not already there
          if (!window.location.search.includes('id=')) {
            const newUrl = `${window.location.pathname}?id=${shareId}&token=${token}`
            window.history.pushState({ path: newUrl }, '', newUrl)
          }
          
          toast.success('File access granted')
        }
      } else {
        // Error
        toast.error(data.error || 'Failed to access shared file')
        setFileInfo(null)
      }
    } catch (error: any) {
      console.error('Error verifying shared link:', error)
      toast.error('Failed to access shared file')
    } finally {
      setIsLoading(false)
    }
  }
  
  // Submit the password for a password-protected file
  const handlePasswordSubmit = () => {
    if (!linkParams) return
    
    if (!password.trim()) {
      toast.error('Please enter the password')
      return
    }
    
    verifySharedLink(linkParams.shareId, linkParams.token, password)
  }
  
  // Handle an entered shared link
  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!sharedLink.trim()) {
      toast.error('Please enter a shared link')
      return
    }
    
    try {
      const url = new URL(sharedLink)
      const pathname = url.pathname
      const searchParams = url.searchParams
      
      // Extract share ID and token
      const shareId = pathname.split('/').pop() || searchParams.get('id')
      const token = searchParams.get('token')
      
      if (!shareId || !token) {
        toast.error('Invalid shared link format')
        return
      }
      
      setLinkParams({ shareId, token })
      verifySharedLink(shareId, token)
    } catch (error) {
      toast.error('Invalid URL format')
    }
  }
  
  // Download the shared file
  const handleDownload = async () => {
    if (!fileInfo) return
    
    try {
      setIsDownloading(true)
      
      // Fetch the file from Supabase storage
      const { data, error } = await supabase.storage
        .from('files')
        .download(fileInfo.path)
        
      if (error) {
        throw error
      }
      
      if (!data) {
        throw new Error('No data received from storage.')
      }
      
      // Create URL for download
      let fileToDownload = data
      
      // Handle encrypted files if needed
      if (fileInfo.isEncrypted) {
        // This would need an implementation similar to the file-card component
        // to fetch the appropriate decryption key and decrypt the file
        toast.error('Encrypted shared files are not yet supported')
        return
      }
      
      // Create a URL for the downloaded file
      const url = URL.createObjectURL(fileToDownload)
      
      // Create a temporary link and trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = fileInfo.name
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
  
  return (
    <div className="container max-w-6xl py-8">
      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password Protection</DialogTitle>
            <DialogDescription>
              This file is password protected. Please enter the password to access it.
            </DialogDescription>
          </DialogHeader>
          
          {fileInfo && (
            <div className="my-4 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{fileInfo.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(fileInfo.size)}</p>
                </div>
              </div>
            </div>
          )}
          
          <Input
            placeholder="Enter password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordSubmit} disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <PageHeader
        heading="Shared Files"
        description="Access files that have been shared with you"
      />
      
      {!fileInfo ? (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Access Shared File</CardTitle>
            <CardDescription>
              Enter a shared link to access a file that has been shared with you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLinkSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Paste shared link here"
                  value={sharedLink}
                  onChange={(e) => setSharedLink(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoading || !sharedLink.trim()}>
                  {isLoading ? 'Verifying...' : 'Access'}
                </Button>
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col items-start text-sm text-muted-foreground border-t pt-4">
            <p className="mb-2 flex items-center">
              <KeyRound className="mr-2 h-4 w-4" />
              Password-protected files will require the password shared by the owner
            </p>
            <p className="flex items-center">
              <Eye className="mr-2 h-4 w-4" />
              Preview encrypted files directly in your browser without downloading
            </p>
          </CardFooter>
        </Card>
      ) : (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Shared File</CardTitle>
            <CardDescription>
              This file has been shared with you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="p-3 rounded-md bg-primary/10">
                {fileInfo.type.includes('image') ? (
                  <Eye className="h-6 w-6 text-primary" />
                ) : (
                  <FileQuestion className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <p className="font-medium">{fileInfo.name}</p>
                <p className="text-sm text-muted-foreground">{formatBytes(fileInfo.size)}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setFileInfo(null)
                setLinkParams(null)
                window.history.pushState({}, '', window.location.pathname)
              }}
            >
              Access Different File
            </Button>
            <Button onClick={handleDownload} disabled={isDownloading} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? 'Downloading...' : 'Download File'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
