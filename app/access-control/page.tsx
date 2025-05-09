"use client"

import * as React from "react"
import { Eye, Loader2, Lock, Trash, Unlock } from "lucide-react"

import { useUser } from "@/hooks/use-user"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { formatDate, formatBytes } from "@/lib/utils"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"
import { Database } from "@/lib/supabase/database.types"

type FileRecord = Database["public"]["Tables"]["files"]["Row"]

export default function AccessControlPage() {
  const { user } = useUser()
  const [sharedFiles, setSharedFiles] = React.useState<FileRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isUpdating, setIsUpdating] = React.useState(false)

  // Fetch shared files on initial load
  React.useEffect(() => {
    async function fetchSharedFiles() {
      if (!user) return

      try {
        setIsLoading(true)
        const { data, error } = await supabase
          .from("files")
          .select("*")
          .eq("user_id", user.id)
          .eq("shared", true)
          .order("created_at", { ascending: false })

        if (error) {
          throw error
        }

        setSharedFiles(data || [])
      } catch (error: any) {
        console.error('Error fetching shared files:', error)
        toast.error(`Failed to load shared files: ${error.message}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSharedFiles()
  }, [user])

  const handleShareToggle = async (file: FileRecord) => {
    if (!user) return
    
    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from("files")
        .update({ shared: !file.shared })
        .eq("id", file.id)
        .eq("user_id", user.id)

      if (error) {
        throw error
      }

      // Update local state
      setSharedFiles(prevFiles => prevFiles.filter(f => f.id !== file.id))
      
      toast.success(`File is now private`)
    } catch (error: any) {
      console.error('Error updating file share status:', error)
      toast.error(`Failed to update file: ${error.message}`)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (file: FileRecord) => {
    if (!user) return
    
    if (!confirm(`Are you sure you want to delete "${file.name}"? This can't be undone.`)) {
      return
    }
    
    setIsUpdating(true)
    try {
      // First delete from storage
      const { error: storageError } = await supabase.storage
        .from("files")
        .remove([file.path])
      
      if (storageError) throw storageError

      // Then delete the database record
      const { error: dbError } = await supabase
        .from("files")
        .delete()
        .eq("id", file.id)
      
      if (dbError) throw dbError

      // Update local state
      setSharedFiles(prevFiles => prevFiles.filter(f => f.id !== file.id))
      
      toast.success(`File "${file.name}" deleted successfully`)
    } catch (error: any) {
      console.error('Error deleting file:', error)
      toast.error(`Failed to delete file: ${error.message}`)
    } finally {
      setIsUpdating(false)
    }
  }

  const getFileType = (type: string) => {
    const parts = type.split('/')
    if (parts.length > 1) {
      return parts[1].toUpperCase()
    }
    return type
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sharing Management</h1>
          <p className="text-muted-foreground">Manage access to your shared files</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Shared Files</CardTitle>
            <CardDescription>Files you've shared with other users</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand-blue" />
                <span>Loading shared files...</span>
              </div>
            ) : sharedFiles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Shared Since</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sharedFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell>{getFileType(file.type)}</TableCell>
                      <TableCell>{formatBytes(file.size)}</TableCell>
                      <TableCell>{formatDate(new Date(file.created_at))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleShareToggle(file)}
                            disabled={isUpdating}
                          >
                            <Lock className="mr-2 h-4 w-4 text-red-500" />
                            Make Private
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDelete(file)}
                            disabled={isUpdating}
                          >
                            <Trash className="mr-2 h-4 w-4 text-red-500" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Eye className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">No shared files</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  You haven't shared any files yet. Go to 'My Files' to share some files.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
