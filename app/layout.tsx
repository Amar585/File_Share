import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import { SupabaseInitializer } from "@/components/supabase-initializer"
import { BucketInitializer } from "@/components/bucket-initializer"
import { SearchProvider } from "@/context/search-context"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "FileShare - Secure File Sharing Made Simple",
  description:
    "Share files securely with your team and clients. Control access, track usage, and collaborate seamlessly.",
  generator: 'v0.dev',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/favicon.svg' }
    ]
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.className
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SearchProvider>
            <SupabaseInitializer />
            <BucketInitializer />
            <Toaster />
            {children}
          </SearchProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
