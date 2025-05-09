import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// For configuring Supabase email, you need to:
// 1. Configure SMTP settings in the Supabase Dashboard
// 2. Make sure redirect URLs are properly set
export async function configureSupabaseEmail() {
  try {
    // Verify that required SMTP settings are present
    const requiredEnvVars = [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
      'SENDER_EMAIL',
      'NEXT_PUBLIC_SITE_URL'
    ]
    
    const missingVars = requiredEnvVars.filter(name => !process.env[name])
    
    if (missingVars.length > 0) {
      console.warn(`Missing SMTP environment variables: ${missingVars.join(', ')}`)
      console.warn('Email verification may not work correctly without proper SMTP configuration')
      return
    }
    
    // Email settings must be configured in the Supabase Dashboard
    console.log('SMTP configuration variables found')
    console.log('Site URL:', process.env.NEXT_PUBLIC_SITE_URL)
    
    // Check if we can access the auth API
    try {
      // Test if admin API is accessible by trying to get a non-existent user
      await supabaseAdmin.auth.admin.getUserById('00000000-0000-0000-0000-000000000000')
    } catch (error: any) {
      // We expect a 404, which means the admin API is working but user not found
      if (error?.status === 404) {
        console.log('Supabase Auth admin API is accessible')
      } else {
        console.warn('Supabase Auth admin API may not be accessible:', error)
      }
    }
    
    console.log('Supabase email configuration check completed')
    console.log('Please ensure SMTP settings are configured in the Supabase Dashboard')
    console.log('- Go to https://supabase.com/dashboard/project/dojhztkwdtkvjtatfzwz/auth/templates')
    console.log('- Scroll down to SMTP Settings and enter your credentials')
  } catch (error) {
    console.error('Failed to verify Supabase connection:', error)
  }
}
