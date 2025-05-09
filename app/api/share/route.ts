import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { encrypt } from '@/lib/encryption'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'share-api' })

// POST endpoint to create a shared link for a file
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { fileId, password, expiresAt } = await request.json()
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }
    
    // Check if user owns the file
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', session.user.id)
      .single()
      
    if (fileError || !file) {
      log.error('File not found or user does not own the file', { fileId, userId: session.user.id })
      return NextResponse.json({ error: 'File not found or you do not have permission' }, { status: 404 })
    }
    
    // Generate unique share ID and token
    const shareId = uuidv4()
    const shareToken = uuidv4()
    
    // Process password if provided
    let hashedPassword = null
    let hasPassword = false
    
    if (password) {
      // Encrypt the password rather than hashing it since we need to verify it
      hashedPassword = await encrypt(password, true)
      hasPassword = true
    }
    
    // Format expiration date if provided
    let expirationDate = null
    if (expiresAt && expiresAt !== 'never') {
      expirationDate = new Date(expiresAt).toISOString()
    }
    
    // Create the share record
    const { data: share, error: shareError } = await supabase
      .from('file_shares')
      .insert({
        id: shareId,
        file_id: fileId,
        created_by: session.user.id,
        token: shareToken,
        has_password: hasPassword,
        password: hashedPassword,
        expires_at: expirationDate,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
      
    if (shareError) {
      log.error('Failed to create share record', { error: shareError })
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
    }
    
    // Also update the file to mark it as shared
    await supabase
      .from('files')
      .update({ shared: true })
      .eq('id', fileId)
      
    // Generate the shareable link
    const shareLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shared/${shareId}?token=${shareToken}`
    
    return NextResponse.json({ 
      success: true, 
      shareLink,
      shareId,
      shareToken,
      hasPassword
    })
    
  } catch (error) {
    log.error('Error creating share link', { error })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// GET endpoint to verify a shared link
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const shareId = searchParams.get('shareId')
    const token = searchParams.get('token')
    const providedPassword = searchParams.get('password')
    
    if (!shareId || !token) {
      return NextResponse.json({ error: 'Share ID and token are required' }, { status: 400 })
    }
    
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get the share record
    const { data: share, error: shareError } = await supabase
      .from('file_shares')
      .select('*, files(*)')
      .eq('id', shareId)
      .eq('token', token)
      .single()
      
    if (shareError || !share) {
      log.error('Share record not found', { shareId, token })
      return NextResponse.json({ error: 'Share link is invalid or expired' }, { status: 404 })
    }
    
    // Check if the share has expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 403 })
    }
    
    // Check if password is required
    if (share.has_password) {
      // If a password is required but not provided in this request
      if (!providedPassword) {
        return NextResponse.json({ 
          requiresPassword: true,
          fileInfo: {
            name: share.files.name,
            size: share.files.size,
            type: share.files.type
          }
        })
      }
      
      // TODO: Implement password verification
      // For now just check if they match
      const decryptedPassword = share.password // Should be decrypted in actual implementation
      
      if (providedPassword !== decryptedPassword) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 403 })
      }
    }
    
    // Return file information to allow download
    return NextResponse.json({
      success: true,
      fileInfo: {
        id: share.files.id,
        name: share.files.name,
        size: share.files.size,
        type: share.files.type,
        path: share.files.path,
        isEncrypted: share.files.is_encrypted
      }
    })
    
  } catch (error) {
    log.error('Error verifying share link', { error })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE endpoint to revoke a shared link
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const shareId = searchParams.get('shareId')
    
    if (!shareId) {
      return NextResponse.json({ error: 'Share ID is required' }, { status: 400 })
    }
    
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Delete the share record
    const { error: deleteError } = await supabase
      .from('file_shares')
      .delete()
      .eq('id', shareId)
      .eq('created_by', session.user.id)
      
    if (deleteError) {
      log.error('Failed to delete share record', { error: deleteError })
      return NextResponse.json({ error: 'Failed to revoke share link' }, { status: 500 })
    }
    
    // Check if file has any other share records
    const { data: otherShares, error: checkError } = await supabase
      .from('file_shares')
      .select('file_id')
      .eq('file_id', searchParams.get('fileId'))
      
    // If no other shares exist, update the file to mark it as not shared
    if (!checkError && (!otherShares || otherShares.length === 0)) {
      await supabase
        .from('files')
        .update({ shared: false })
        .eq('id', searchParams.get('fileId'))
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    log.error('Error revoking share link', { error })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
