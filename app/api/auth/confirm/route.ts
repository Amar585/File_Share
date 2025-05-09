import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const next = searchParams.get('next') ?? '/dashboard'

    if (token_hash && type) {
      const supabase = createRouteHandlerClient({ cookies })
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      })
      
      if (error) {
        console.error('Verification error:', error)
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
        )
      }
      
      return NextResponse.redirect(new URL(next, request.url))
    }

    // Return to login if there's no token
    return NextResponse.redirect(new URL('/login', request.url))
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.redirect(
      new URL('/login?error=Something%20went%20wrong', request.url)
    )
  }
}
