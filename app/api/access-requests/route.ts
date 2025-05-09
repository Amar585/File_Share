import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase/database.types'

// Handle GET requests to fetch access requests for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const requestUrl = new URL(req.url)
    const type = requestUrl.searchParams.get('type') // 'sent' or 'received'
    
    // Get authenticated user
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in to view access requests' },
        { status: 401 }
      )
    }
    
    const userId = session.user.id
    let query = supabase.from('file_access_requests').select(`
      id, 
      created_at, 
      status, 
      message, 
      response_message, 
      responded_at,
      file_id,
      requester_id,
      owner_id,
      files:file_id (name, type, size, path, shared),
      requester:requester_id (email, full_name),
      owner:owner_id (email, full_name)
    `)
    
    // Filter based on request type
    if (type === 'sent') {
      query = query.eq('requester_id', userId)
    } else {
      // Default to received requests
      query = query.eq('owner_id', userId)
    }
    
    // Execute query and order by created_at
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching access requests:', error)
      return NextResponse.json(
        { error: `Failed to fetch access requests: ${error.message}` },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      requests: data || []
    })
  } catch (error: any) {
    console.error('Exception in access requests API:', error)
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
}

// Handle POST requests to create a new access request
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      console.error('Auth error when creating access request:', sessionError)
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in to request file access' },
        { status: 401 }
      )
    }
    
    const userId = session.user.id
    const body = await req.json()
    const { fileId, message } = body
    
    console.log('Access request - received payload:', { userId, fileId, message })
    
    if (!fileId || !message) {
      return NextResponse.json(
        { error: 'File ID and message are required' },
        { status: 400 }
      )
    }

    // Check if the table exists first
    try {
      // Try a simple query to check if the table exists
      const { error: tableCheckError } = await supabase
        .from('file_access_requests')
        .select('id')
        .limit(1)
      
      if (tableCheckError) {
        console.error('Error checking file_access_requests table:', tableCheckError)
        if (tableCheckError.message?.includes('relation') && tableCheckError.message?.includes('does not exist')) {
          return NextResponse.json(
            { error: 'The file_access_requests table does not exist. Please set up the database first.' },
            { status: 500 }
          )
        }
      }
    } catch (tableCheckError: any) {
      console.error('Exception checking file_access_requests table:', tableCheckError)
      return NextResponse.json(
        { error: `Database error: ${tableCheckError.message}` },
        { status: 500 }
      )
    }
    
    // Get file details to get the owner ID
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('user_id, shared')
      .eq('id', fileId)
      .single()
    
    if (fileError) {
      console.error('Error getting file details:', fileError)
      return NextResponse.json(
        { error: `Failed to get file details: ${fileError.message}` },
        { status: 500 }
      )
    }
    
    if (!fileData) {
      console.error('File not found for ID:', fileId)
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }
    
    console.log('Retrieved file data:', fileData)
    
    // Verify the file is shared
    if (!fileData.shared) {
      return NextResponse.json(
        { error: 'This file is not available for access requests' },
        { status: 403 }
      )
    }
    
    // Prevent requesting access to your own file
    if (fileData.user_id === userId) {
      return NextResponse.json(
        { error: "You can't request access to your own file" },
        { status: 400 }
      )
    }
    
    // Check if there's already a pending request for this file and user
    const { data: existingRequest, error: checkError } = await supabase
      .from('file_access_requests')
      .select('id, status')
      .eq('file_id', fileId)
      .eq('requester_id', userId)
      .eq('status', 'pending')
      .maybeSingle()
    
    if (checkError) {
      console.error('Error checking existing requests:', checkError)
      return NextResponse.json(
        { error: `Failed to check existing requests: ${checkError.message}` },
        { status: 500 }
      )
    }
    
    if (existingRequest) {
      console.log('User already has a pending request for this file:', existingRequest)
      return NextResponse.json(
        { error: 'You already have a pending request for this file' },
        { status: 409 }
      )
    }
    
    console.log('Creating access request for file owned by:', fileData.user_id)
    
    // Create the access request
    const { data: newRequest, error: createError } = await supabase
      .from('file_access_requests')
      .insert({
        file_id: fileId,
        requester_id: userId,
        owner_id: fileData.user_id,
        message,
        status: 'pending'
      })
      .select('*')
      .single()
    
    if (createError) {
      console.error('Error creating access request:', createError)
      return NextResponse.json(
        { error: `Failed to create access request: ${createError.message}` },
        { status: 500 }
      )
    }
    
    console.log('Access request created successfully:', newRequest)
    
    // Create a notification for the file owner
    await createAccessRequestNotification(fileData.user_id, userId, fileId)
    
    console.log('Access request process completed')
    
    return NextResponse.json({
      success: true,
      message: 'Access request submitted successfully',
      requestId: newRequest?.id
    })
  } catch (error: any) {
    console.error('Exception in creating access request:', error)
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
}

