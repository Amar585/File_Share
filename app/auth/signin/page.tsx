"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { VerificationAlert } from "@/components/auth/verification-alert"

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") || "/dashboard"
  const emailParam = searchParams.get("email") || ""
  const verified = searchParams.get("verified") === "true"
  
  const [email, setEmail] = useState(emailParam)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [resendingEmail, setResendingEmail] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setUnverifiedEmail(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Check for email verification error
        if (error.message.includes("Email not confirmed") || 
            error.message.includes("Invalid login credentials")) {
          // Try to check if the user exists but is not confirmed
          const { data: userData } = await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: false,
            },
          })
          
          if (userData) {
            setUnverifiedEmail(email)
            throw new Error("Please verify your email address before signing in")
          } else {
            throw error
          }
        } else {
          throw error
        }
      }

      toast.success("Signed in successfully!")
      router.push(redirectTo)
      router.refresh()
    } catch (error: any) {
      console.error("Sign in error:", error)
      setError(error.message || "An error occurred during sign in")
      toast.error(error.message || "Failed to sign in")
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (resendingEmail || !unverifiedEmail) return
    
    setResendingEmail(true)
    
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: unverifiedEmail }),
      }).then(res => res.json())
      
      if (!response.success) {
        throw new Error(response.error || "Failed to resend verification email")
      }
      
      toast.success("Verification email sent! Please check your inbox and spam folder.")
    } catch (error: any) {
      toast.error(error.message || "Failed to resend verification email")
      console.error("Resend error:", error)
    } finally {
      setResendingEmail(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-6 shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </p>
        </div>

        {verified && (
          <VerificationAlert 
            status="verified"
            message="Your email has been verified successfully. You can now sign in to your account."
          />
        )}

        {unverifiedEmail && (
          <VerificationAlert 
            status="pending"
            email={unverifiedEmail}
            message="Your email address is not verified. Please check your inbox or request a new verification email."
            onResendVerification={handleResendVerification}
            isResending={resendingEmail}
          />
        )}

        <form className="mt-4 space-y-6" onSubmit={handleSignIn}>
          {error && !unverifiedEmail && (
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/reset-password"
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
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
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  )
} 