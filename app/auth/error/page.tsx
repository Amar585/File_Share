"use client"

import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle } from "lucide-react"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error") || "An unknown error occurred"

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Authentication Error</h2>
          <p className="mt-2 text-sm text-gray-600">
            There was a problem with your authentication.
          </p>
        </div>

        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertCircle className="mr-3 h-5 w-5 text-red-400" />
            <div className="text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Button asChild className="w-full">
            <Link href="/auth/signup">
              Try signing up again
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/signin">
              Return to sign in
            </Link>
          </Button>
          
          <div className="text-center text-sm text-gray-500">
            <p>
              If you continue to experience issues, please{" "}
              <Link href="/contact" className="font-medium text-blue-600 hover:text-blue-500">
                contact support
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 