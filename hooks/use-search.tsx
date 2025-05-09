"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"

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

export function useSearch() {
  const router = useRouter()
  const [query, setQuery] = useState<string>("")
  const [results, setResults] = useState<FileResult[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [totalResults, setTotalResults] = useState<number>(0)
  const [userId, setUserId] = useState<string | null>(null)
  
  // Get the current user ID on component mount
  useEffect(() => {
    async function getUserId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    
    getUserId()
  }, [])

  const search = async (searchQuery?: string) => {
    const finalQuery = searchQuery || query
    
    if (!finalQuery || finalQuery.trim() === "") {
      setResults([])
      setIsSearching(false)
      return
    }

    try {
      if (!userId) {
        toast.error("You must be logged in to search files")
        return
      }
      
      setIsLoading(true)
      setIsSearching(true)
      
      // Search for my files
      const { data: myFiles, error: myFilesError } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .ilike("name", `%${finalQuery}%`)
      
      if (myFilesError) {
        throw myFilesError
      }
      
      // Search for shared files
      const { data: sharedFiles, error: sharedFilesError } = await supabase
        .from("files")
        .select("*")
        .neq("user_id", userId)
        .eq("shared", true)
        .ilike("name", `%${finalQuery}%`)
      
      if (sharedFilesError) {
        throw sharedFilesError
      }
      
      // Add section info to each file
      const myFilesWithSection = (myFiles || []).map(file => ({
        ...file,
        section: "my-files"
      }))
      
      const sharedFilesWithSection = (sharedFiles || []).map(file => ({
        ...file,
        section: "shared-files"
      }))
      
      // Combine results
      const combinedResults = [...myFilesWithSection, ...sharedFilesWithSection]
      
      setResults(combinedResults)
      setTotalResults(combinedResults.length)
    } catch (error: any) {
      console.error("Search error:", error)
      toast.error(`Error searching: ${error.message}`)
      setResults([])
      setTotalResults(0)
    } finally {
      setIsLoading(false)
    }
  }

  const clearSearch = () => {
    setQuery("")
    setResults([])
    setIsSearching(false)
    setTotalResults(0)
  }

  const navigateToFile = (file: FileResult) => {
    if (file.section === "my-files") {
      router.push("/my-files")
    } else if (file.section === "shared-files") {
      router.push("/shared-files")
    }
    setIsSearching(false)
  }

  return {
    query,
    setQuery,
    results,
    isLoading,
    isSearching,
    setIsSearching,
    totalResults,
    search,
    clearSearch,
    navigateToFile
  }
}
