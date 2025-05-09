import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  console.log('Logout API called')
  try {
    const supabase = createServerComponentClient({ cookies })
    
    await supabase.auth.signOut()
    console.log('Supabase signOut successful')
    
    return NextResponse.json({
      success: true,
      message: 'Successfully logged out'
    })
  } catch (error: any) {
    console.error('Error during logout:', error)
    return NextResponse.json({
      success: false,
      message: `Error during logout: ${error.message}`
    }, { status: 500 })
  }
} 