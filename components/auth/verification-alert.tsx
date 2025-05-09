import { AlertCircle, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type VerificationStatus = "pending" | "verified" | "error"

interface VerificationAlertProps {
  status: VerificationStatus
  email?: string
  message?: string
  onResendVerification?: () => void
  isResending?: boolean
}

export function VerificationAlert({
  status,
  email,
  message,
  onResendVerification,
  isResending = false,
}: VerificationAlertProps) {
  let bgColor = "bg-blue-50"
  let textColor = "text-blue-800"
  let icon = <AlertCircle className="h-5 w-5 text-blue-600" />
  let title = "Verification Pending"
  let defaultMessage = "Please check your email to verify your account."

  if (status === "verified") {
    bgColor = "bg-green-50"
    textColor = "text-green-800"
    icon = <CheckCircle className="h-5 w-5 text-green-600" />
    title = "Email Verified"
    defaultMessage = "Your email has been successfully verified."
  } else if (status === "error") {
    bgColor = "bg-red-50"
    textColor = "text-red-800"
    icon = <XCircle className="h-5 w-5 text-red-600" />
    title = "Verification Error"
    defaultMessage = "There was a problem verifying your email."
  }

  return (
    <div className={`rounded-md ${bgColor} p-4 my-4`}>
      <div className="flex">
        <div className="flex-shrink-0">{icon}</div>
        <div className="ml-3">
          <h3 className={`text-sm font-medium ${textColor}`}>{title}</h3>
          <div className={`mt-2 text-sm ${textColor}`}>
            <p>{message || defaultMessage}</p>
            {email && status === "pending" && (
              <p className="mt-1">
                A verification email has been sent to <strong>{email}</strong>.
              </p>
            )}
          </div>
          {status === "pending" && onResendVerification && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onResendVerification}
                disabled={isResending}
              >
                {isResending ? "Sending..." : "Resend verification email"}
              </Button>
            </div>
          )}
          {status === "verified" && (
            <div className="mt-4">
              <Link href="/auth/signin">
                <Button variant="outline" size="sm">
                  Sign in now
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 