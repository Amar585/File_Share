import { NextResponse } from 'next/server'
import { initializeSupabase } from '@/lib/supabase/init'

// This route will be called during app initialization
export async function GET() {
  try {
    await initializeSupabase()
    return NextResponse.json({ success: true, message: 'Supabase initialized successfully' })
  } catch (error) {
    console.error('Failed to initialize Supabase:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to initialize Supabase' },
      { status: 500 }
    )
  }
} 