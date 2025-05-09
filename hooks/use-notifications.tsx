"use client"

import { useEffect, useState } from 'react'
import { supabase } from "@/lib/supabase/client"
import { useUser } from './use-user'
import { toast } from 'sonner'
import { Database } from '@/lib/supabase/database.types'

type Notification = Database['public']['Tables']['notifications']['Row']

export function useNotifications() {
  const { user, isLoading: userLoading } = useUser()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Function to fetch notifications
  const fetchNotifications = async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (fetchError) {
        throw fetchError
      }
      
      const notificationList = data || []
      setNotifications(notificationList)
      setUnreadCount(notificationList.filter(n => !n.read).length)
    } catch (err: any) {
      console.error('Error fetching notifications:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Subscribe to new notifications and fetch initial notifications
  useEffect(() => {
    if (!user) return

    fetchNotifications()

    // Subscribe to notifications for this user in real-time
    const subscription = supabase
      .channel('public:notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        // Add new notification to the state
        const newNotification = payload.new as Notification
        setNotifications(prev => [newNotification, ...prev])
        setUnreadCount(prev => prev + 1)
        
        // Show a toast notification
        toast.info(newNotification.title, {
          description: newNotification.message,
          duration: 5000,
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        // Update notification in the state
        const updatedNotification = payload.new as Notification
        setNotifications(prev => 
          prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
        )
        
        // Recalculate unread count if changed from unread to read
        const oldNotif = payload.old as Notification
        if (!oldNotif.read && updatedNotification.read) {
          setUnreadCount(prev => prev - 1)
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        // Remove deleted notification from state
        const deletedNotification = payload.old as Notification
        setNotifications(prev => prev.filter(n => n.id !== deletedNotification.id))
        
        // Update unread count if needed
        if (!deletedNotification.read) {
          setUnreadCount(prev => prev - 1)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [user])

  // Mark notification as read
  const markAsRead = async (id: string) => {
    if (!user) return { error: "Not authenticated" }
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id)
      
      if (error) throw error
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => prev - 1)
      
      return { success: true }
    } catch (err: any) {
      console.error('Error marking notification as read:', err)
      return { error: err.message }
    }
  }

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return { error: "Not authenticated" }
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
      
      if (error) throw error
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      )
      setUnreadCount(0)
      
      return { success: true }
    } catch (err: any) {
      console.error('Error marking all notifications as read:', err)
      return { error: err.message }
    }
  }

  // Delete a notification
  const deleteNotification = async (id: string) => {
    if (!user) return { error: "Not authenticated" }
    
    try {
      console.log(`Attempting to delete notification ${id}`)
      // Use the API endpoint instead of direct Supabase call
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error(`Error response from delete API:`, data);
        throw new Error(data.error || 'Failed to delete notification');
      } else {
        console.log(`Successfully deleted notification ${id} via API`)
      }
      
      // Update local state
      const notification = notifications.find(n => n.id === id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (notification && !notification.read) {
        setUnreadCount(prev => prev - 1)
      }
      
      return { success: true }
    } catch (err: any) {
      console.error(`Error deleting notification ${id}:`, err)
      return { error: err.message }
    }
  }

  return {
    notifications,
    unreadCount,
    isLoading: isLoading || userLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  }
} 