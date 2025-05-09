"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { VerificationAlert } from "@/components/auth/verification-alert"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)
  const router = useRouter()

  const validateForm = () => {
    if (!email || !password || !username) {
      setError("All fields are required")
      return false
    }
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return false
    }
    
    if (username.length < 3) {
      setError("Username must be at least 3 characters")
      return false
    }
    
    setError(null)
    return true
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setLoading(true)
    setError(null)
    
    try {
      // First check if username already exists
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .limit(1)
      
      if (existingProfiles && existingProfiles.length > 0) {
        setError("Username already taken")
        setLoading(false)
        return
      }
      
      // Use the admin API route instead of client-side signup
      // This avoids the SMTP issues with the client SDK
      const response = await fetch('/api/auth/admin-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password,
          username // We'll pass username for profile creation
        }),
      }).then(res => res.json())
      
      if (!response.success) {
        throw new Error(response.error || "Failed to create account")
      }
      
      // Success, show verification alert
      toast.success("Verification email sent! Please check your inbox.")
      setSignupSuccess(true)
      
    } catch (error: any) {
      toast.error(error.message || "An error occurred during signup")
      setError(error.message || "An error occurred during signup")
      console.error("Signup error:", error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleResendVerification = async () => {
    if (resendingEmail || !email) return
    
    setResendingEmail(true)
    
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      }).then(res => res.json())
      
      if (!response.success) {
        throw new Error(response.error || "Failed to resend verification email")
      }
      
      toast.success("Verification email sent again! Please check your inbox and spam folder.")
    } catch (error: any) {
      toast.error(error.message || "Failed to resend verification email")
      console.error("Resend error:", error)
    } finally {
      setResendingEmail(false)
    }
  }

  // If signup was successful, show the verification alert
  if (signupSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              Check your email
            </h2>
          </div>
          
          <VerificationAlert 
            status="pending"
            email={email}
            message="We've sent a verification link to your email. Please check your inbox and spam folder."
            onResendVerification={handleResendVerification}
            isResending={resendingEmail}
          />
          
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Once verified, you can{" "}
              <Link href="/auth/signin" className="font-medium text-blue-600 hover:text-blue-500">
                sign in to your account
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Create an account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/auth/signin" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Sign up"}
          </Button>
        </form>
      </div>
    </div>
  )
} 