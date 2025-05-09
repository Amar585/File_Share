"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FolderOpen, Home, Lock, LogOut, Settings, Share2, Upload, User, Globe } from "lucide-react"
import { createClient } from "@supabase/supabase-js"

import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { Logo } from "@/components/ui/logo"
import { signOut } from "@/lib/actions/auth"
import { DelayedTooltip } from "@/components/ui/delayed-tooltip"

interface SidebarProps {
  className?: string
}

export function AppSidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  const routes = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: Home,
      active: pathname === "/dashboard",
    },
    {
      title: "My Files",
      href: "/my-files",
      icon: FolderOpen,
      active: pathname === "/my-files",
    },
    {
      title: "Shared Files",
      href: "/shared-files",
      icon: Share2,
      active: pathname === "/shared-files",
    },
    {
      title: "Browse Files",
      href: "/browse-files",
      icon: Globe,
      active: pathname === "/browse-files",
    },
    {
      title: "Upload",
      href: "/upload",
      icon: Upload,
      active: pathname === "/upload",
    },
    {
      title: "Sharing Management",
      href: "/sharing-management",
      icon: Lock,
      active: pathname === "/sharing-management",
    },
  ]

  const handleSignOut = async () => {
    try {
      // Try the API endpoint first
      const response = await fetch('/api/auth/logout');
      const data = await response.json();
      
      if (data.success) {
        // Navigate to home page
        window.location.href = "/";
        return;
      }
      
      // If API fails, try server-side signOut
      await signOut();
    } catch (error) {
      console.error("Logout failed, using client-side fallback", error);
      
      // Client-side fallback
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      await supabase.auth.signOut();
      window.location.href = "/";
    }
  }

  return (
    <Sidebar className={cn("border-r", className)} variant="floating" collapsible="icon">
      <SidebarHeader className="flex flex-col items-center px-4 py-3">
        <Link href="/dashboard" className="hover:opacity-90 transition-opacity">
          {isCollapsed ? (
            <div className="relative flex items-center justify-center group h-10 w-10">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-blue to-brand-teal rounded-lg opacity-90 group-hover:opacity-100 transition-opacity" />
              <Share2 className="relative text-white h-6 w-6 z-10" />
            </div>
          ) : (
            <Logo size="md" />
          )}
        </Link>
      </SidebarHeader>
      <SidebarSeparator className="mb-2" />
      <SidebarContent className="px-2 py-2 custom-scrollbar">
        <SidebarMenu className="gap-1">
          {routes.map((route) => (
            <SidebarMenuItem key={route.href}>
              <DelayedTooltip text={route.title} position="bottom">
                <SidebarMenuButton
                  asChild
                  isActive={route.active}
                  className={cn(
                    "sidebar-menu-item transition-all duration-200",
                    route.active
                      ? "bg-gradient-to-r from-brand-blue to-brand-teal text-white font-medium shadow-md"
                      : "hover:translate-x-1 hover:shadow-md hover:border-l-4 hover:border-brand-blue hover:pl-3",
                  )}
                >
                  <Link href={route.href}>
                    <route.icon className={cn("h-5 w-5", route.active ? "text-white" : "")} />
                    <span className="font-medium">{route.title}</span>
                  </Link>
                </SidebarMenuButton>
              </DelayedTooltip>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t mt-2">
        <SidebarMenu className="gap-1 py-2">
          <SidebarMenuItem>
            <DelayedTooltip text="Profile" position="bottom">
              <SidebarMenuButton
                asChild
                isActive={pathname === "/profile"}
                className={cn(
                  "sidebar-menu-item transition-all duration-200",
                  pathname === "/profile"
                    ? "bg-gradient-to-r from-brand-blue to-brand-teal text-white font-medium shadow-md"
                    : "hover:translate-x-1 hover:shadow-md hover:border-l-4 hover:border-brand-blue hover:pl-3",
                )}
              >
                <Link href="/profile">
                  <User className={cn("h-5 w-5", pathname === "/profile" ? "text-white" : "")} />
                  <span className="font-medium">Profile</span>
                </Link>
              </SidebarMenuButton>
            </DelayedTooltip>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DelayedTooltip text="Settings" position="bottom">
              <SidebarMenuButton
                asChild
                isActive={pathname === "/settings"}
                className={cn(
                  "sidebar-menu-item transition-all duration-200",
                  pathname === "/settings"
                    ? "bg-gradient-to-r from-brand-blue to-brand-teal text-white font-medium shadow-md"
                    : "hover:translate-x-1 hover:shadow-md hover:border-l-4 hover:border-brand-blue hover:pl-3",
                )}
              >
                <Link href="/settings">
                  <Settings className={cn("h-5 w-5", pathname === "/settings" ? "text-white" : "")} />
                  <span className="font-medium">Settings</span>
                </Link>
              </SidebarMenuButton>
            </DelayedTooltip>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DelayedTooltip text="Logout" position="bottom">
              <SidebarMenuButton
                onClick={handleSignOut}
                className="transition-all duration-200 hover:translate-x-1 hover:shadow-md hover:border-l-4 hover:border-red-500 hover:pl-3 hover:text-red-500 cursor-pointer"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Logout</span>
              </SidebarMenuButton>
            </DelayedTooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
