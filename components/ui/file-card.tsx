'use client'
import { Clock, Download, Eye, File, FileText, ImageIcon, Lock, MoreVertical, Trash, Unlock, Loader2, Share2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import { formatBytes, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { decryptFile } from "@/lib/encryption"
import { ShareFileModal } from "@/components/ui/share-file-modal"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export interface FileProps {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string
  path: string
  shared?: boolean
  isEncrypted?: boolean
  originalType?: string
  encryptionMetadata?: {
    iv: string
  }
  onShareToggle?: () => void
  onDelete?: () => void
  className?: string
}

export function FileCard({
  id,
  name,
  size,
  type,
  uploadedAt,
  path,
  shared,
  encryptionMetadata,
  isEncrypted,
  originalType,
  onShareToggle,
  onDelete,
  className,
}: FileProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const supabase = createClientComponentClient()

  const getFileIcon = () => {
    const fileExtension = name.split('.').pop()?.toLowerCase() || ''

    if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png' || fileExtension === 'gif') {
      return <ImageIcon className="h-4 w-4 text-blue-500" />
    } else if (fileExtension === 'pdf' || fileExtension === 'doc' || fileExtension === 'docx') {
      return <FileText className="h-4 w-4 text-red-500" />
    } else {
      return <File className="h-4 w-4 text-gray-500" />
    }
  }

  const handleOpenShareModal = () => {
    setShowShareModal(true)
  }

  const handleCloseShareModal = () => {
    setShowShareModal(false)
  }

  const handleDownload = async () => {
    try {
      setIsDownloading(true)

      
      console.log('Attempting to download file:', path)
      
      const { data, error } = await supabase.storage
        .from('files')
        .download(path)

      if (error) {
        console.error('Download error:', error)
        if (error.message?.includes('storage/object-not-found')) {
          throw new Error('File not found. Please ensure the file exists.')
        }
        if (error.message?.includes('No such')) {
          throw new Error('File access error. You might not have permission to download this file.')
        }
        throw error
      }

      if (!data) {
        throw new Error('No data received from storage.')
      }
      
      let fileToDownload = data;
      
      // Check if the file is encrypted
      if (isEncrypted) {
        // Get encryption metadata
        if (!encryptionMetadata || !encryptionMetadata.iv) {
          toast.error('Missing encryption metadata. Cannot decrypt the file.')
          throw new Error('Missing encryption metadata')
        }
        
        try {
          console.log('Retrieving file key from server...')
          
          // Show decryption status in the toast
          const decryptionToast = toast.loading('Decrypting file...')
          
          // Fetch the file key from the server
          const response = await fetch(`/api/file-keys?fileId=${id}`)
          
          if (!response.ok) {
            toast.dismiss(decryptionToast)
            const errorData = await response.json()
            console.error('Error response from file-keys API:', errorData)
            if (response.status === 403) {
              throw new Error('You do not have permission to access this file')
            } else if (response.status === 401) {
              throw new Error('You must be logged in to access this file')
            } else {
              throw new Error(`Server error: ${errorData.message || 'Unknown error'}`)
            }
          }
          
          const keyData = await response.json()
          
          if (!keyData.success || !keyData.fileKey) {
            toast.dismiss(decryptionToast)
            console.error('Invalid response from file-keys API:', keyData)
            throw new Error('Failed to retrieve file key. The file may be corrupted or inaccessible.')
          }
          
          // Use the original file type from props if available, or fall back to current type
          const fileOriginalType = originalType || type;
          
          console.log('Decrypting file with original type:', fileOriginalType)
          fileToDownload = await decryptFile(
            data, 
            keyData.fileKey, 
            encryptionMetadata.iv, 
            fileOriginalType, // Use original type for proper mime type
            name
          );
          
          toast.dismiss(decryptionToast)
          toast.success('File decrypted successfully')
          console.log('File decrypted successfully')
        } catch (decryptError) {
          console.error('Decryption error:', decryptError)
          toast.error('Failed to decrypt file. You may not have permission to access this file.')
          throw new Error('Decryption failed')
        }
      }

      // Create a URL for the downloaded file
      const url = URL.createObjectURL(fileToDownload)
      
      // Create a temporary link and trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = name
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
    <>
      {/* Share File Modal */}
      <ShareFileModal
        isOpen={showShareModal}
        onClose={handleCloseShareModal}
        fileId={id}
        fileName={name}
      />
      
      <Card className={cn(
        "overflow-hidden transition-all duration-300 hover:shadow-lg file-card border-muted/40", 
        isEncrypted && "border-l-4 border-l-blue-500",
        shared && "border-l-4 border-l-green-500",
        className
      )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 bg-gradient-to-r from-background to-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-md bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm">
            {getFileIcon()}
          </div>
          <div className="space-y-1 max-w-[180px] sm:max-w-[300px]">
            <p className="text-sm font-medium leading-none truncate" title={name}>{name}</p>
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">{formatBytes(size)}</p>
              {isEncrypted && (
                <div className="flex items-center text-xs text-blue-500">
                  <Lock className="h-3 w-3 mr-1" />
                  <span>Encrypted</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {shared && (
            <div className="bg-green-500/10 p-1.5 rounded-full">
              <Unlock className="h-4 w-4 text-green-500" />
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-background/80 transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
                <Download className="mr-2 h-4 w-4" />
                <span>Download</span>
              </DropdownMenuItem>
              {onShareToggle && (
                <>
                  <DropdownMenuItem onClick={onShareToggle} className="cursor-pointer">
                    {shared ? (
                      <>
                        <Lock className="mr-2 h-4 w-4 text-red-500" />
                        <span>Make Private</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="mr-2 h-4 w-4 text-green-500" />
                        <span>Make Public</span>
                      </>
                    )}
                  </DropdownMenuItem>
                
                  {/* Added Share Link option */}
                  <DropdownMenuItem onClick={handleOpenShareModal} className="cursor-pointer">
                    <Share2 className="mr-2 h-4 w-4 text-blue-500" />
                    <span>Share Link</span>
                  </DropdownMenuItem>
                </>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={onDelete} 
                    className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/50 cursor-pointer"
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardFooter className="flex items-center justify-between border-t p-4 pt-3 bg-background">
        <div className="flex items-center text-xs text-muted-foreground">
          <Clock className="mr-1.5 h-3 w-3" />
          <span>{formatDate(uploadedAt)}</span>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 px-3 text-xs transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-1.5 h-3 w-3" />
                Download
              </>
            )}
          </Button>
          {onShareToggle && (
            <Button 
              size="sm" 
              variant={shared ? "destructive" : "default"}
              className={cn(
                "h-8 px-3 text-xs transition-colors",
                shared ? 
                  "bg-red-500 hover:bg-red-600" : 
                  "bg-green-500 hover:bg-green-600"
              )}
              onClick={onShareToggle}
            >
              {shared ? (
                <>
                  <Lock className="mr-1.5 h-3 w-3" />
                  Make Private
                </>
              ) : (
                <>
                  <Unlock className="mr-1.5 h-3 w-3" />
                  Share
                </>
              )}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
    </>
  )
}
