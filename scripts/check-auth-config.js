// Script to check current Supabase auth configuration
const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client with your project URL and service role key
const supabaseUrl = 'https://dojhztkwdtkvjtatfzwz.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvamh6dGt3ZHRrdmp0YXRmend6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDI2MjM1OCwiZXhwIjoyMDU5ODM4MzU4fQ.suI-M9V-fg4OBXgsWk_WsWGMDol5JzPJ_wzwpu5Khb4'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkAuthConfig() {
  console.log('Checking Supabase auth configuration...')
  
  try {
    // Try to get auth settings
    const { data: authSettings, error: authSettingsError } = await supabase
      .from('auth.config')
      .select('*')
      .limit(1)
      .single()
    
    if (authSettingsError) {
      console.error('Error getting auth settings:', authSettingsError)
    } else {
      console.log('Auth settings:', authSettings || 'No auth settings found')
    }
    
    // Check if we can access auth settings using admin API
    console.log('\nChecking admin auth access...')
    
    // Check if user exists (to test admin functionality)
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(
      '00000000-0000-0000-0000-000000000000'
    )
    
    if (userError) {
      console.log('Admin API access error:', userError)
    } else {
      console.log('Admin API accessible:', user ? 'Yes' : 'No')
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

// Run the check
checkAuthConfig() 