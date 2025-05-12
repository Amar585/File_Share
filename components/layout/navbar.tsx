"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Bell, LogOut, Search, Settings, User, X } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@supabase/supabase-js"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RefreshableAvatar } from "@/components/ui/refreshable-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { DelayedTooltip } from "@/components/ui/delayed-tooltip"
import { useUser } from "@/hooks/use-user"
import { signOut } from "@/lib/actions/auth"
import { useNotifications } from "@/hooks/use-notifications"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

interface NavbarProps {
  className?: string
}

export function Navbar({ className }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile, isLoading } = useUser()
  const { 
    notifications, 
    unreadCount, 
    isLoading: notificationsLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications()

  const [avatarKey, setAvatarKey] = React.useState(Date.now())

  // Refresh avatar when profile changes
  React.useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarKey(Date.now())
    }
  }, [profile?.avatar_url])

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

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
  };

  return (
    <header
      className={cn(
        "flex h-16 items-center border-b px-4 bg-background/95 backdrop-blur-sm sticky top-0 z-30",
        className,
      )}
    >
      <SidebarTrigger className="mr-2" />
      <div className="relative flex-1 md:max-w-sm">
        <Input
          type="search"
          placeholder="Search files..."
          className="w-full rounded-md border bg-background/50 pl-10 pr-4 focus-visible:ring-brand-blue"
        />
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <DelayedTooltip text="Switch between light and dark mode" position="bottom">
          <div>
            <ThemeToggle />
          </div>
        </DelayedTooltip>

        <DelayedTooltip text="View your notifications" position="bottom">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-blue text-xs font-medium text-white">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => markAllAsRead()}
                    className="text-xs"
                  >
                    Mark all as read
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[300px]">
                {notifications.length > 0 ? (
                  <div className="divide-y">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className={cn(
                          "p-4 hover:bg-muted/50 relative transition-colors group",
                          !notification.read && "bg-blue-50 dark:bg-blue-900/10"
                        )}
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm">{notification.title}</h4>
                            <span className="text-xs text-muted-foreground">
                              {new Date(notification.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs mt-1 text-muted-foreground">{notification.message}</p>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const result = await deleteNotification(notification.id);
                              if (result.error) {
                                toast.error(`Failed to delete: ${result.error}`);
                              }
                            } catch (err) {
                              console.error('Error deleting notification:', err);
                              toast.error('An error occurred while deleting the notification');
                            }
                          }}
                          title="Delete notification"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px]">
                    <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No notifications yet</p>
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </DelayedTooltip>

        <DelayedTooltip text="Access your account settings" position="bottom">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full relative group">
                <RefreshableAvatar
                  url={profile?.avatar_url || null}
                  alt={profile?.full_name || "User"}
                  size="sm"
                />
                <span className="absolute inset-0 rounded-full ring-2 ring-brand-blue/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-500">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DelayedTooltip>
      </div>
    </header>
  )
}
