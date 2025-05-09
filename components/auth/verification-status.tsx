"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function VerificationStatus({ email, onVerified }: { email: string; onVerified?: () => void }) {
  const [isResending, setIsResending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const supabase = createClientComponentClient()
  const router = useRouter()

  useEffect(() => {
    const checkVerificationStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email_confirmed_at) {
        setIsVerified(true)
        onVerified?.()
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        await checkVerificationStatus()
      }
    })

    checkVerificationStatus()
    return () => subscription.unsubscribe()
  }, [supabase, onVerified])

  const resendVerificationEmail = async () => {
    try {
      setIsResending(true)
      setMessage(null)
      setError(null)

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })

      if (error) throw error

      setMessage('Verification email has been resent!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsResending(false)
    }
  }

  if (isVerified) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-green-600">Email Verified!</CardTitle>
          <CardDescription>Your email has been successfully verified.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => router.push('/login')}
            className="w-full"
          >
            Continue to Login
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Email Verification Required</CardTitle>
        <CardDescription>Please verify your email address to continue</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-500 text-sm rounded-md">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-green-50 text-green-500 text-sm rounded-md">
            {message}
          </div>
        )}
        <p className="text-sm text-gray-600 mb-4">
          We sent a verification email to <span className="font-medium">{email}</span>.
          Please check your inbox and click the verification link to continue.
        </p>
        <Button
          onClick={resendVerificationEmail}
          className="w-full"
          variant="outline"
          disabled={isResending}
        >
          {isResending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resending...
            </>
          ) : (
            "Resend verification email"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}