import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const email = searchParams.get('email') || '';
  const type = searchParams.get('type') || '';
  
  console.log('Root verify handler intercepted:', { 
    hasToken: token ? 'yes' : 'no',
    email,
    type,
    url: request.url
  });
  
  // This is a Supabase verification link
  // Redirect to our homepage with params to show login modal
  const redirectUrl = new URL('/', request.url);
  redirectUrl.searchParams.set('verified', 'true');
  
  if (email) {
    redirectUrl.searchParams.set('email', email);
  }
  
  console.log('Redirecting verification to:', redirectUrl.toString());
  return NextResponse.redirect(redirectUrl);
} 