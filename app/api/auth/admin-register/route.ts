import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createDirectLoginLink } from '@/lib/email/verification-links'

// Use environment variables for Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  try {
    // Get email, password, and username from request
    const { email, password, username } = await request.json()
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    console.log('Admin API - attempting registration for:', email)
    
    // Create user with admin API (without email verification first)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // This means they'll need email verification
      user_metadata: { username } // Store username in user metadata
    })
    
    if (createError) {
      console.error('Admin API - user creation error:', createError)
      return NextResponse.json(
        { 
          success: false, 
          error: createError.message,
          details: createError
        }, 
        { status: 400 }
      )
    }
    
    console.log('Admin API - user created successfully:', userData.user.id)
    
    // Check if profile exists before creating it
    if (username && userData.user.id) {
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userData.user.id)
        .single()
      
      // Only create profile if it doesn't exist
      if (!existingProfile) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userData.user.id,
            username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          
        if (profileError) {
          console.error('Admin API - profile creation error:', profileError)
          // We'll continue anyway since the user was created
        } else {
          console.log('Admin API - profile created successfully')
        }
      } else {
        console.log('Admin API - profile already exists, updating username')
        
        // Update the username on the existing profile
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            username,
            updated_at: new Date().toISOString()
          })
          .eq('id', userData.user.id)
        
        if (updateError) {
          console.error('Admin API - profile update error:', updateError)
        } else {
          console.log('Admin API - profile username updated')
        }
      }
    }
    
    // Get the site URL for redirects
    // Use NEXT_PUBLIC_SITE_URL if available, otherwise construct from request
    const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    console.log('Admin API - site base URL for redirects:', siteBaseUrl)
    
    // Create a direct login link that will definitely work
    const directLoginLink = createDirectLoginLink(siteBaseUrl, email)
    console.log('Admin API - direct login link:', directLoginLink)
    
    // Send verification email - try direct SMTP first since we know it works
    let emailSent = false
    
    // First, try direct SMTP which is more reliable
    try {
      // Setup SMTP configuration
      const smtpConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        sender: process.env.SENDER_EMAIL || process.env.SMTP_USER
      }
      
      // Check if SMTP is properly configured
      if (!smtpConfig.user || !smtpConfig.pass) {
        console.log('Admin API - SMTP not configured, skipping direct email')
        throw new Error('SMTP not configured properly')
      }
      
      console.log('Admin API - Using direct SMTP for verification email')
      
      // Generate a verification link using Supabase
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo: `${siteBaseUrl}/auth/callback?type=signup&email=${encodeURIComponent(email)}`
        }
      })
      
      if (linkError) {
        console.error('Admin API - Error generating verification link:', linkError)
        throw new Error('Failed to generate verification link')
      }
      
      // Get the action link
      const actionLink = linkData?.properties?.action_link
      
      if (!actionLink) {
        console.error('Admin API - No action link generated')
        throw new Error('No verification link was generated')
      }
      
      // Create transporter
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
      
      // Verify SMTP connection
      await transporter.verify()
      
      // Create a custom redirect URL that will show the login modal directly
      const verificationCallbackUrl = `${siteBaseUrl}/?verified=true&email=${encodeURIComponent(email)}`
      console.log('Admin API - Custom verification callback URL:', verificationCallbackUrl)
      
      // Send verification email
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
      
      console.log('Admin API - SMTP email sent:', {
        messageId: info.messageId,
        response: info.response
      })
      
      emailSent = true
    } catch (smtpError) {
      console.error('Admin API - SMTP delivery error:', smtpError)
      console.log('Admin API - Falling back to Supabase email delivery')
      
      // If direct SMTP fails, try Supabase methods
      try {
        // First try magic link
        const { error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            redirectTo: `${siteBaseUrl}/auth/callback?type=signup&email=${encodeURIComponent(email)}`
          }
        })
        
        if (magicLinkError) {
          console.error('Admin API - Error generating magic link:', magicLinkError)
          
          // Try invite link as a fallback
          const { error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email,
            options: {
              redirectTo: `${siteBaseUrl}/auth/callback?type=signup&email=${encodeURIComponent(email)}`
            }
          })
          
          if (inviteError) {
            console.error('Admin API - Error generating invite link:', inviteError)
          } else {
            console.log('Admin API - Invite verification email sent')
            emailSent = true
          }
        } else {
          console.log('Admin API - Magic link verification email sent')
          emailSent = true
        }
      } catch (error) {
        console.error('Admin API - All email delivery methods failed:', error)
      }
    }
    
    // Return success response
    return NextResponse.json({ 
      success: true, 
      user: userData.user,
      emailSent,
      message: emailSent
        ? 'User created and verification email sent successfully'
        : 'User created but there may be issues with the verification email',
      redirectTo: '/auth/verify?email=' + encodeURIComponent(email)
    })
    
  } catch (error: any) {
    console.error('Admin API - unexpected error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'An unexpected error occurred',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    )
  }
} 