import { Logo } from "@/components/ui/logo"
import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-hero-pattern p-4">
      <Link href="/" className="absolute left-4 top-4 flex items-center gap-2 md:left-8 md:top-8">
        <Logo variant="minimal" size="sm" className="text-white" />
        <span className="text-xl font-bold text-white">FileShare</span>
      </Link>
      {children}
    </div>
  )
}