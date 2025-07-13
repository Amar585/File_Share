"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, X, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Logo } from "@/components/ui/logo"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: "login" | "register"
  verified?: boolean
  email?: string
}

export function AuthModal({ isOpen, onClose, defaultTab = "register", verified = false, email = "" }: AuthModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"login" | "register">(defaultTab)
  const [loginEmail, setLoginEmail] = React.useState(email)
  const [emailVerificationState, setEmailVerificationState] = React.useState<"unknown" | "verified" | "unverified">(
    verified ? "verified" : "unknown"
  )
  const [verificationLoading, setVerificationLoading] = React.useState(false)
  
  // Set isClientSide to true by default to fix the first load issue
  const [isClientSide, setIsClientSide] = React.useState(true)

  // Log props for debugging
  React.useEffect(() => {
    console.log("AuthModal - Props received:", { defaultTab, verified, email, isOpen })
  }, [defaultTab, verified, email, isOpen])

  // Reset the active tab when the defaultTab prop changes
  React.useEffect(() => {
    console.log("AuthModal - Setting active tab:", defaultTab)
    setActiveTab(defaultTab)
  }, [defaultTab])

  // Set login email when the email prop changes
  React.useEffect(() => {
    if (email) {
      console.log("AuthModal - Setting login email:", email)
      setLoginEmail(email)
    }
  }, [email])

  const handleLogin = React.useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      // Try to authenticate
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Check if the error is about email verification
        if (error.message.includes("Email not confirmed") || 
            error.message.includes("not confirmed") ||
            error.message.includes("not verified")) {
          
          console.log("AuthModal - Email not verified, attempting to auto-confirm:", email)
          
          // Try to automatically confirm the email
          try {
            const confirmUrl = new URL('/api/auth/auto-confirm-email', window.location.origin)
            confirmUrl.searchParams.set('email', email)
            
            const response = await fetch(confirmUrl.toString(), { 
              method: 'POST',
              cache: 'no-store',
            })
            
            const data = await response.json()
            
            if (response.ok && data.success) {
              console.log("AuthModal - Email auto-confirmed successfully")
              setEmailVerificationState("verified")
              toast.success("Email verified! Please try logging in again.")
              
              // Try to log in again automatically
              setTimeout(async () => {
                const { error: retryError } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                })
                
                if (!retryError) {
                  router.push("/dashboard")
                  router.refresh()
                  onClose()
                  toast.success("Successfully logged in!")
                } else {
                  console.error("AuthModal - Login retry failed:", retryError)
                  throw retryError
                }
              }, 1000)
            } else {
              console.error("AuthModal - Failed to auto-confirm email:", data.error)
              setEmailVerificationState("unverified")
              toast.error("Unable to verify your email automatically. Please check your inbox for a verification link.")
            }
          } catch (confirmError) {
            console.error("AuthModal - Error during auto-confirmation:", confirmError)
            setEmailVerificationState("unverified")
            toast.error("There was a problem verifying your email. Please try again later.")
          }
        } else {
          throw error
        }
      } else {
        router.push("/dashboard")
        router.refresh()
        onClose()
        toast.success("Successfully logged in!")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to login")
    } finally {
      setIsLoading(false)
    }
  }, [router, onClose])

  const handleAutoConfirmEmail = async () => {
    if (!loginEmail) return
    
    setVerificationLoading(true)
    try {
      // Call our auto-confirm endpoint
      const confirmUrl = new URL('/api/auth/auto-confirm-email', window.location.origin)
      confirmUrl.searchParams.set('email', loginEmail)
      
      const response = await fetch(confirmUrl.toString(), { method: 'POST' })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to confirm email')
      }
      
      setEmailVerificationState("verified")
      toast.success("Email verified successfully! You can now log in.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to verify email")
    } finally {
      setVerificationLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirm-password') as string

    try {
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match")
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
          // No username is provided in this modal, so we'll use part of the email as username
          username: email.split('@')[0], 
        }),
      }).then(res => res.json())
      
      if (!response.success) {
        throw new Error(response.error || "Failed to create account")
      }
      
      // Success, redirect to verification page
      toast.success("Verification email sent! Please check your inbox.")
      
      // Redirect to our styled verification page
      router.push(`/auth/verify?email=${encodeURIComponent(email)}`)
      onClose()
    } catch (error) {
      console.error("Signup error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create account")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen || !isClientSide) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md border-muted/40 shadow-xl">
        <CardHeader className="relative">
          <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex flex-col items-center mb-2">
            <Logo size="md" />
          </div>
          <CardTitle className="text-xl text-center">
            {activeTab === "login" ? "Welcome back!" : "Create an account"}
          </CardTitle>
          <CardDescription className="text-center">
            {activeTab === "login"
              ? "Enter your credentials to access your account"
              : "Sign up for a new account to get started"}
          </CardDescription>
        </CardHeader>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" className="data-[state=active]:bg-brand-blue data-[state=active]:text-white">
              Login
            </TabsTrigger>
            <TabsTrigger value="register" className="data-[state=active]:bg-brand-blue data-[state=active]:text-white">
              Register
            </TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4 pt-4">
                {emailVerificationState === "verified" && (
                  <div className="rounded-md bg-green-50 p-4 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800">Email Verified</h3>
                        <div className="mt-2 text-sm text-green-700">
                          <p>Your email has been verified successfully. You can now sign in to your account.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {emailVerificationState === "unverified" && (
                  <div className="rounded-md bg-amber-50 p-4 mb-4">
                    <div className="flex">
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-amber-800">Email Not Verified</h3>
                        <div className="mt-2 text-sm text-amber-700">
                          <p>Your email has not been verified yet. Please check your inbox for a verification link or try again later.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email-login">Email</Label>
                    <Input
                      id="email-login"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="border-muted/40 focus-visible:ring-brand-blue"
                    />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password-login">Password</Label>
                    <a href="#" className="text-xs text-brand-blue hover:underline">
                      Forgot password?
                    </a>
                  </div>
                    <Input
                      id="password-login"
                      name="password"
                      type="password"
                      required
                      className="border-muted/40 focus-visible:ring-brand-blue"
                    />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full gradient-button" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={handleRegister}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email-register">Email</Label>
                    <Input
                      id="email-register"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                      className="border-muted/40 focus-visible:ring-brand-blue"
                    />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-register">Password</Label>
                    <Input
                      id="password-register"
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      className="border-muted/40 focus-visible:ring-brand-blue"
                    />
                  <p className="text-xs text-muted-foreground">Password must be at least 8 characters long</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      required
                      minLength={8}
                      className="border-muted/40 focus-visible:ring-brand-blue"
                    />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full gradient-button" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
