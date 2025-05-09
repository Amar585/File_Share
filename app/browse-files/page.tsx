"use client"

import { useState, useEffect } from 'react'
import { Loader2, Search, DatabaseIcon, Copy } from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PublicFileCard } from '@/components/ui/public-file-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Database } from '@/lib/supabase/database.types'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type FileRecord = Database['public']['Tables']['files']['Row']

export default function BrowseFilesPage() {
  const { user } = useUser()
  const [files, setFiles] = useState<FileRecord[]>([])
  const [filteredFiles, setFilteredFiles] = useState<FileRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRunningMigration, setIsRunningMigration] = useState(false)
  const [hasAccessRequestsTable, setHasAccessRequestsTable] = useState(true)
  const [showMigrationDialog, setShowMigrationDialog] = useState(false)
  const [migrationSQL, setMigrationSQL] = useState('')

  // Check if file_access_requests table exists
  useEffect(() => {
    async function checkTable() {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from('file_access_requests')
          .select('id')
          .limit(1)
        
        setHasAccessRequestsTable(true)
      } catch (error: any) {
        console.error('Error checking file_access_requests table:', error)
        
        // Check if the error indicates the table doesn't exist
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          setHasAccessRequestsTable(false)
        }
      }
    }
    
    checkTable()
  }, [user])

  // Run migration to set up tables
  const runMigration = async () => {
    setIsRunningMigration(true)
    
    try {
      // Use our new dedicated API endpoint
      const response = await fetch('/api/migrations/setup-access-tables')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to set up database tables')
      }
      
      // Show the migration SQL dialog
      setMigrationSQL(data.sqlToRun)
      setShowMigrationDialog(true)
      
    } catch (error: any) {
      console.error('Database setup error:', error)
      toast.error(`Failed to set up database: ${error.message}`)
    } finally {
      setIsRunningMigration(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('SQL copied to clipboard')
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  // Load public shared files
  useEffect(() => {
    async function loadFiles() {
      if (!user) return

      setIsLoading(true)
      try {
        // Direct query to get shared files not owned by current user
        console.log('Fetching shared files not owned by current user:', user.id)
        const { data, error } = await supabase
          .from("files")
          .select("*")
          .eq("shared", true)
          .neq("user_id", user.id)
          .order("created_at", { ascending: false })
        
        if (error) {
          console.error("Error fetching public files:", error)
          throw error
        }
        
        console.log(`Found ${data?.length || 0} shared files from other users`)
        setFiles(data || [])
        setFilteredFiles(data || [])
      } catch (error: any) {
        console.error('Error loading public files:', error)
        toast.error(`Failed to load public files: ${error.message}`)
      } finally {
        setIsLoading(false)
      }
    }

    loadFiles()
  }, [user])

  // Handle search filtering
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = files.filter(file => 
      file.name.toLowerCase().includes(query) || 
      file.type.toLowerCase().includes(query)
    )
    
    setFilteredFiles(filtered)
  }, [searchQuery, files])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Browse Shared Files</h1>
          <p className="text-muted-foreground">
            Discover and download files shared by other users
          </p>
          
          {!hasAccessRequestsTable && (
            <div className="mt-4 p-4 border rounded-md bg-amber-50 text-amber-800">
              <p className="font-medium mb-2">Database setup required</p>
              <p className="mb-3 text-sm">The system needs to set up the database tables to enable file access requests.</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={runMigration}
                disabled={isRunningMigration}
                className="bg-white"
              >
                {isRunningMigration ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up database...
                  </>
                ) : (
                  <>
                    <DatabaseIcon className="mr-2 h-4 w-4" />
                    Set Up Database Tables
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Search box */}
        <div className="flex w-full items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search files by name or type..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setSearchQuery('')}
            disabled={!searchQuery}
          >
            Clear
          </Button>
        </div>

        {/* File listing */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
          </div>
        ) : filteredFiles.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFiles.map((file) => (
              <PublicFileCard
                key={file.id}
                file={file}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">No files found</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              {files.length > 0 
                ? "No files match your search criteria. Try a different search term."
                : "There are no public shared files available right now. Check back later or adjust your search."}
            </p>
          </div>
        )}
      </div>

      {/* Add the migration dialog */}
      <Dialog open={showMigrationDialog} onOpenChange={setShowMigrationDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogTitle>Database Setup Required</DialogTitle>
          <DialogDescription>
            Run the following SQL in your Supabase dashboard SQL Editor to set up the necessary tables:
          </DialogDescription>
          
          <div className="relative mt-4">
            <Textarea 
              className="h-96 font-mono text-xs p-4"
              readOnly
              value={migrationSQL}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(migrationSQL)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy SQL</TooltipContent>
            </Tooltip>
          </div>
          
          <DialogFooter className="mt-4">
            <Button onClick={() => setShowMigrationDialog(false)}>Close</Button>
            <Button 
              variant="default" 
              onClick={() => {
                window.open('https://supabase.com/dashboard/project/_/sql', '_blank')
                toast.info('Opening Supabase SQL Editor...')
              }}
            >
              Open SQL Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
} 