"use client"

import { useEffect, useState } from 'react'
import { supabase } from "@/lib/supabase/client"
import { toast } from 'sonner'
import { useUser } from './use-user'
import { Database } from '@/lib/supabase/database.types'

type UserSettings = Database['public']['Tables']['user_settings']['Row']
type NotificationType = 'file_shared' | 'file_downloaded' | 'access_requested'

export function useUserSettings() {
  const { user, isLoading: userLoading } = useUser()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        
        const { data, error: fetchError } = await supabase
          .from('user_settings')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (fetchError) {
          throw fetchError
        }
        
        setSettings(data)
      } catch (err: any) {
        console.error('Error fetching user settings:', err)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    
    if (!userLoading) {
      fetchSettings()
    }
  }, [user, userLoading])
  
  const updateSettings = async (updates: Partial<Database['public']['Tables']['user_settings']['Update']>) => {
    if (!user) return { error: "Not authenticated" }
    
    try {
      setIsLoading(true)
      
      const { error } = await supabase
        .from('user_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
      
      if (error) throw error
      
      // Refresh settings after update
      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (fetchError) throw fetchError
      
      setSettings(data)
      return { success: true }
    } catch (err: any) {
      console.error('Error updating user settings:', err)
      return { error: err.message }
    } finally {
      setIsLoading(false)
    }
  }
  
  const toggleTwoFactorAuth = async (enabled: boolean) => {
    // In a real app, this would involve more steps like OTP verification
    const result = await updateSettings({ two_factor_enabled: enabled })
    if (result.success) {
      toast.success(`Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`)
    } else {
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} two-factor authentication`)
    }
    return result
  }
  
  const updateFilePrivacySettings = async (privateByDefault: boolean, requireApproval: boolean) => {
    const result = await updateSettings({
      private_files_by_default: privateByDefault,
      require_approval_for_access: requireApproval
    })
    
    if (result.success) {
      toast.success('File privacy settings updated')
    } else {
      toast.error('Failed to update file privacy settings')
    }
    return result
  }
  
  const updateNotificationSettings = async (
    emailEnabled: boolean, 
    pushEnabled: boolean,
    notificationTypes?: Record<NotificationType, boolean>
  ) => {
    const updates: Partial<Database['public']['Tables']['user_settings']['Update']> = {
      email_notifications_enabled: emailEnabled,
      push_notifications_enabled: pushEnabled,
    }
    
    if (notificationTypes) {
      updates.notification_types = notificationTypes
    }
    
    const result = await updateSettings(updates)
    
    if (result.success) {
      toast.success('Notification settings updated')
    } else {
      toast.error('Failed to update notification settings')
    }
    return result
  }
  
  const updateLanguage = async (language: string) => {
    const result = await updateSettings({ language })
    
    if (result.success) {
      toast.success(`Language set to ${language}`)
    } else {
      toast.error('Failed to update language preference')
    }
    return result
  }
  
  const signOutFromAllDevices = async () => {
    if (!user) return { error: "Not authenticated" }
    
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      
      if (error) throw error
      
      toast.success('Signed out from all devices')
      window.location.href = '/'
      return { success: true }
    } catch (err: any) {
      toast.error('Failed to sign out from all devices')
      console.error('Error signing out from all devices:', err)
      return { error: err.message }
    }
  }

  return {
    settings,
    isLoading: isLoading || userLoading,
    error,
    updateSettings,
    toggleTwoFactorAuth,
    updateFilePrivacySettings,
    updateNotificationSettings,
    updateLanguage,
    signOutFromAllDevices
  }
} 