import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase/database.types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id
    
    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in to manage access requests' },
        { status: 401 }
      )
    }
    
    const userId = session.user.id
    const body = await req.json()
    const { status, responseMessage } = body
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status (approved or rejected) is required' },
        { status: 400 }
      )
    }
    
    // Get the access request to verify ownership
    const { data: requestData, error: fetchError } = await supabase
      .from('file_access_requests')
      .select('owner_id, requester_id, file_id, status')
      .eq('id', requestId)
      .single()
    
    if (fetchError) {
      console.error('Error fetching access request:', fetchError)
      return NextResponse.json(
        { error: `Failed to fetch access request: ${fetchError.message}` },
        { status: 500 }
      )
    }
    
    if (!requestData) {
      return NextResponse.json(
        { error: 'Access request not found' },
        { status: 404 }
      )
    }
    
    // Verify the user is the owner of the file
    if (requestData.owner_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Only file owners can manage access requests' },
        { status: 403 }
      )
    }
    
    // Verify the request is in pending state
    if (requestData.status !== 'pending') {
      return NextResponse.json(
        { error: `Request has already been ${requestData.status}` },
        { status: 409 }
      )
    }
    
    // Update the access request
    const { error: updateError } = await supabase
      .from('file_access_requests')
      .update({
        status,
        response_message: responseMessage || null,
        responded_at: new Date().toISOString()
      })
      .eq('id', requestId)
    
    if (updateError) {
      console.error('Error updating access request:', updateError)
      return NextResponse.json(
        { error: `Failed to update access request: ${updateError.message}` },
        { status: 500 }
      )
    }
    
    // Create a notification for the requester
    await createAccessResponseNotification(
      requestData.requester_id,
      userId,
      requestData.file_id,
      status,
      responseMessage
    )
    
    return NextResponse.json({
      success: true,
      message: `Access request ${status} successfully`
    })
  } catch (error: any) {
    console.error('Exception in updating access request:', error)
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
}

// Helper function to create a notification for the requester
async function createAccessResponseNotification(
  requesterId: string,
  ownerId: string,
  fileId: string,
  status: string,
  responseMessage?: string
) {
  try {
    // Use service role client to create notification even with RLS
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables for notification creation')
      return
    }
    
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Get owner email from auth.users
    const { data: userData, error: userError } = await serviceClient
      .auth
      .admin
      .getUserById(ownerId)
    
    // Get owner profile info for full name
    const { data: profileData, error: profileError } = await serviceClient
      .from('profiles')
      .select('full_name')
      .eq('id', ownerId)
      .single()
    
    // Combine the data
    const ownerData = {
      email: userData?.user?.email,
      full_name: profileData?.full_name
    }
    
    // Get file info
    const { data: fileData, error: fileError } = await serviceClient
      .from('files')
      .select('name')
      .eq('id', fileId)
      .single()
    
    if (userError) {
      console.error('Error getting owner user data:', userError)
      // Continue with a generic owner name
    }
    
    if (fileError) {
      console.error('Error getting file data:', fileError)
      // Continue with generic file name
    }
    
    const ownerName = ownerData?.full_name || ownerData?.email || 'The file owner'
    const fileName = fileData?.name || 'the requested file'
    const statusCapitalized = status.charAt(0).toUpperCase() + status.slice(1)
    
    // Create the notification
    try {
      const { data: insertData, error: insertError } = await serviceClient
        .from('notifications')
        .insert({
          user_id: requesterId,
          type: `access_request_${status}`,
          title: `Access Request ${statusCapitalized}`,
          message: `${ownerName} has ${status} your request to access: ${fileName}${
            responseMessage ? ` - "${responseMessage}"` : ''
          }`,
          read: false,
          metadata: {
            file_id: fileId,
            owner_id: ownerId,
            status
          }
        })
        .select()
      
      if (insertError) {
        console.error('Error creating notification:', insertError)
      } else {
        console.log('Response notification created successfully')
      }
    } catch (error) {
      console.error('Exception creating notification:', error)
    }
  } catch (error) {
    console.error('Error creating notification:', error)
    // Don't throw, just log - we don't want to fail the request update
    // if notification creation fails
  }
} 