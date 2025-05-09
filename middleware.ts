import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // First, check if this is a Supabase verification URL from email
  const url = new URL(req.url)
  const fullUrl = url.toString()
  
  // Log all URLs for debugging
  console.log('Middleware: Processing URL:', fullUrl)
  
  // Get the Supabase client
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // Check if this is a Supabase verification link using different patterns
  // Pattern 1: Contains supabase.co/auth/v1/verify and token parameter
  if (fullUrl.includes('supabase.co/auth/v1/verify') && url.searchParams.has('token')) {
    console.log('Middleware: Intercepting Supabase verification URL (Pattern 1)')
    
    // Extract token and other parameters
    const token = url.searchParams.get('token') || ''
    const type = url.searchParams.get('type') || 'magiclink'
    // Extract email from the redirect_to parameter if available
    const redirectTo = url.searchParams.get('redirect_to') || ''
    let email = ''
    
    try {
      // Try to extract email from redirect_to
      if (redirectTo) {
        const redirectUrl = new URL(decodeURIComponent(redirectTo))
        email = redirectUrl.searchParams.get('email') || ''
      }
    } catch (error) {
      console.error('Error parsing redirect_to URL:', error)
    }
    
    // Create redirect URL to our app with the login modal parameters
    const redirectUrl = new URL('/', url.origin)
    redirectUrl.searchParams.set('verified', 'true')
    
    if (email) {
      redirectUrl.searchParams.set('email', email)

      // Try to verify the user's email in Supabase
      try {
        // First check if this is an unconfirmed user
        const { data: { user } } = await supabase.auth.getUser()
        if (user && !user.email_confirmed_at && user.email === email) {
          console.log('Middleware: Confirming email for user:', email)
          
          // Use admin client to confirm user's email
          // Note: In a middleware we can't use the service role key directly
          // So we'll redirect to an API endpoint that will handle the confirmation
          const confirmUrl = new URL('/api/auth/confirm-email', url.origin)
          confirmUrl.searchParams.set('email', email)
          confirmUrl.searchParams.set('token', token) 
          
          // Make the API call to confirm the email
          await fetch(confirmUrl.toString(), { method: 'POST' })
          console.log('Middleware: Email confirmation request sent')
        }
      } catch (error) {
        console.error('Middleware: Error confirming email:', error)
      }
    }
    
    console.log('Middleware: Redirecting to:', redirectUrl.toString())
    return NextResponse.redirect(redirectUrl)
  }
  
  // Pattern 2: URL contains /verify and has token parameter
  if (url.pathname.includes('/verify') && url.searchParams.has('token')) {
    console.log('Middleware: Intercepting verification URL (Pattern 2)')
    
    // Get the email if it exists in the URL
    const email = url.searchParams.get('email') || ''
    const token = url.searchParams.get('token') || ''
    
    // Create a new URL to our home page with the login modal parameters
    const redirectUrl = new URL('/', url.origin)
    redirectUrl.searchParams.set('verified', 'true')
    
    if (email) {
      redirectUrl.searchParams.set('email', email)
      
      // Try to verify the user's email
      try {
        // First check if this is an unconfirmed user
        const { data: { user } } = await supabase.auth.getUser()
        if (user && !user.email_confirmed_at && user.email === email) {
          console.log('Middleware: Confirming email for user:', email)
          
          // Redirect to an API endpoint that will handle the confirmation
          const confirmUrl = new URL('/api/auth/confirm-email', url.origin)
          confirmUrl.searchParams.set('email', email)
          confirmUrl.searchParams.set('token', token)
          
          // Make the API call to confirm the email
          await fetch(confirmUrl.toString(), { method: 'POST' })
          console.log('Middleware: Email confirmation request sent')
        }
      } catch (error) {
        console.error('Middleware: Error confirming email:', error)
      }
    }
    
    console.log('Middleware: Redirecting to:', redirectUrl.toString())
    return NextResponse.redirect(redirectUrl)
  }
  
  // Handle direct login links with verified=true parameter
  if (url.searchParams.has('verified') && url.searchParams.has('email')) {
    const email = url.searchParams.get('email') || ''
    
    console.log('Middleware: Direct login link detected with email:', email)
    
    // Automatically confirm the email when the verification link is clicked
    try {
      // Call our auto-confirm endpoint
      const confirmUrl = new URL('/api/auth/auto-confirm-email', url.origin)
      confirmUrl.searchParams.set('email', email)
      
      console.log('Middleware: Attempting to auto-confirm email:', email)
      const response = await fetch(confirmUrl.toString(), { 
        method: 'POST',
        // Add cache: 'no-store' to prevent caching issues
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      console.log('Middleware: Auto-confirm response:', data)
      
      if (data.success) {
        console.log('Middleware: Email successfully confirmed for:', email)
        // No need to do anything else, just let the request proceed
        // The login modal will be shown with the verified=true parameter
      } else {
        console.log('Middleware: Email confirmation failed for:', email)
      }
    } catch (error) {
      console.error('Middleware: Error in email confirmation:', error)
    }
    
    // Continue with the request so the login modal is shown as normal
    return res
  }
  
  // Continue with the rest of the middleware logic
  
  // Refresh session if expired
  const { data: { session } } = await supabase.auth.getSession()

  // API routes for authentication
  if (req.nextUrl.pathname.startsWith('/api/auth')) {
    return res
  }

  // Handle auth routes
  if (['/auth/callback', '/auth/verify'].some(path => req.nextUrl.pathname.startsWith(path))) {
    return res
  }

  // Protected routes
  if (!session && [
    '/dashboard',
    '/my-files',
    '/shared-files',
    '/upload',
    '/profile',
    '/settings'
  ].some(path => req.nextUrl.pathname.startsWith(path))) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect authenticated users away from auth pages
  if (session && ['/login', '/register'].includes(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
