import { Share2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "default" | "minimal"
}

export function Logo({ className, size = "md", variant = "default" }: LogoProps) {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  }

  if (variant === "minimal") {
    return (
      <div className={cn("relative flex items-center justify-center group", sizes[size], className)}>
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue to-brand-teal rounded-lg opacity-90 group-hover:opacity-100 transition-opacity" />
        <Share2 className="relative text-white h-5 w-5 md:h-6 md:w-6 z-10" />
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex items-center justify-center rounded-lg overflow-hidden group">
        <div className={cn("bg-gradient-to-br from-brand-blue to-brand-teal", sizes[size])} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Share2 className="text-white h-5 w-5 md:h-6 md:w-6 group-hover:scale-110 transition-transform z-10" />
        </div>
      </div>
      <span
        className={cn("font-bold group-hover:text-brand-blue transition-colors", {
          "text-lg": size === "sm",
          "text-xl": size === "md",
          "text-2xl": size === "lg",
        })}
      >
        FileShare
      </span>
    </div>
  )
}
