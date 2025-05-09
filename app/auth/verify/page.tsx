"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { AlertCircle, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Logo } from "@/components/ui/logo"

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const [resendDisabled, setResendDisabled] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (resendDisabled) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            setResendDisabled(false)
            return 60
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [resendDisabled])

  const handleResendEmail = async () => {
    if (resendDisabled || !email) return

    setLoading(true)
    try {
      // Use our improved verification email endpoint
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      }).then(res => res.json())

      if (!response.success) {
        throw new Error(response.error || "Failed to resend verification email");
      }
      
      toast.success("Verification email sent! Please check your inbox and spam folder.")
      setResendDisabled(true)
    } catch (error: any) {
      toast.error(error.message || "Failed to resend verification email")
      console.error("Resend error:", error)
    } finally {
      setLoading(false)
    }
  }

  const returnToLogin = () => {
    // Navigate to main page with parameters to auto-open login modal
    router.push(`/?verified=false&email=${encodeURIComponent(email)}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md border-muted/40 shadow-xl">
        <CardHeader className="relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-2 top-2" 
            onClick={returnToLogin}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex flex-col items-center mb-2">
            <Logo size="md" />
          </div>
          <CardTitle className="text-xl text-center">
            Verify your email
          </CardTitle>
          <CardDescription className="text-center">
            {email ? `We've sent a verification email to ${email}` : "Check your email for the verification link"}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-4">
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Verification Pending</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>Please check both your inbox and spam folder for the verification link.</p>
                  {email && (
                    <p className="mt-1">
                      A verification email has been sent to <strong>{email}</strong>.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4">
          <Button
            variant="outline"
            onClick={handleResendEmail}
            disabled={loading || resendDisabled}
            className="w-full border-muted/40"
          >
            {loading ? "Sending..." : resendDisabled ? `Resend in ${countdown}s` : "Resend verification email"}
          </Button>
          
          <Button 
            type="button" 
            className="w-full gradient-button"
            onClick={returnToLogin}
          >
            Return to login
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
