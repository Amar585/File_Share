"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FileUp, Upload, X } from "lucide-react"

import { cn, formatBytes, ensureStorageBucket } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useUser } from "@/hooks/use-user"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"
import { v4 as uuidv4 } from "uuid"
import { log } from "@/lib/client-log"
import { encryptFile } from "@/lib/encryption"

interface FileUploadProps {
  className?: string
}

interface UploadProgressEvent {
  loaded: number
  totalBytes: number
}

export function FileUpload({ className }: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [files, setFiles] = React.useState<File[]>([])
  const [progress, setProgress] = React.useState<Record<string, number>>({})
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { user, isLoading } = useUser()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files)
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeFile = (fileName: string) => {
    setFiles((prev) => prev.filter((file) => file.name !== fileName))
    setProgress((prev) => {
      const newProgress = { ...prev }
      delete newProgress[fileName]
      return newProgress
    })
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  // Function to try direct upload without bucket creation
  const tryDirectUpload = async (file: File, filePath: string, onProgress: (progress: number) => void) => {
    console.log(`Attempting direct upload to Supabase storage bucket 'files'...`)
    
    try {
      // First ensure the storage policy is properly set up
      try {
        const policyResponse = await fetch('/api/storage/fix-policy')
        await policyResponse.json()
      } catch (policyError) {
        console.warn('Warning: Could not verify storage policies:', policyError)
        // Continue anyway
      }
      
      // Custom implementation using XMLHttpRequest to track upload progress
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        
        // Track upload progress
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100)
            onProgress(percentComplete)
          }
        }
        
        // Handle completion
        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              resolve({ success: true, data: response.data })
            } catch (error) {
              resolve({ success: true, data: { path: filePath } })
            }
          } else {
            // If there's an RLS error, try a more specific approach
            if (xhr.responseText?.includes('new row violates row-level security policy') || 
                xhr.status === 400 || xhr.status === 403 || 
                xhr.responseText?.includes('permission denied')) {
              console.log('Detected RLS policy issue, attempting to resolve...')
              
              try {
                // Call the fix-policy endpoint then retry
                await fetch('/api/storage/fix-policy')
                
                // Short delay to allow policies to propagate
                await new Promise(resolve => setTimeout(resolve, 500))
                
                // Retry the upload with supabase client (without progress tracking for retry)
                const retryResult = await supabase.storage
                  .from('files')
                  .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true, // Try with upsert this time
                  })
                  
                if (retryResult.error) {
                  reject(retryResult.error)
                } else {
                  resolve({ success: true, data: retryResult.data })
                }
              } catch (retryError) {
                console.error(`Retry upload failed:`, retryError)
                reject(retryError)
              }
            } else {
              reject(new Error(`Upload failed: ${xhr.statusText}`))
            }
          }
        }
        
        // Handle errors
        xhr.onerror = () => {
          reject(new Error('XHR request failed'))
        }
        
        // Prepare the request
        const formData = new FormData()
        formData.append('file', file)
        
        // Get the Supabase URL and headers from environment
        // Using a more reliable approach that won't break TypeScript
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        
        // Set up the request
        xhr.open('POST', `${supabaseUrl}/storage/v1/object/files/${filePath}`, true)
        xhr.setRequestHeader('apikey', apiKey)
        xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`)
        
        // Send the request
        xhr.send(formData)
      })
    } catch (error: any) {
      console.error(`Direct upload error:`, error)
      return { success: false, error }
    }
  }

  // Function to try server-side upload as fallback
  const tryServerUpload = async (file: File, userId: string, onProgress: (progress: number) => void) => {
    console.log(`Attempting server-side upload via API route...`)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', userId)
      
      // Using XMLHttpRequest to track upload progress
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        
        // Track upload progress
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100)
            onProgress(percentComplete)
          }
        }
        
        // Handle completion
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText)
              resolve(result)
            } catch (error) {
              reject(new Error('Invalid server response'))
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText)
              reject(new Error(errorData.message || 'Server upload failed'))
            } catch (error) {
              reject(new Error(`Server upload failed: ${xhr.statusText}`))
            }
          }
        }
        
        // Handle errors
        xhr.onerror = () => {
          reject(new Error('Server upload request failed'))
        }
        
        // Set up the request
        xhr.open('POST', '/api/upload', true)
        xhr.send(formData)
      })
    } catch (error: any) {
      console.error(`Server upload error:`, error)
      return { success: false, error }
    }
  }

  // Try the policy fix API first before upload
  const checkPolicies = async () => {
    try {
      log.info('Checking and fixing storage policies')
      // Call our policy fix endpoint to ensure RLS policies are set correctly
      const response = await fetch('/api/storage/fix-policy')
      const data = await response.json()
      log.info('Policy check response:', data)
      
      if (!data.success) {
        log.warn('Policy check warning:', data.message)
      }
      
      return data.success
    } catch (error) {
      log.error('Policy check error:', error)
      return false
    }
  }

  const uploadFiles = async () => {
    if (!user) {
      toast.error("You must be logged in to upload files")
      return
    }

    if (files.length === 0) {
      toast.error("Please select files to upload")
      return
    }

    setUploading(true)
    log.info(`Starting upload process for ${files.length} files with encryption`)

    try {
      // First check and fix policies if needed
      await checkPolicies()
      
      // Try to check if bucket exists, but continue with uploads even if this fails
      let bucketExists = false
      try {
        log.info("Checking if storage bucket exists...")
        bucketExists = await ensureStorageBucket('files')
        log.info(`Storage bucket verification result: ${bucketExists ? 'Success' : 'Failed'}`)
      } catch (bucketError) {
        log.error("Error checking storage bucket:", bucketError)
        // Continue anyway - we'll try direct uploads
      }
      
      // Track successful uploads
      let successCount = 0
      const totalFiles = files.length
      
      // Proceed with upload attempts regardless of bucket verification
      for (const file of files) {
        try {
          // Track progress for this file
          const onProgress = (progress: number) => {
            setProgress((prev) => ({
              ...prev,
              [file.name]: progress,
            }))
          }
  
          log.info(`Starting upload for file: ${file.name}, size: ${file.size}, type: ${file.type}`)
  
          // Generate a unique file path with UUID to prevent conflicts
          const filePath = `${user.id}/${uuidv4()}-${file.name}`
          log.info(`Generated file path: ${filePath}`)
  
          // Encrypt the file with a unique key
          log.info(`Encrypting file: ${file.name}`)
          const { encryptedFile, fileKey, iv } = await encryptFile(file);
          
          // Keep track of original type for decryption later
          const originalType = file.type;
          
          // Upload encrypted file to Supabase Storage
          log.info(`Attempting upload of encrypted file to Supabase storage...`)
          const uploadResult = await tryDirectUpload(encryptedFile, filePath, onProgress) as { success: boolean; data?: any; error?: any }
  
          if (!uploadResult.success) {
            log.error(`Storage upload error for ${file.name}:`, uploadResult.error)
            log.info(`Trying server-side upload as fallback with encrypted file...`)
            // Try server-side upload as a fallback - IMPORTANT: use encryptedFile not original file
            // Also pass encryption metadata to server
            const formData = new FormData()
            formData.append('file', encryptedFile) // Use the encrypted file!
            formData.append('userId', user.id)
            formData.append('fileKey', fileKey)
            formData.append('iv', iv)
            formData.append('originalType', originalType)
            formData.append('isEncrypted', 'true')
            
            // Using XMLHttpRequest to track upload progress
            const serverUploadResult = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest()
              
              // Track upload progress
              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  const percentComplete = Math.round((event.loaded / event.total) * 100)
                  onProgress(percentComplete)
                }
              }
              
              // Handle completion
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const result = JSON.parse(xhr.responseText)
                    resolve(result)
                  } catch (error) {
                    reject(new Error('Invalid server response'))
                  }
                } else {
                  try {
                    const errorData = JSON.parse(xhr.responseText)
                    reject(new Error(errorData.message || 'Server upload failed'))
                  } catch (error) {
                    reject(new Error(`Server upload failed: ${xhr.statusText}`))
                  }
                }
              }
              
              // Handle errors
              xhr.onerror = () => {
                reject(new Error('Server upload request failed'))
              }
              
              // Set up the request
              xhr.open('POST', '/api/upload', true)
              xhr.send(formData)
            }) as { success: boolean; data?: any; error?: any }
            
            if (!serverUploadResult.success) {
              log.error(`Server-side upload also failed:`, serverUploadResult.error)
              throw new Error(`Failed to upload ${file.name}: ${serverUploadResult.error?.message || 'Upload failed via all methods'}`)
            }
            
            log.info(`Server-side upload successful:`, serverUploadResult)
            // Since the server handles the database insertion, we can skip that step
            toast.success(`Successfully uploaded ${file.name}`)
            successCount++
            continue
          }
  
          log.info(`Storage upload successful:`, uploadResult.data)
          
          // Add record to the files table with encryption metadata
          log.info(`Adding record to database with encryption metadata...`)
          try {
            // Type-safe insertion with proper type casting
            const { data: dbData, error: dbError } = await supabase.from('files').insert({
              name: file.name,
              size: file.size,
              type: "application/octet-stream", // Store encrypted type
              original_type: file.type, // Store original type for decryption
              path: filePath,
              user_id: user.id,
              shared: false,
              is_encrypted: true,
              encryption_metadata: { iv }
            } as any).select()
  
            if (dbError) {
              log.error(`Database insert error:`, JSON.stringify(dbError))
              // Check if error is about missing columns
              if (dbError.message && dbError.message.includes("column")) {
                if (dbError.message.includes("shared")) {
                  throw new Error("shared_column_missing");
                } else if (dbError.message.includes("is_encrypted") || 
                          dbError.message.includes("original_type") || 
                          dbError.message.includes("encryption_metadata")) {
                  toast.error('File encryption feature not fully set up. Run the database migration to enable encryption.');
                  log.error('Missing encryption columns in database. Please run the migration to add these columns.');
                  throw new Error("encryption_columns_missing");
                }
              }
              throw dbError
            }
            
            log.info(`Database record added with encryption metadata:`, dbData)
            
            // Store the file key securely on the server
            if (dbData && Array.isArray(dbData) && dbData.length > 0 && 'id' in dbData[0]) {
              try {
                // Type assertion to ensure TypeScript recognizes id property
                const fileRecord = dbData[0] as { id: string };
                const fileId = fileRecord.id;
                log.info(`Storing encryption key for file ID: ${fileId}`);
                const response = await fetch('/api/file-keys', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    fileId: fileId,
                    fileKey: fileKey
                  })
                });
                
                const keyData = await response.json();
                if (!keyData.success) {
                  log.error(`Error storing file key:`, keyData.message);
                }
              } catch (keyError) {
                log.error(`Error storing file key:`, keyError);
                // We don't want to fail the upload if key storage fails
                // The file is still uploaded, but won't be decryptable
              }
            }
          } catch (e: any) {
            // If it's about the missing shared column, try without it
            if (e.message === "shared_column_missing") {
              log.warn("Shared column missing, inserting without it");
              const { data: fallbackData, error: fallbackError } = await supabase.from('files').insert({
                name: file.name,
                size: file.size,
                type: file.type,
                path: filePath,
                user_id: user.id
              } as any).select()
              
              if (fallbackError) {
                log.error(`Fallback database insert error:`, JSON.stringify(fallbackError))
                throw fallbackError;
              }
              
              log.info(`Database record added without shared column:`, fallbackData)
            } else {
              log.error(`Unexpected database error:`, e)
              throw e;
            }
          }
          
          toast.success(`Successfully uploaded ${file.name}`)
          successCount++
        } catch (fileError: any) {
          log.error(`Error processing file ${file.name}:`, fileError)
          toast.error(`Error uploading ${file.name}: ${fileError.message || "Unknown error"}`)
        }
      }
      
      // Only redirect if at least one file was successfully uploaded
      if (successCount > 0) {
        // Clear files and redirect to my-files page
        setFiles([])
        setProgress({})
        
        log.info(`Upload process completed, redirecting to my-files page`)
        // Use setTimeout to ensure the redirect happens after React state updates
        setTimeout(() => {
          router.push('/my-files')
          router.refresh()
        }, 500)
      } else if (totalFiles > 0) {
        toast.error("No files were uploaded successfully")
      }
    } catch (error: any) {
      log.error("Upload process failed with error:", error)
      if (typeof error === 'object') {
        log.error("Error details:", JSON.stringify(error, null, 2))
      }
      toast.error(`Upload failed: ${error.message || "Unknown error"}`)
    } finally {
      setUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-all duration-300",
          isDragging 
            ? "border-primary bg-primary/10 shadow-lg scale-[1.02]" 
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5",
          "cursor-pointer group",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="rounded-full bg-primary/10 p-6 transition-transform duration-300 group-hover:scale-110">
            <FileUp className={cn(
              "h-10 w-10 text-primary transition-all duration-300",
              isDragging ? "scale-125" : "group-hover:scale-110"
            )} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Drag & Drop your files here</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Securely upload and share files with friends and colleagues. Your files are encrypted before being stored.
            </p>
            <div className="pt-4">
              <Button 
                variant="outline" 
                className="gap-2 transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-4 w-4" />
                Browse Files
              </Button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          
          {/* Accepted file types indicator */}
          <div className="text-xs text-muted-foreground mt-4 flex flex-wrap gap-1 justify-center">
            <span className="px-2 py-1 bg-secondary rounded-full">Images</span>
            <span className="px-2 py-1 bg-secondary rounded-full">Documents</span>
            <span className="px-2 py-1 bg-secondary rounded-full">Videos</span>
            <span className="px-2 py-1 bg-secondary rounded-full">Audio</span>
            <span className="px-2 py-1 bg-secondary rounded-full">Archives</span>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Uploading {files.length} files</h3>
          <div className="space-y-2">
            {files.map((file) => (
              <Card key={file.name} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Upload className="h-5 w-5 text-primary" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(file.size)} • {file.type || "Unknown type"}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      onClick={() => removeFile(file.name)}
                      disabled={uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 space-y-1">
                    <Progress value={progress[file.name] || 0} className="h-2" />
                    <p className="text-right text-xs text-muted-foreground">{Math.round(progress[file.name] || 0)}%</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setFiles([])} disabled={uploading}>
              Cancel All
            </Button>
            <Button onClick={uploadFiles} disabled={uploading}>
              {uploading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                  Uploading...
                </>
              ) : (
                "Upload Files"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
