import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const cookieStore = cookies()
    
    // Create Supabase client with correct type for cookies
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            Cookie: cookieStore.toString()
          },
        },
      }
    )
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        message: 'Not authenticated' 
      }, { status: 401 })
    }
    
    // Check if user settings exist
    const { data: existingSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('id')
      .eq('id', user.id)
      .single()
    
    if (settingsError && settingsError.code !== 'PGRST116') { // Not found error code
      return NextResponse.json({ 
        success: false, 
        message: `Error checking user settings: ${settingsError.message}` 
      }, { status: 500 })
    }
    
    // If settings already exist, nothing to do
    if (existingSettings) {
      return NextResponse.json({ 
        success: true, 
        message: 'User settings already exist' 
      })
    }
    
    // Create user settings
    const { error: insertError } = await supabase
      .from('user_settings')
      .insert({
        id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        two_factor_enabled: false,
        private_files_by_default: true,
        require_approval_for_access: true,
        email_notifications_enabled: true,
        push_notifications_enabled: true,
        language: 'english',
        notification_types: {
          file_shared: true,
          file_downloaded: true,
          access_requested: true
        }
      })
    
    if (insertError) {
      return NextResponse.json({ 
        success: false, 
        message: `Error creating user settings: ${insertError.message}` 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'User settings initialized successfully' 
    })
  } catch (error: any) {
    console.error('Error initializing user settings:', error)
    return NextResponse.json({ 
      success: false, 
      message: `Error initializing user settings: ${error.message}` 
    }, { status: 500 })
  }
} 