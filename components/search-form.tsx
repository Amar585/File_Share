"use client"

import { Search } from "lucide-react"
import { SidebarInput } from "@/components/ui/sidebar"

export function SearchForm() {
  return (
    <form className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <SidebarInput type="search" placeholder="Search files..." className="pl-9" />
    </form>
  )
}
