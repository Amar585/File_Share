import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/'
  const error = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  const type = searchParams.get('type') || ''
  const email = searchParams.get('email') || ''

  console.log("Auth callback route - params:", { 
    code: code ? "exists" : "missing", 
    next, 
    type, 
    email,
    error: error || "none",
    error_description: error_description || "none"
  })

  // If there's an error or error description, redirect to error page
  if (error || error_description) {
    console.error("Auth callback error:", error, error_description)
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(error_description || 'Unknown error')}`, request.url)
    )
  }

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    console.log("Auth callback - Exchanging code for session")
    
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error("Error exchanging code for session:", error)
      return NextResponse.redirect(
        new URL(`/auth/error?error=${encodeURIComponent(error.message)}`, request.url)
      )
    }

    console.log("Auth callback - Session established for user:", data?.user?.id)

    // Get the user's email
    const userEmail = email || (data?.user?.email || '')
    
    // Create the redirect URL with proper parameters to open login modal
    const redirectURL = new URL('/', request.url)
    redirectURL.searchParams.set('verified', 'true')
    redirectURL.searchParams.set('email', userEmail)
    
    console.log("Auth callback - Redirecting to:", redirectURL.toString())
    
    // Always redirect to the landing page with verified=true and email parameters
    // This will trigger the login modal to open automatically
    return NextResponse.redirect(redirectURL)
  }

  // If no code is provided, redirect to main login page
  console.log("Auth callback - No code, redirecting to home page")
  return NextResponse.redirect(new URL('/', request.url))
}
