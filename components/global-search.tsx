"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { File, FolderOpen, Loader2, Search, XCircle } from "lucide-react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatBytes } from "@/lib/utils"

interface FileResult {
  id: string
  name: string
  path: string
  size: number
  type: string
  user_id: string
  created_at: string
  shared: boolean
  is_encrypted?: boolean
  original_type?: string
  section: string
}

export function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState<string>("")
  const [results, setResults] = useState<FileResult[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  // Get the current user ID when component mounts
  useEffect(() => {
    const getUserId = async () => {
      try {
        console.log("Getting user data...")
        const { data, error } = await supabase.auth.getUser()
        if (error) throw error
        
        if (data?.user?.id) {
          console.log("User ID found:", data.user.id)
          setUserId(data.user.id)
        }
      } catch (error) {
        console.error("Error getting user:", error)
      }
    }
    
    getUserId()
  }, [])
  
  const handleSearch = async () => {
    if (!query.trim()) {
      return
    }
    
    if (!userId) {
      toast.error("Please log in to search files")
      return
    }
    
    try {
      setIsLoading(true)
      setIsSearching(true)
      console.log("Searching for:", query)
      console.log("User ID:", userId)
      
      // Search for user's own files
      const { data: myFiles, error: myFilesError } = await supabase
        .from("files")
        .select()
        .eq("user_id", userId)
        .ilike("name", `%${query}%`)
      
      if (myFilesError) {
        console.error("Error searching my files:", myFilesError)
        throw myFilesError
      }
      
      console.log("My files results:", myFiles)
      
      // Search for shared files
      const { data: sharedFiles, error: sharedFilesError } = await supabase
        .from("files")
        .select()
        .neq("user_id", userId)
        .eq("shared", true)
        .ilike("name", `%${query}%`)
      
      if (sharedFilesError) {
        console.error("Error searching shared files:", sharedFilesError)
        throw sharedFilesError
      }
      
      console.log("Shared files results:", sharedFiles)
      
      // Process results
      const myFilesWithSection = (myFiles || []).map(file => {
        return {
          ...file,
          section: "my-files"
        } as FileResult
      })
      
      const sharedFilesWithSection = (sharedFiles || []).map(file => {
        return {
          ...file,
          section: "shared-files"
        } as FileResult
      })
      
      // Combine results
      const allResults = [...myFilesWithSection, ...sharedFilesWithSection]
      setResults(allResults)
      
      console.log("Combined search results:", allResults)
    } catch (error: any) {
      console.error("Search error:", error)
      toast.error(`Error searching: ${error.message || "Unknown error"}`)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }
  
  const clearSearch = () => {
    setQuery("")
    setResults([])
    setIsSearching(false)
  }
  
  const navigateToFile = (file: FileResult) => {
    if (file.section === "my-files") {
      router.push("/my-files")
    } else if (file.section === "shared-files") {
      router.push("/shared-files")
    }
    setIsSearching(false)
  }
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }
  
  const getFileIcon = (type: string) => {
    if (type.includes("image")) return "📷"
    if (type.includes("video")) return "🎬"
    if (type.includes("audio")) return "🎵"
    if (type.includes("pdf")) return "📄"
    if (type.includes("zip") || type.includes("rar") || type.includes("tar")) return "📦"
    if (type.includes("text") || type.includes("document")) return "📝"
    return "📎"
  }
  
  return (
    <div className="relative">
      <div className="relative w-full">
        <Input
          type="search"
          placeholder="Search files..."
          className="w-full rounded-md border bg-background/50 pl-10 pr-4 focus-visible:ring-brand-blue"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch()
            }
          }}
          onClick={() => {
            if (query.trim() !== "") {
              handleSearch()
            }
          }}
        />
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      {isSearching && (
        <div className="absolute top-12 left-0 right-0 z-50 w-full rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="font-medium">
              {isLoading ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </span>
              ) : (
                `${results.length} result${results.length !== 1 ? "s" : ""}`
              )}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
          
          <ScrollArea className="max-h-[calc(100vh-200px)]">
            {results.length > 0 ? (
              <div className="divide-y">
                {results.map((file) => (
                  <div
                    key={file.id}
                    className="flex cursor-pointer items-start gap-3 p-4 hover:bg-muted/50"
                    onClick={() => navigateToFile(file)}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border">
                      <span className="text-xl">{getFileIcon(file.type)}</span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="truncate font-medium">{file.name}</h4>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center">
                          {file.section === "my-files" ? (
                            <File className="mr-1 h-3 w-3" />
                          ) : (
                            <FolderOpen className="mr-1 h-3 w-3" />
                          )}
                          {file.section === "my-files" ? "My Files" : "Shared Files"}
                        </span>
                        <span>•</span>
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        <span>{formatDate(file.created_at)}</span>
                        {file.is_encrypted && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center">
                              🔒 Encrypted
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : !isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <XCircle className="mb-2 h-10 w-10 text-muted-foreground/50" />
                <h4 className="font-medium">No files found</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try searching with different keywords
                </p>
              </div>
            ) : null}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
