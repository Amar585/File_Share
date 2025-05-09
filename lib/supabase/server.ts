import { createServerComponentClient, createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from './database.types'
import { createServerClient } from '@supabase/ssr'

const cookieOptions = {
  // Set cookie options for better security
  cookies: {
    get(name: string) {
      return cookies().get(name)?.value
    },
    set(name: string, value: string, options: { path: string; maxAge: number }) {
      // Secure cookie settings
      cookies().set(name, value, {
        ...options,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
      })
    },
    remove(name: string, options: { path: string }) {
      cookies().delete(name)
    }
  }
}

export function createServerClient() {
  return createServerComponentClient<Database>({
    ...cookieOptions,
    options: {
      global: {
        // Auto-refresh session if expired
        fetch: async (url: string, options: RequestInit = {}) => {
          const response = await fetch(url, options)
          if (response.status === 401) {
            // Handle session refresh here
            const supabase = createServerComponentClient<Database>({ cookies })
            const { data: { session }, error } = await supabase.auth.getSession()
            if (!error && session) {
              // Retry the original request with new session
              return fetch(url, options)
            }
          }
          return response
        }
      }
    }
  })
}

export function createActionClient() {
  return createServerActionClient<Database>({
    ...cookieOptions,
    options: {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'X-Client-Info': 'supabase-auth-helpers-nextjs'
        }
      }
    }
  })
}

// Helper function to get session with error handling
export async function getServerSession() {
  try {
    const supabase = createServerClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Error getting session:', error.message)
      return null
    }
    return session
  } catch (err) {
    console.error('Unexpected error getting session:', err)
    return null
  }
}

// Helper function to get user profile with error handling
export async function getServerProfile() {
  try {
    const supabase = createServerClient()
    const session = await getServerSession()
    
    if (!session?.user?.id) {
      return null
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error) {
      console.error('Error getting profile:', error.message)
      return null
    }

    return profile
  } catch (err) {
    console.error('Unexpected error getting profile:', err)
    return null
  }
}

// Create a Supabase client for server components and API routes
export function createClient(cookieStore: ReturnType<typeof cookies>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
