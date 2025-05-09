import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    console.log('API route - attempting signup for:', email)
    
    const { data, error } = await supabase.auth.signUp({
      email, 
      password,
      options: {
        emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
      }
    })
    
    if (error) {
      console.error('API route - signup error:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          details: error
        }, 
        { status: 400 }
      )
    }
    
    // Return success response with user data
    return NextResponse.json({ 
      success: true, 
      user: data.user,
      message: data.user?.email_confirmed_at 
        ? 'User already confirmed' 
        : 'Check your email for the confirmation link'
    })
    
  } catch (error: any) {
    console.error('API route - unexpected error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'An unexpected error occurred',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    )
  }
} 