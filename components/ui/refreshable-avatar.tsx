"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { User, Loader2 } from "lucide-react"

interface RefreshableAvatarProps {
  url: string | null
  alt: string
  size?: "sm" | "md" | "lg" | "xl"
  fallbackClassName?: string
  className?: string
}

export function RefreshableAvatar({ 
  url, 
  alt, 
  size = "md", 
  fallbackClassName = "bg-muted", 
  className
}: RefreshableAvatarProps) {
  const [imageKey, setImageKey] = useState(Date.now())
  const [error, setError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 2
  
  // Reset states and refresh the image when the URL changes
  useEffect(() => {
    if (url) {
      setImageKey(Date.now())
      setError(false)
      setIsLoading(true)
      setRetryCount(0)
    }
  }, [url])
  
  // Set up retry mechanism for failed images
  useEffect(() => {
    if (error && retryCount < maxRetries) {
      const retryTimer = setTimeout(() => {
        console.log(`Retrying avatar load (${retryCount + 1}/${maxRetries})...`)
        setImageKey(Date.now())
        setError(false)
        setIsLoading(true)
        setRetryCount(prev => prev + 1)
      }, 1500) // Wait 1.5 seconds before retrying
      
      return () => clearTimeout(retryTimer)
    }
  }, [error, retryCount])

  // Map sizes to CSS classes
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16",
    xl: "h-24 w-24"
  }

  // Map sizes to icon sizes
  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-8 w-8",
    xl: "h-12 w-12"
  }

  const handleImageError = () => {
    console.error(`Failed to load avatar image: ${url}`)
    setError(true)
    setIsLoading(false)
  }

  const handleImageLoaded = () => {
    console.log(`Avatar image loaded successfully: ${url}`)
    setIsLoading(false)
    setError(false)
  }

  return (
    <Avatar className={`${sizeClasses[size]} ${className || ""}`}>
      {url && !error ? (
        <>
          <AvatarImage 
            key={imageKey}
            src={`${url}?t=${imageKey}`}
            alt={alt}
            className={`object-cover w-full h-full transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            referrerPolicy="no-referrer"
            onError={handleImageError}
            onLoad={handleImageLoaded}
          />
          {isLoading && (
            <AvatarFallback className={`${fallbackClassName} absolute inset-0`}>
              <Loader2 className={`animate-spin text-muted-foreground ${iconSizes[size]}`} />
            </AvatarFallback>
          )}
        </>
      ) : (
        <AvatarFallback className={fallbackClassName}>
          <User className={`text-muted-foreground ${iconSizes[size]}`} />
        </AvatarFallback>
      )}
    </Avatar>
  )
}
