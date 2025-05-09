"use client"

import * as React from "react"
import { File, FolderOpen, Loader2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSearch } from "@/context/search-context"
import { formatBytes } from "@/lib/utils"

export function SearchResults() {
  const { 
    results, 
    isLoading, 
    isSearching, 
    setIsSearching,
    totalResults, 
    navigateToFile,
    clearSearch 
  } = useSearch()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getFileIcon = (type: string) => {
    // Simple file type detection based on string content
    if (type.includes("image")) {
      return "📷"
    } else if (type.includes("video")) {
      return "🎬"
    } else if (type.includes("audio")) {
      return "🎵"
    } else if (type.includes("pdf")) {
      return "📄"
    } else if (type.includes("zip") || type.includes("rar") || type.includes("tar")) {
      return "📦"
    } else if (type.includes("text") || type.includes("document")) {
      return "📝"
    } else {
      return "📎"
    }
  }

  if (!isSearching) {
    return null
  }
  
  return (
    <div className="absolute top-16 left-0 right-0 z-50 mx-auto w-full max-w-3xl rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="font-medium">
              {isLoading ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </span>
              ) : (
                `${totalResults} result${totalResults !== 1 ? "s" : ""}`
              )}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearSearch()
                setIsSearching(false)
              }}
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
  )
}
