"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Loader2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FileCard } from "@/components/ui/file-card"
import { useUser } from "@/hooks/use-user"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Database } from "@/lib/supabase/database.types"
import { MigrationRunner } from "@/components/migration-runner"

type FileRecord = Database["public"]["Tables"]["files"]["Row"]

export default function SharedFilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasSharedColumn, setHasSharedColumn] = useState(true)
  const { user } = useUser()

  useEffect(() => {
    async function fetchFiles() {
      if (!user) return

      try {
        setIsLoading(true)
        // First try with the shared column
        try {
          const { data, error } = await supabase
            .from("files")
            .select("*")
            .eq("user_id", user.id)
            .eq("shared", true)
            .order("created_at", { ascending: false })

          if (error) {
            // Check if the error is about the missing shared column
            if (error.message && error.message.includes("column") && error.message.includes("shared")) {
              setHasSharedColumn(false)
              throw new Error("shared_column_missing");
            }
            throw error;
          }

          setFiles(data || [])
        } catch (e: any) {
          // If the error is about missing shared column, fall back to just getting user files
          if (e.message === "shared_column_missing") {
            console.log("Shared column is missing, fetching all user files instead");
            const { data, error } = await supabase
              .from("files")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })

            if (error) throw error;
            
            // Since we can't filter by shared, we'll just show all files
            setFiles(data || []);
            
            // Notify the user that migration is needed
            toast.error(
              "The shared files feature is not fully set up. Please contact support to complete the database setup."
            );
          } else {
            throw e;
          }
        }
      } catch (error: any) {
        console.error("Error fetching shared files:", error);
        toast.error(`Error loading shared files: ${error.message}`);
        setFiles([]);
      } finally {
        setIsLoading(false)
      }
    }

    fetchFiles()
  }, [user])

  const handleShareToggle = async (id: string, shared: boolean) => {
    try {
      // First check if the shared column exists
      try {
        const { error } = await supabase
          .from("files")
          .update({ shared: !shared })
          .eq("id", id)
          .eq("user_id", user?.id)

        if (error) {
          // Check if the error is about the missing shared column
          if (error.message && error.message.includes("column") && error.message.includes("shared")) {
            throw new Error("shared_column_missing");
          }
          throw error;
        }

        // Remove file from the list since it's no longer shared
        setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id))
        toast.success("File is now private")
      } catch (e: any) {
        if (e.message === "shared_column_missing") {
          toast.error("The shared files feature is not fully set up. Please contact support to complete the database setup.");
        } else {
          throw e;
        }
      }
    } catch (error: any) {
      toast.error(`Failed to update sharing status: ${error.message}`)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Shared Files</h1>
            <p className="text-muted-foreground">Files you've shared with others</p>
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
                uploadedAt={new Date(file.created_at)} 
                onShareToggle={() => handleShareToggle(file.id, file.shared)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No shared files</h3>
            <p className="mb-4 mt-2 text-sm text-muted-foreground">
              You haven't shared any files yet. Upload a file and share it with others.
            </p>
            <Link href="/upload">
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </Button>
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