// Helper function to create a notification
async function createAccessRequestNotification(
  ownerId: string,
  requesterId: string,
  fileId: string
) {
  try {
    console.log('Creating notification for owner:', { ownerId, requesterId, fileId })
    
    // Use service role client to create notification even with RLS
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables for notification creation')
      return
    }
    
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // First get requester info from auth.users to get email
    const { data: userData, error: userError } = await serviceClient
      .auth
      .admin
      .getUserById(requesterId)
    
    // Get requester profile info for full name
    const { data: profileData, error: profileError } = await serviceClient
      .from('profiles')
      .select('full_name')
      .eq('id', requesterId)
      .single()
    
    // Combine the data
    const requesterData = {
      email: userData?.user?.email,
      full_name: profileData?.full_name
    }
    
    // If we have a problem getting the user info, create a fallback notification
    if (userError) {
      console.error('Error getting requester user data:', userError)
      
      // Create a fallback notification
      try {
        await serviceClient
          .from('notifications')
          .insert({
            user_id: ownerId,
            type: 'access_requested',
            title: 'New Access Request',
            message: `A user has requested access to your file`,
            read: false,
            metadata: {
              file_id: fileId,
              requester_id: requesterId
            }
          })
        console.log('Created fallback notification without requester data')
        return
      } catch (fallbackError) {
        console.error('Failed to create fallback notification:', fallbackError)
        return
      }
    }
    
    // Get file info
    const { data: fileData, error: fileError } = await serviceClient
      .from('files')
      .select('name')
      .eq('id', fileId)
      .single()
    
    if (fileError) {
      console.error('Error getting file data:', fileError)
      
      // Create a fallback notification if we can't get the file info
      try {
        const requesterName = requesterData?.full_name || requesterData?.email || 'A user'
        await serviceClient
          .from('notifications')
          .insert({
            user_id: ownerId,
            type: 'access_requested',
            title: 'New Access Request',
            message: `${requesterName} has requested access to your file`,
            read: false,
            metadata: {
              file_id: fileId,
              requester_id: requesterId
            }
          })
        console.log('Created fallback notification without file data')
        return
      } catch (fallbackError) {
        console.error('Failed to create fallback notification:', fallbackError)
        return
      }
    }
    
    const requesterName = requesterData.full_name || requesterData.email || 'A user'
    
    // Create the notification using raw insert
    try {
      const { data: insertData, error: insertError } = await serviceClient
        .from('notifications')
        .insert({
          user_id: ownerId,
          type: 'access_requested',
          title: 'New Access Request',
          message: `${requesterName} has requested access to your file: ${fileData.name}`,
          read: false,
          metadata: {
            file_id: fileId,
            requester_id: requesterId
          }
        })
        .select()
      
      if (insertError) {
        console.error('Error inserting notification:', insertError)
        return
      }
      
      console.log('Notification created successfully:', insertData)
    } catch (insertError) {
      console.error('Exception during notification insert:', insertError)
    }
  } catch (error) {
    console.error('Error creating notification:', error)
    // Don't throw, just log - we don't want to fail the access request
    // if notification creation fails
  }
} 