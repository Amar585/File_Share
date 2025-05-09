"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DelayedTooltipProps {
  text: string
  children: React.ReactNode
  delayMs?: number
  className?: string
  position?: "top" | "bottom"
}

export function DelayedTooltip({
  text,
  children,
  delayMs = 1000,
  className,
  position = "bottom",
}: DelayedTooltipProps) {
  const [showTooltip, setShowTooltip] = React.useState(false)
  const timerRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setShowTooltip(true)
    }, delayMs)
  }

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setShowTooltip(false)
  }

  return (
    <div className="relative inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {showTooltip && (
        <div
          className={cn(
            "absolute px-2 py-1 text-xs font-medium",
            "bg-background border rounded shadow-sm whitespace-nowrap z-50",
            "animate-in fade-in-50 zoom-in-95 duration-200",
            position === "top" ? "bottom-full mb-2" : "top-full mt-2",
            "left-1/2 -translate-x-1/2",
            className,
          )}
        >
          {text}
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 border-x-4 border-x-transparent",
              position === "top"
                ? "top-full border-t-4 border-t-background"
                : "bottom-full border-b-4 border-b-background",
            )}
          />
        </div>
      )}
    </div>
  )
}
