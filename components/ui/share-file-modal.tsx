'use client'

import { useState } from 'react'
import { Check, Copy, Lock, Calendar } from 'lucide-react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'share-file-modal' })

interface ShareFileModalProps {
  isOpen: boolean
  onClose: () => void
  fileId: string
  fileName: string
}

export function ShareFileModal({ isOpen, onClose, fileId, fileName }: ShareFileModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [shareLink, setShareLink] = useState<string>('')
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [expiration, setExpiration] = useState<string>('never')
  const [copied, setCopied] = useState(false)
  const [shareTab, setShareTab] = useState('create')
  
  // Reset the form when the modal opens or closes
  const resetForm = () => {
    setShareLink('')
    setUsePassword(false)
    setPassword('')
    setExpiration('never')
    setCopied(false)
    setShareTab('create')
  }
  
  // Handle form submission
  const handleCreateShare = async () => {
    try {
      setIsLoading(true)
      
      // Validate form if password protection is enabled
      if (usePassword && !password.trim()) {
        toast.error('Please enter a password')
        return
      }
      
      // Calculate expiration date if not "never"
      let expiresAt = null
      if (expiration !== 'never') {
        const date = new Date()
        switch (expiration) {
          case '1day':
            date.setDate(date.getDate() + 1)
            break
          case '7days':
            date.setDate(date.getDate() + 7)
            break
          case '30days':
            date.setDate(date.getDate() + 30)
            break
        }
        expiresAt = date.toISOString()
      }
      
      // Send request to create share link
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          password: usePassword ? password : null,
          expiresAt,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create share link')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setShareLink(data.shareLink)
        setShareTab('link')
        toast.success('Share link created successfully')
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (error: any) {
      log.error('Error creating share link', { error })
      toast.error(`Failed to create share link: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Handle copy to clipboard
  const handleCopy = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink)
      setCopied(true)
      toast.success('Link copied to clipboard')
      
      // Reset copied status after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    }
  }
  
  // Handle modal close
  const handleClose = () => {
    resetForm()
    onClose()
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">Share "{fileName}"</DialogTitle>
        </DialogHeader>
        
        <Tabs value={shareTab} onValueChange={setShareTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Share Settings</TabsTrigger>
            <TabsTrigger value="link" disabled={!shareLink}>Generated Link</TabsTrigger>
          </TabsList>
          
          <TabsContent value="create" className="space-y-4 py-4">
            <div className="space-y-4">
              {/* Password Protection */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center">
                    <Lock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="password-protection">Password Protection</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Require a password to access this file
                  </p>
                </div>
                <Switch
                  id="password-protection"
                  checked={usePassword}
                  onCheckedChange={setUsePassword}
                />
              </div>
              
              {/* Password Input */}
              {usePassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
              
              {/* Expiration */}
              <div className="space-y-2">
                <div className="flex items-center">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="expiration">Expiration</Label>
                </div>
                <Select value={expiration} onValueChange={setExpiration}>
                  <SelectTrigger id="expiration">
                    <SelectValue placeholder="Select expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never expires</SelectItem>
                    <SelectItem value="1day">1 day</SelectItem>
                    <SelectItem value="7days">7 days</SelectItem>
                    <SelectItem value="30days">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="link" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="share-link">Share Link</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="share-link"
                    value={shareLink}
                    readOnly
                    className="flex-1"
                  />
                  <Button size="icon" variant="outline" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Summary of share settings */}
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">Share settings:</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>• File: {fileName}</li>
                  <li>• Password protection: {usePassword ? 'Yes' : 'No'}</li>
                  <li>• Expiration: {
                    expiration === 'never' ? 'Never expires' :
                    expiration === '1day' ? '1 day' :
                    expiration === '7days' ? '7 days' : '30 days'
                  }</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          
          {shareTab === 'create' ? (
            <Button
              onClick={handleCreateShare}
              disabled={isLoading}
              className="gap-1"
            >
              {isLoading ? 'Creating...' : 'Create Share Link'}
            </Button>
          ) : (
            <Button
              onClick={handleCopy}
              disabled={isLoading}
              className="gap-1"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
