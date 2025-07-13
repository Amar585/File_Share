"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { ArrowRight, Lock, Share2, Upload } from "lucide-react"
import { Suspense } from "react"

import { Button } from "@/components/ui/button"
import { AuthModal } from "@/components/auth/auth-modal"
import { ThemeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/ui/logo"

function LandingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const verified = searchParams?.get('verified') === 'true'
  const showLogin = verified || searchParams?.get('verified') === 'false' || searchParams?.has('email')
  const email = searchParams?.get('email') || ""
  
  // Set initial state based on URL parameters immediately
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(showLogin)
  const [authModalTab, setAuthModalTab] = React.useState<"login" | "register">(verified ? "login" : "register")
  
  // We're setting modalMounted to true by default to fix the first load issue
  const [modalMounted, setModalMounted] = React.useState(true)

  // Ensure the login button works on first load by moving functions out of effect
  const openLoginModal = React.useCallback(() => {
    console.log("Opening login modal")
    setAuthModalTab("login")
    setIsAuthModalOpen(true)
  }, [])

  const openRegisterModal = React.useCallback(() => {
    console.log("Opening register modal")
    setAuthModalTab("register")
    setIsAuthModalOpen(true)
  }, [])

  React.useEffect(() => {
    console.log("Landing page - URL params:", {
      verified,
      email,
      showLogin,
    })

    const autoVerifyEmail = async () => {
      if (!email) return
      
      try {
        // Call our auto-confirm endpoint
        const confirmUrl = new URL('/api/auth/auto-confirm-email', window.location.origin)
        confirmUrl.searchParams.set('email', email)
        
        const response = await fetch(confirmUrl.toString(), { method: 'POST' })
        const data = await response.json()
        
        if (!response.ok) {
          console.error("Auto-verification failed:", data.error)
        } else {
          console.log("Email verified automatically", data)
        }
      } catch (error) {
        console.error("Auto-verification error:", error)
      }
    }
    
    if (showLogin) {
      // First try to verify the email automatically if required
      if (verified && email) {
        autoVerifyEmail()
      }
      
      console.log("Landing page - Opening login modal with email:", email)
      openLoginModal()
      
      // Clear URL parameters after modal is opened to prevent reopening on refresh
      // But maintain the ability to close and reopen the modal manually
      const url = new URL(window.location.href)
      if (url.searchParams.has('verified') || url.searchParams.has('email')) {
        // Create a clean URL without the parameters
        // This prevents the modal from reopening if the user manually refreshes
        url.searchParams.delete('verified')
        url.searchParams.delete('email')
        
        // Replace the current URL without reloading the page
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [searchParams, showLogin, email, verified, openLoginModal])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between bg-background/95 backdrop-blur-sm px-4 shadow-sm md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button 
            variant="ghost" 
            onClick={openLoginModal} 
            className="font-medium">
            Log In
          </Button>
          <Button 
            className="gradient-button" 
            onClick={openRegisterModal}>
            Sign Up
          </Button>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full bg-hero-pattern py-24 md:py-32 lg:py-40 dark:bg-gradient-to-r dark:from-blue-700 dark:to-purple-700">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-8 text-center">
              <div className="space-y-4 animate-in-slow">
                <h1 className="text-4xl font-bold tracking-tighter text-white sm:text-5xl md:text-6xl/none">
                  Secure File Sharing Made Simple
                </h1>
                <p className="mx-auto max-w-[700px] text-white/90 md:text-xl">
                  Share files securely with your team and clients. Control access, track usage, and collaborate
                  seamlessly.
                </p>
              </div>
              <div className="space-x-4">
                <Button size="lg" className="gradient-button animate-pulse-slow shadow-lg" onClick={openRegisterModal}>
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full bg-background py-16 md:py-24 lg:py-32">
          <div className="container grid items-center justify-center gap-8 px-4 text-center md:px-6 lg:grid-cols-3">
            <div className="space-y-4 p-6 rounded-xl bg-gradient-to-br from-brand-blue/5 to-brand-teal/5 border border-brand-blue/10 hover:shadow-md transition-all">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue/10">
                <Upload className="h-8 w-8 text-brand-blue" />
              </div>
              <h3 className="text-xl font-bold">Easy Upload</h3>
              <p className="text-muted-foreground">
                Drag and drop files or select them from your device. Upload multiple files at once.
              </p>
            </div>
            <div className="space-y-4 p-6 rounded-xl bg-gradient-to-br from-brand-purple/5 to-brand-pink/5 border border-brand-purple/10 hover:shadow-md transition-all">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-purple/10">
                <Share2 className="h-8 w-8 text-brand-purple" />
              </div>
              <h3 className="text-xl font-bold">Secure Sharing</h3>
              <p className="text-muted-foreground">
                Share files with specific people. Control who can view, download, or edit your files.
              </p>
            </div>
            <div className="space-y-4 p-6 rounded-xl bg-gradient-to-br from-brand-teal/5 to-brand-blue/5 border border-brand-teal/10 hover:shadow-md transition-all">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-teal/10">
                <Lock className="h-8 w-8 text-brand-teal" />
              </div>
              <h3 className="text-xl font-bold">Access Control</h3>
              <p className="text-muted-foreground">
                Manage access requests. Approve or deny access to your files with a single click.
              </p>
            </div>
          </div>
        </section>
        <section className="w-full bg-gradient-to-br from-brand-blue/5 to-brand-purple/5 py-16 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-8 text-center">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Ready to get started?</h2>
                <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl">
                  Join thousands of users who trust FileShare for their file sharing needs.
                </p>
              </div>
              <div className="space-x-4">
                <Button size="lg" className="gradient-button shadow-lg" onClick={openRegisterModal}>
                  Sign Up Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex w-full shrink-0 flex-col items-center gap-2 border-t px-4 py-6 sm:flex-row md:px-6">
        <div className="flex items-center gap-2">
          <Logo size="sm" variant="minimal" />
          <p className="text-xs text-muted-foreground">© 2025 FileShare. All rights reserved.</p>
        </div>
        <nav className="flex gap-4 sm:ml-auto sm:gap-6">
          <Link className="text-xs text-muted-foreground underline-offset-4 hover:underline" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs text-muted-foreground underline-offset-4 hover:underline" href="#">
            Privacy
          </Link>
        </nav>
      </footer>

      {modalMounted && (
        <AuthModal 
          isOpen={!!isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
          defaultTab={authModalTab}
          verified={verified}
          email={email}
        />
      )}
    </div>
  )
}

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <Logo />
            <ThemeToggle />
          </div>
        </header>
        <main className="container mx-auto px-4 py-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold">Loading...</h1>
          </div>
        </main>
      </div>
    }>
      <LandingPageContent />
    </Suspense>
  )
}
