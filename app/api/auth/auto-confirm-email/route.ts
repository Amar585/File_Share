import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Admin client for direct operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function POST(request: Request) {
  try {
    // Get email from URL parameters
    const url = new URL(request.url)
    const email = url.searchParams.get('email')
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }
    
    console.log(`Auto Confirm Email API - Automatically confirming email for: ${email}`)
    
    // Find the user by email
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (userError) {
      console.error('Auto Confirm Email API - Error finding users:', userError)
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve users' },
        { status: 500 }
      )
    }
    
    // Find the specific user with this email
    const user = users.find(u => u.email === email && !u.email_confirmed_at)
    
    if (!user) {
      console.log('Auto Confirm Email API - No unconfirmed user found with email:', email)
      return NextResponse.json(
        { success: false, error: 'No unconfirmed user found' },
        { status: 404 }
      )
    }
    
    // User found, update their email confirmation status using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    )
    
    if (updateError) {
      console.error('Auto Confirm Email API - Error confirming email:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to confirm email' },
        { status: 500 }
      )
    }
    
    console.log(`Auto Confirm Email API - Email confirmed successfully for: ${email}`)
    
    return NextResponse.json({
      success: true,
      message: 'Email auto-confirmed successfully',
    })
  } catch (error: any) {
    console.error('Auto Confirm Email API - Unexpected error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
} 