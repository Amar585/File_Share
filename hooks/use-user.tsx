"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { User } from "@supabase/supabase-js"
import { Database } from "@/lib/supabase/database.types"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          throw sessionError
        }
        
        if (!session?.user) {
          setIsLoading(false)
          return
        }
        
        setUser(session.user)
        
        // Fetch profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        if (profileError) {
          // If the profile doesn't exist, create it
          if (profileError.code === 'PGRST116') {
            // Create a default profile for the user
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                full_name: session.user.user_metadata?.full_name || '',
                avatar_url: session.user.user_metadata?.avatar_url || null,
                email: session.user.email || null,
                updated_at: new Date().toISOString()
              })
              .select()
              .single()
            
            if (createError) {
              console.error('Error creating user profile:', createError)
              // Still set the user but with empty profile
              setProfile({
                id: session.user.id,
                full_name: session.user.user_metadata?.full_name || '',
                avatar_url: null,
                email: session.user.email || null,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
              })
            } else {
              setProfile(newProfile)
            }
          } else {
            console.error('Error fetching user profile:', profileError)
            // Still set the user but with empty profile
            setProfile({
              id: session.user.id,
              full_name: session.user.user_metadata?.full_name || '',
              avatar_url: null,
              email: session.user.email || null,
              updated_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            })
          }
        } else {
          setProfile(profileData)
        }
      } catch (err: any) {
        console.error('Error fetching user data:', err)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchUserAndProfile()
    
    // Set up auth state change subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (session?.user) {
            setUser(session.user)
            fetchUserAndProfile()
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
        }
      }
    )
    
    return () => {
      subscription.unsubscribe()
    }
  }, [])
  
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: "Not authenticated" }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
      
      if (error) throw error
      
      // Refresh profile data after update
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (fetchError) throw fetchError
      
      setProfile(data)
      return { success: true }
    } catch (err: any) {
      console.error('Error updating profile:', err)
      return { error: err.message }
    }
  }
  
  const updateAvatar = async (file: File) => {
    if (!user) return { error: "Not authenticated" }
    
    try {
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        return { error: "File size must be less than 2MB" }
      }

      // Validate file type
      const fileType = file.type
      if (!fileType.startsWith('image/')) {
        return { error: "File must be an image" }
      }
      
      console.log('Ensuring avatar bucket exists and has correct permissions...')
      // Call the fix-avatar-bucket endpoint to ensure the bucket exists with proper policies
      try {
        const fixBucketResponse = await fetch('/api/storage/fix-avatar-bucket')
        const fixBucketData = await fixBucketResponse.json()
        console.log('Avatar bucket setup response:', fixBucketData)
      } catch (bucketError) {
        console.warn('Error ensuring avatar bucket exists:', bucketError)
        // Continue anyway, we'll try the upload directly
      }

      // Store old avatar path for deletion after successful upload
      let oldAvatarPath = null
      if (profile?.avatar_url) {
        try {
          const oldUrl = new URL(profile.avatar_url)
          const urlPath = oldUrl.pathname
          // Extract the path in format: /storage/v1/object/public/avatar/user_id/filename
          const matches = urlPath.match(/\/storage\/v1\/object\/public\/avatar\/(.+)$/)
          if (matches && matches[1]) {
            oldAvatarPath = matches[1] // This should be user_id/filename
          } else {
            // Try alternate format: just extract the filename after the last slash
            const oldFilename = decodeURIComponent(urlPath.split('/').pop() || '')
            if (oldFilename) {
              oldAvatarPath = `${user.id}/${oldFilename}`
            }
          }
          console.log('Old avatar path identified for deletion:', oldAvatarPath)
        } catch (err) {
          console.error('Failed to parse old avatar URL:', err)
          // Continue with upload even if we can't delete the old avatar
        }
      }

      // Create a unique file path with user ID and timestamp
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      // Upload the new avatar
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatar')
        .upload(filePath, file, {
          cacheControl: '0',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      // Get the public URL with a cache busting parameter
      const timestamp = Date.now()
      const { data: urlData } = supabase.storage
        .from('avatar')
        .getPublicUrl(filePath)

      if (!urlData?.publicUrl) {
        throw new Error("Failed to get public URL for avatar")
      }

      // Append cache busting parameter
      const publicUrlWithCacheBusting = `${urlData.publicUrl}?t=${timestamp}`

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: urlData.publicUrl, // Store the clean URL without cache busting
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Profile update error:', updateError)
        throw updateError
      }

      // Update local state
      setProfile(prev => {
        if (!prev) return null
        return {
          ...prev,
          avatar_url: urlData.publicUrl
        }
      })

      // Delete the old avatar AFTER successfully uploading and updating the new one
      if (oldAvatarPath) {
        try {
          console.log('Attempting to delete old avatar:', oldAvatarPath)
          const { error: deleteError } = await supabase.storage
            .from('avatar')
            .remove([oldAvatarPath])
          
          if (deleteError) {
            console.error('Error deleting old avatar:', deleteError)
          } else {
            console.log('Old avatar deleted successfully')
          }
        } catch (deleteErr) {
          console.error('Exception when deleting old avatar:', deleteErr)
          // Non-blocking error - we don't want to fail the avatar update if deletion fails
        }
      }

      return { 
        success: true,
        avatarUrl: urlData.publicUrl
      }
    } catch (err: any) {
      console.error('Error updating avatar:', err)
      return { 
        error: err.message || 'An unknown error occurred while updating avatar'
      }
    }
  }
  
  return {
    user,
    profile,
    isLoading,
    error,
    isAuthenticated: !!user,
    updateProfile,
    updateAvatar
  }
}