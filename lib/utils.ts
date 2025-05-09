import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from "@/lib/supabase/client"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to fetch public shared files (not owned by the current user)
export async function fetchPublicSharedFiles(userId: string | undefined) {
  try {
    if (!userId) {
      return { data: [], error: new Error('User not authenticated') }
    }

    const { data, error } = await supabase
      .from("files")
      .select("*")
      .eq("shared", true)
      .neq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching public files:", error)
      return { data: [], error }
    }

    return { data: data || [], error: null }
  } catch (error) {
    console.error("Exception fetching public files:", error)
    return { data: [], error }
  }
}

/**
 * Ensures a storage bucket exists, creating it if necessary
 * @param bucketName The name of the bucket to check/create
 * @returns boolean indicating if the bucket exists or was created
 */
export async function ensureStorageBucket(bucketName: string): Promise<boolean> {
  try {
    // Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError)
      return false
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName)
    
    // If bucket doesn't exist, try to create it
    if (!bucketExists) {
      console.log(`Bucket '${bucketName}' doesn't exist, attempting to create it...`)
      
      try {
        // Try with client auth first (may not work due to permissions)
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024 // 50MB
        })
        
        if (createError) {
          console.error('Error creating bucket with client auth:', createError)
          
          // Fall back to server-side creation
          const response = await fetch('/api/storage/create-bucket', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: bucketName }),
          })
          
          if (!response.ok) {
            const data = await response.json()
            console.error('Server bucket creation failed:', data)
            return false
          }
          
          return true
        }
        
        console.log(`Bucket '${bucketName}' created successfully`)
        return true
      } catch (error) {
        console.error('Error in bucket creation process:', error)
        return false
      }
    }
    
    return true
  } catch (error) {
    console.error('Error in ensureStorageBucket:', error)
    return false
  }
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

export function formatDate(date: Date | string) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateObj)
}

// Mock data for files
export const mockFiles = [
  {
    id: "1",
    name: "Project Proposal.pdf",
    type: "application/pdf",
    size: 2500000,
    uploadedAt: new Date(2023, 5, 15),
    shared: true,
  },
  {
    id: "2",
    name: "Company Logo.png",
    type: "image/png",
    size: 1200000,
    uploadedAt: new Date(2023, 6, 2),
    shared: false,
  },
  {
    id: "3",
    name: "Financial Report Q2.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 4500000,
    uploadedAt: new Date(2023, 6, 10),
    shared: true,
  },
  {
    id: "4",
    name: "Team Photo.jpg",
    type: "image/jpeg",
    size: 3800000,
    uploadedAt: new Date(2023, 6, 15),
    shared: true,
  },
  {
    id: "5",
    name: "Product Roadmap.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 1800000,
    uploadedAt: new Date(2023, 6, 20),
    shared: false,
  },
  {
    id: "6",
    name: "Marketing Strategy.pdf",
    type: "application/pdf",
    size: 3200000,
    uploadedAt: new Date(2023, 6, 25),
    shared: false,
  },
]

// Mock data for access requests
export const mockAccessRequests = [
  {
    id: "1",
    requesterName: "Jane Smith",
    requesterEmail: "jane.smith@example.com",
    fileName: "Financial Report Q2.xlsx",
    reason: "Need for quarterly budget planning",
    requestDate: new Date(2023, 6, 12),
  },
  {
    id: "2",
    requesterName: "Michael Johnson",
    requesterEmail: "michael.johnson@example.com",
    fileName: "Product Roadmap.docx",
    reason: "Preparing for client presentation",
    requestDate: new Date(2023, 6, 22),
  },
  {
    id: "3",
    requesterName: "Sarah Williams",
    requesterEmail: "sarah.williams@example.com",
    fileName: "Marketing Strategy.pdf",
    reason: "Aligning marketing initiatives",
    requestDate: new Date(2023, 6, 27),
  },
]

// Mock user data
export const mockUser = {
  id: "1",
  name: "John Doe",
  email: "john.doe@example.com",
  avatar: "/placeholder.svg?height=40&width=40",
}
