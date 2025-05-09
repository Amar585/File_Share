import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || '';
    const status = searchParams.get('status') || 'pending';
    
    console.log('Verify redirect handler called:', { email, status });
    
    // Create URL to the home page with parameters to open login modal
    const redirectURL = new URL('/', request.url);
    
    // For successful verification, add verified=true
    if (status === 'success') {
      redirectURL.searchParams.set('verified', 'true');
    }
    
    // Always include email if available
    if (email) {
      redirectURL.searchParams.set('email', email);
    }
    
    console.log('Redirecting to:', redirectURL.toString());
    return NextResponse.redirect(redirectURL);
  } catch (error) {
    console.error('Error in verify-redirect handler:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
} 