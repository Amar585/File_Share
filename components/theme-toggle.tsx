"use client"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
            "hover:ring-2 hover:ring-opacity-70 focus:outline-none",
            theme === "dark"
              ? "hover:ring-brand-blue/50 text-brand-blue bg-gray-800/50"
              : "hover:ring-brand-orange/50 text-brand-orange bg-gray-100/50",
          )}
        >
          <div className="relative w-5 h-5">
            {/* Sun Icon */}
            <Sun
              className={cn(
                "absolute inset-0 h-5 w-5 transition-all duration-300",
                theme === "dark" ? "opacity-0 scale-50 rotate-90" : "opacity-100 scale-100 rotate-0",
              )}
            />

            {/* Moon Icon */}
            <Moon
              className={cn(
                "absolute inset-0 h-5 w-5 transition-all duration-300",
                theme === "dark" ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-90",
              )}
            />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer">
          <Sun className="mr-2 h-4 w-4 text-brand-orange" />
          <span className={theme === "light" ? "font-medium" : ""}>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer">
          <Moon className="mr-2 h-4 w-4 text-brand-blue" />
          <span className={theme === "dark" ? "font-medium" : ""}>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="cursor-pointer">
          <Monitor className="mr-2 h-4 w-4" />
          <span className={theme === "system" ? "font-medium" : ""}>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
