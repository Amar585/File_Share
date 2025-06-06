"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FileCard } from "@/components/ui/file-card"
import { useUser } from "@/hooks/use-user"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Database } from "@/lib/supabase/database.types"
import { MigrationRunner } from "@/components/migration-runner"

type FileRecord = Database["public"]["Tables"]["files"]["Row"]

export default function MyFilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasSharedColumn, setHasSharedColumn] = useState(true)
  const { user } = useUser()

  useEffect(() => {
    async function fetchFiles() {
      if (!user) return

      try {
        setIsLoading(true)
        const { data, error } = await supabase
          .from("files")
          .select("*")
          .eq("user_id", user.id as any)
          .order("created_at", { ascending: false })

        if (error) {
          throw error
        }

        // Check if the files have necessary properties
        // If any file is missing properties, we'll show appropriate messages
        if (data && data.length > 0) {
          const firstFile = data[0]
          if ('shared' in firstFile === false) {
            setHasSharedColumn(false)
            toast.error(
              "The file sharing feature is not fully set up. Please contact support to complete the database setup."
            )
          }
          
          // Check for files that need to be migrated to support encryption
          const encryptionNotSupported = data.some(file => 
            !('is_encrypted' in file) || 
            !('original_type' in file) || 
            !('encryption_metadata' in file)
          )
          
          if (encryptionNotSupported) {
            toast.warning(
              "Some files may not have encryption support. Files uploaded before encryption was implemented will be accessible but not encrypted."
            )
          }
        }

        setFiles((data as unknown as FileRecord[]) || [])
      } catch (error: any) {
        toast.error(`Error loading files: ${error.message}`)
        console.error("Error fetching files:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFiles()
  }, [user])

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('public:files')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'files',
        filter: `user_id=eq.${user.id}`
      }, payload => {
        if (payload.eventType === 'DELETE') {
          setFiles(prev => prev.filter(f => f.id !== (payload.old as FileRecord).id));
        } else if (payload.eventType === 'INSERT') {
          setFiles(prev => [(payload.new as FileRecord), ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setFiles(prev => prev.map(f => f.id === (payload.new as FileRecord).id ? (payload.new as FileRecord) : f));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleShareToggle = async (id: string, shared: boolean) => {
    if (!hasSharedColumn) {
      toast.error("The sharing feature is not fully set up. Please contact support to complete the database setup.")
      return
    }

    try {
      const { error } = await supabase
        .from("files")
        .update({ shared: !shared as boolean } as any)
        .eq("id", id as any)
        .eq("user_id", user?.id as any)

      if (error) {
        // Check if the error is about the missing shared column
        if (error.message && error.message.includes("column") && error.message.includes("shared")) {
          setHasSharedColumn(false)
          toast.error("The sharing feature is not fully set up. Please contact support to complete the database setup.")
          return
        }
        throw error
      }

      // Update local state
      setFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.id === id ? { ...file, shared: !shared } : file
        )
      )

      toast.success(`File ${shared ? "unshared" : "shared"} successfully`)
    } catch (error: any) {
      toast.error(`Failed to update sharing status: ${error.message}`)
    }
  }

  const handleDelete = async (id: string, path: string) => {
    try {
      const deleteToast = toast.loading("Deleting file...");
      
      // First, attempt to delete from storage using the server-side API
      console.log('Attempting to delete file from storage with path:', path);
      
      try {
        const response = await fetch('/api/storage/delete-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filePath: path,
            fileId: id,
            userId: user?.id
          })
        });
        
        const result = await response.json();
        
        if (!result.success) {
          console.error('Server API deletion failed:', result.message);
          
          // Fall back to client-side deletion as a backup
          const { error: storageError } = await supabase.storage.from("files").remove([path]);
          
          if (storageError) {
            console.error('Supabase Storage deletion error:', storageError);
            const errorMessage = storageError.message || JSON.stringify(storageError);
            toast.dismiss(deleteToast);
            toast.error(`Failed to delete file from storage: ${errorMessage}`);
            return; // Stop execution if storage deletion fails
          }
        }
      } catch (storageError: any) {
        console.error('Storage deletion error:', storageError);
        toast.dismiss(deleteToast);
        toast.error(`Failed to delete file from storage: ${storageError.message}`);
        return; // Stop execution if storage deletion fails
      }
      
      console.log('File successfully deleted from storage. Attempting database deletion.');
      
      // Then delete the database record
      const { error: dbError } = await supabase.from("files").delete().eq("id", id as any);
      if (dbError) {
        console.error('Database deletion error:', dbError);
        toast.dismiss(deleteToast);
        toast.error(`Failed to delete file from database: ${dbError.message}`);
        return; // Stop execution if database deletion fails
      }
      
      console.log('File successfully deleted from database. Updating UI.');
      // Update local state
      setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
      toast.dismiss(deleteToast);
      toast.success("File deleted successfully");

    } catch (error: any) {
      console.error('Unexpected error during file deletion:', error);
      toast.error(`An unexpected error occurred during deletion: ${error.message}`);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Files</h1>
            <p className="text-muted-foreground">Manage and organize your files</p>
          </div>
          <div className="flex items-center gap-2">
            {!hasSharedColumn && <MigrationRunner />}
            <Link href="/upload">
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
          </div>
        ) : files.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => (
              <FileCard 
                key={file.id} 
                {...file} 
                shared={hasSharedColumn ? file.shared : false}
                uploadedAt={typeof file.created_at === 'string' ? file.created_at : new Date(file.created_at).toISOString()} 
                onShareToggle={hasSharedColumn ? () => handleShareToggle(file.id as string, !!file.shared) : undefined}
                onDelete={() => handleDelete(file.id as string, file.path as string)}
                isEncrypted={'is_encrypted' in file ? Boolean(file.is_encrypted) : false}
                originalType={'original_type' in file ? String(file.original_type || '') : undefined}
                encryptionMetadata={'encryption_metadata' in file ? 
                  (typeof file.encryption_metadata === 'object' ? 
                    { iv: String((file.encryption_metadata as any)?.iv || '') } : undefined) 
                  : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No files yet</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              You haven't uploaded any files yet. Upload your first file to get started.
            </p>
            <Link href="/upload">
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload Your First File
              </Button>
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
