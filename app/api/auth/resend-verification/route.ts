import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createDirectLoginLink } from '@/lib/email/verification-links'

// Admin client for direct operations
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

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }
    
    console.log(`Resend verification - attempting for: ${email}`)
    
    // Get the site URL for redirects
    // Use NEXT_PUBLIC_SITE_URL if available, otherwise construct from request
    const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    console.log('Resend verification - site base URL for redirects:', siteBaseUrl)
    
    // Create a direct login link that will definitely work
    const directLoginLink = createDirectLoginLink(siteBaseUrl, email)
    console.log('Resend verification - direct login link:', directLoginLink)
    
    // Instead of trying Supabase first, let's go straight to our direct SMTP which we know works
    // from our earlier tests. We'll fallback to Supabase if SMTP fails.
    
    // Setup SMTP configuration
    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      sender: process.env.SENDER_EMAIL || process.env.SMTP_USER
    }
    
    // Log SMTP configuration for debugging (without exposing the password)
    console.log('Resend verification - SMTP Config:', {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.user,
      sender: smtpConfig.sender
    })
    
    // Check if SMTP is configured
    if (!smtpConfig.user || !smtpConfig.pass) {
      console.error('Resend verification - SMTP not configured properly:', smtpConfig.user ? 'has user' : 'no user')
      console.log('Resend verification - Falling back to Supabase email delivery')
      return await useFallbackSupabaseMail(email, siteBaseUrl)
    }
    
    // Generate a verification token for the user
    // We'll try a few different types of links to see which works best
    
    // First try a magic link which often works well
    console.log('Resend verification - Generating magic link')
    const { data: magicLinkData, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${siteBaseUrl}/auth/callback?type=signup&email=${encodeURIComponent(email)}`
      }
    })
    
    if (magicLinkError) {
      console.error('Resend verification - Error generating magic link:', magicLinkError)
      // If magic link fails, try recovery link
      console.log('Resend verification - Falling back to recovery link')
      return await useFallbackSupabaseMail(email, siteBaseUrl)
    }
    
    // Get the action link from the generated token
    const actionLink = magicLinkData?.properties?.action_link
    
    if (!actionLink) {
      console.error('Resend verification - No magic link generated')
      return await useFallbackSupabaseMail(email, siteBaseUrl)
    }
    
    console.log('Resend verification - Action link generated:', actionLink.substring(0, 50) + '...')
    
    try {
      // Create a transporter for sending email
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
        debug: true, // Enable debug output
        logger: true, // Log to console
      })
      
      // Verify the connection configuration
      console.log('Resend verification - Verifying SMTP connection...')
      const verifyResult = await transporter.verify()
      console.log('Resend verification - SMTP verification result:', verifyResult)
      
      // Create a custom redirect URL that will show the login modal directly
      const verificationCallbackUrl = `${siteBaseUrl}/?verified=true&email=${encodeURIComponent(email)}`
      console.log('Resend verification - Custom verification callback URL:', verificationCallbackUrl)
      
      // Send the verification email
      console.log('Resend verification - Sending email via SMTP...')
      const info = await transporter.sendMail({
        from: `"File Sharing Platform" <${smtpConfig.sender}>`,
        to: email,
        subject: "Verify your email address",
        text: `Please verify your email address by clicking this link: ${directLoginLink}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
            <h2 style="color: #3b82f6;">Verify Your Email Address</h2>
            <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${directLoginLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 4px; font-size: 14px;">
              ${directLoginLink}
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
              If you didn't sign up for an account, you can safely ignore this email.
            </p>
          </div>
        `,
        // Add additional headers to improve deliverability
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'High',
          'X-Mailer': 'Node.js Nodemailer',
          'Message-ID': `<verification-${Date.now()}-${email.replace('@', '-at-')}>`,
          'List-Unsubscribe': `<mailto:${smtpConfig.sender}?subject=unsubscribe>`
        },
        priority: 'high'
      })
      
      console.log('Resend verification - SMTP email sent:', {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected
      })
      
      return NextResponse.json({
        success: true,
        method: 'smtp',
        message: 'Verification email sent via SMTP',
        details: {
          messageId: info.messageId,
          recipient: email,
          accepted: info.accepted,
          rejected: info.rejected
        }
      })
    } catch (smtpError) {
      console.error('Resend verification - SMTP delivery error:', smtpError)
      // If SMTP fails, try Supabase as fallback
      return await useFallbackSupabaseMail(email, siteBaseUrl)
    }
  } catch (error: any) {
    console.error('Resend verification - Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}

// Helper function to use Supabase's built-in email delivery as fallback
async function useFallbackSupabaseMail(email: string, siteBaseUrl: string) {
  try {
    console.log('Resend verification - Trying Supabase email delivery as fallback')
    
    const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${siteBaseUrl}/auth/callback?type=signup&email=${encodeURIComponent(email)}`
      }
    })
    
    if (linkError) {
      console.error('Resend verification - Error with Supabase fallback:', linkError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send verification email: ' + linkError.message
        },
        { status: 500 }
      )
    }
    
    console.log('Resend verification - Supabase email delivery successful')
    return NextResponse.json({
      success: true,
      method: 'supabase',
      message: 'Verification email sent via Supabase',
    })
  } catch (error: any) {
    console.error('Resend verification - Supabase fallback error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'All email delivery methods failed: ' + error.message
      },
      { status: 500 }
    )
  }
} 