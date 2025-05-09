"use server"

import { createActionClient, createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { createClient } from '@supabase/supabase-js'
import { cookies } from "next/headers"

// For admin operations that need service role
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

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const fullName = formData.get("fullName") as string
  const username = fullName?.split(' ')[0]?.toLowerCase() || email.split('@')[0]

  if (!email || !password) {
    return {
      error: "Email and password are required",
    }
  }

  try {
    // Create user with admin API (without email verification first)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // This means they'll need email verification
      user_metadata: { 
        full_name: fullName || "",
        username
      }
    })
    
    if (createError) {
      return {
        error: createError.message,
      }
    }
    
    // Create a profile for the user
    if (userData.user) {
      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
        id: userData.user.id,
        email: email,
        full_name: fullName || "",
      })

      if (profileError) {
        console.error("Error creating profile:", profileError)
      }
    }
    
    // Send verification email using Supabase's built-in email delivery
    let emailSent = false
    
    try {
      // First try a magic link which has proven to work reliably
      const { error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
        }
      })
      
      if (magicLinkError) {
        console.error('Server action - Error generating magic link:', magicLinkError)
        
        // As a fallback, try an invite link which also worked in testing
        const { error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
          }
        })
        
        if (inviteError) {
          console.error('Server action - Error generating invite link:', inviteError)
        } else {
          console.log('Server action - Invite verification email sent')
          emailSent = true
        }
      } else {
        console.log('Server action - Magic link verification email sent')
        emailSent = true
      }
    } catch (error) {
      console.error('Server action - Error generating verification link:', error)
    }

    return {
      success: true,
      message: "Check your email for the confirmation link.",
      emailSent
    }
  } catch (error: any) {
    console.error("Server action - unexpected error:", error)
    return {
      error: error.message || 'An unexpected error occurred',
    }
  }
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return {
      error: "Email and password are required",
    }
  }

  const supabase = createActionClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return {
      error: error.message,
    }
  }

  // Check if email is verified
  if (data.user && !data.user.email_confirmed_at) {
    return {
      error: "Please verify your email before signing in.",
    }
  }

  return { 
    success: true,
    user: data.user
  }
}

export async function signOut() {
  // Use the newer cookie handling method
  const cookieStore = cookies()
  const supabase = createServerClient()
  
  await supabase.auth.signOut()
  redirect("/")
}

export async function resetPassword(formData: FormData) {
  const email = formData.get("email") as string

  if (!email) {
    return {
      error: "Email is required",
    }
  }

  const supabase = createActionClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
  })

  if (error) {
    return {
      error: error.message,
    }
  }

  return {
    success: true,
    message: "Check your email for the password reset link.",
  }
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string

  if (!password) {
    return {
      error: "Password is required",
    }
  }

  const supabase = createActionClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return {
      error: error.message,
    }
  }

  return {
    success: true,
    message: "Password updated successfully.",
  }
}
