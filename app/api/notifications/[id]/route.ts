import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase/database.types'

// Mark notification as read
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Get authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const userId = session.user.id
    const notificationId = params.id
    
    // Verify notification belongs to the user before updating
    const { data: notification, error: checkError } = await supabase
      .from('notifications')
      .select('id, user_id')
      .eq('id', notificationId)
      .single()
    
    if (checkError) {
      console.error('Error checking notification:', checkError)
      return NextResponse.json(
        { error: 'Failed to verify notification ownership' },
        { status: 500 }
      )
    }
    
    if (!notification || notification.user_id !== userId) {
      return NextResponse.json(
        { error: 'Notification not found or not owned by you' },
        { status: 404 }
      )
    }
    
    // Mark notification as read
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
    
    if (updateError) {
      console.error('Error marking notification as read:', updateError)
      return NextResponse.json(
        { error: 'Failed to mark notification as read' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Notification marked as read'
    })
  } catch (error: any) {
    console.error('Exception in notification PATCH API:', error)
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
}

// Delete notification
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('DELETE notification requested for:', params.id)
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Get authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      console.error('Unauthorized DELETE attempt:', sessionError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const userId = session.user.id
    const notificationId = params.id
    
    console.log(`Attempting to delete notification ${notificationId} for user ${userId}`)
    
    // First check if notification exists and belongs to user
    const { data: checkData, error: checkError } = await supabase
      .from('notifications')
      .select('id')
      .eq('id', notificationId)
      .eq('user_id', userId)
      .single()
    
    if (checkError) {
      console.error(`Error finding notification ${notificationId}:`, checkError)
      return NextResponse.json(
        { error: 'Notification not found or not owned by you' },
        { status: 404 }
      )
    }
    
    // Delete notification (with user_id check for security)
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId)
    
    if (deleteError) {
      console.error(`Error deleting notification ${notificationId}:`, deleteError)
      return NextResponse.json(
        { error: 'Failed to delete notification' },
        { status: 500 }
      )
    }
    
    console.log(`Successfully deleted notification ${notificationId}`)
    return NextResponse.json({
      success: true,
      message: 'Notification deleted'
    })
  } catch (error: any) {
    console.error('Exception in notification DELETE API:', error)
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
} 