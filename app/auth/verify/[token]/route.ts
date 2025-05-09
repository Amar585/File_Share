import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'magiclink';
    const email = searchParams.get('email') || '';
    
    console.log('Custom verification handler called:', { token: token?.slice(0, 10) + '...', type, email });

    // If there's no token, redirect to error page
    if (!token) {
      console.error('No verification token provided');
      return NextResponse.redirect(new URL('/auth/error?error=No+verification+token+provided', request.url));
    }

    // If this is a verification link, handle it
    if (type === 'magiclink' || type === 'signup' || type === 'invite') {
      const supabase = createRouteHandlerClient({ cookies: () => cookies() });
      
      // Call Supabase to verify the token
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'magiclink',
      });
      
      if (error) {
        console.error('Error verifying token:', error);
        return NextResponse.redirect(
          new URL(`/auth/error?error=${encodeURIComponent(error.message)}`, request.url)
        );
      }
      
      // Successfully verified, redirect to login page with verified=true parameter
      console.log('Email verified successfully, redirecting to login page');
      const redirectURL = new URL('/', request.url);
      redirectURL.searchParams.set('verified', 'true');
      if (email) {
        redirectURL.searchParams.set('email', email);
      }
      
      return NextResponse.redirect(redirectURL);
    }

    // For any other case, redirect to main page
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Unexpected error in verify token handler:', error);
    return NextResponse.redirect(
      new URL('/auth/error?error=Unexpected+error+processing+verification', request.url)
    );
  }
} 