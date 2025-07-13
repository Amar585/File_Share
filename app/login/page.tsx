"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/ui/logo"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Suspense } from "react"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams?.get('error') || null
  const [isLoading, setIsLoading] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(error)
  const supabase = createClientComponentClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setFormError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setFormError(error.message)
      setIsLoading(false)
      return
    }

    if (data?.user && !data.user.email_confirmed_at) {
      setFormError("Please verify your email before logging in")
      setIsLoading(false)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-hero-pattern p-4">
      <Link href="/" className="absolute left-4 top-4 flex items-center gap-2 md:left-8 md:top-8">
        <Logo variant="minimal" size="sm" className="text-white" />
        <span className="text-xl font-bold text-white">FileShare</span>
      </Link>

      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Login</CardTitle>
          <CardDescription>Enter your email and password to access your account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            {formError && (
              <div className="mb-4 p-3 bg-red-50 text-red-500 text-sm rounded-md">{formError}</div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  className="border-muted/40 focus-visible:ring-brand-blue"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/auth/forgot-password" className="text-xs text-brand-blue hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="border-muted/40 focus-visible:ring-brand-blue"
                />
              </div>
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
        <div className="px-8 pb-8 text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-brand-blue hover:underline">
            Sign up
          </Link>
        </div>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-6">
              <Logo />
            </div>
            <CardTitle className="text-2xl text-center">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
