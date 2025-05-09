"use client"

import { useBucketInit } from "@/hooks/use-bucket-init"
import { useEffect } from "react"
import { toast } from "sonner"

/**
 * A component that initializes storage buckets when the application loads
 * This should be included in a layout component that loads on application start
 */
export function BucketInitializer() {
  const { initialized, error, loading } = useBucketInit()

  useEffect(() => {
    // Only show error toast, we don't need to display success messages for this background task
    if (error) {
      toast.error("Storage initialization error", {
        description: error,
        duration: 5000,
      })
    }
  }, [error])

  // This is a utility component that doesn't render anything visible
  return null
}
