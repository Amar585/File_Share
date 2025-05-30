"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
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

interface SearchContextType {
  query: string
  setQuery: (query: string) => void
  results: FileResult[]
  isLoading: boolean
  isSearching: boolean
  setIsSearching: (isSearching: boolean) => void
  totalResults: number
  search: (searchQuery?: string) => Promise<void>
  clearSearch: () => void
  navigateToFile: (file: FileResult) => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: ReactNode }) {
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
      console.log('SearchContext: Getting user ID...')
      const { data } = await supabase.auth.getUser()
      console.log('SearchContext: Auth response:', data)
      if (data?.user) {
        console.log('SearchContext: User ID found:', data.user.id)
        setUserId(data.user.id)
      } else {
        console.log('SearchContext: No user found in auth response')
      }
    }
    
    getUserId()
  }, [])

  const search = async (searchQuery?: string) => {
    console.log('SearchContext: search() called with query:', searchQuery || query)
    console.log('SearchContext: Current userId:', userId)
    
    const finalQuery = searchQuery || query
    
    if (!finalQuery || finalQuery.trim() === "") {
      console.log('SearchContext: Empty query, clearing results')
      setResults([])
      setIsSearching(false)
      return
    }

    try {
      if (!userId) {
        console.log('SearchContext: No userId available for search')
        // Get the user ID if it's not set yet
        const { data } = await supabase.auth.getUser()
        if (data?.user) {
          console.log('SearchContext: Just-in-time userId found:', data.user.id)
          setUserId(data.user.id)
        } else {
          console.log('SearchContext: Failed to get userId, showing error')
          toast.error("You must be logged in to search files")
          return
        }
      }
      
      setIsLoading(true)
      setIsSearching(true)
      
      // Get the current userId (we need to check it's not null)
      const currentUserId = userId as string

      console.log('SearchContext: Searching with userId:', currentUserId)
      
      // Search for my files
      const { data: myFiles, error: myFilesError } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", currentUserId)
        .ilike("name", `%${finalQuery}%`)
      
      if (myFilesError) {
        throw myFilesError
      }
      
      // Search for shared files
      const { data: sharedFiles, error: sharedFilesError } = await supabase
        .from("files")
        .select("*")
        .neq("user_id", currentUserId)
        .eq("shared", true)
        .ilike("name", `%${finalQuery}%`)
      
      if (sharedFilesError) {
        throw sharedFilesError
      }
      
      // Add section info to each file
      const myFilesWithSection = (myFiles || []).map(file => {
        return {
          ...file,
          section: "my-files"
        };
      })
      
      const sharedFilesWithSection = (sharedFiles || []).map(file => {
        return {
          ...file,
          section: "shared-files"
        };
      })
      
      // Combine results
      const combinedResults = [...myFilesWithSection, ...sharedFilesWithSection]
      
      console.log("Search results:", combinedResults)
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

  return (
    <SearchContext.Provider value={{
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
    }}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider")
  }
  return context
}
