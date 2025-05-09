"use client"

import { useState, useEffect } from "react"
import { FileText, Plus, Upload, Share2, Lock } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FileCard } from "@/components/ui/file-card"
import { useUser } from "@/hooks/use-user"
import { supabase } from "@/lib/supabase/client"
import { formatBytes } from "@/lib/utils"

export default function DashboardPage() {
  const { user } = useUser()
  const [recentFiles, setRecentFiles] = useState<any[]>([])
  const [sharedFilesCount, setSharedFilesCount] = useState(0)
  const [totalFilesCount, setTotalFilesCount] = useState(0)
  const [totalStorage, setTotalStorage] = useState(0)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return

      setIsLoading(true)
      try {
        // Fetch recent files (last 4)
        const { data: filesData, error: filesError } = await supabase
          .from("files")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(4)

        if (filesError) {
          toast.error(`Error loading recent files: ${filesError.message}`)
          console.error("Error fetching recent files:", filesError)
        } else {
          setRecentFiles(filesData || [])
        }

        // Count total files
        const { count: totalCount, error: totalError } = await supabase
          .from("files")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)

        if (totalError) {
          console.error("Error counting total files:", totalError)
        } else {
          setTotalFilesCount(totalCount || 0)
        }

        // Count shared files
        const { count: sharedCount, error: sharedError } = await supabase
          .from("files")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("shared", true)

        if (sharedError) {
          console.error("Error counting shared files:", sharedError)
        } else {
          setSharedFilesCount(sharedCount || 0)
        }

        // Calculate total storage used
        const { data: storageData, error: storageError } = await supabase
          .from("files")
          .select("size")
          .eq("user_id", user.id)

        if (storageError) {
          console.error("Error calculating storage:", storageError)
        } else {
          const totalBytes = storageData?.reduce((sum, file) => sum + file.size, 0) || 0
          setTotalStorage(totalBytes)
        }

        // Count pending access requests
        const { count: requestsCount, error: requestsError } = await supabase
          .from("file_access_requests")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .eq("status", "pending")

        if (requestsError) {
          console.error("Error counting access requests:", requestsError)
        } else {
          setPendingRequests(requestsCount || 0)
        }
      } catch (error: any) {
        console.error("Error fetching dashboard data:", error)
        toast.error(`Error loading dashboard data: ${error.message}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [user])

  // Calculate storage percentage (assuming 5GB free tier)
  const storageLimit = 5 * 1024 * 1024 * 1024 // 5GB in bytes
  const storagePercentage = Math.min(100, (totalStorage / storageLimit) * 100)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
          <p className="text-muted-foreground">Here's an overview of your files and recent activity.</p>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* The style props below ensure all cards have identical height regardless of content */}
          <div className="h-[160px]">
            <Link href="/my-files" className="block h-full">
              <Card className="border-brand-blue/20 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg cursor-pointer h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
                  <CardTitle className="text-sm font-medium">Total Files</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-brand-blue/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-brand-blue" />
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                  <div className="text-2xl font-bold text-brand-blue">{totalFilesCount}</div>
                  <p className="text-xs text-muted-foreground">Your uploaded files</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="h-[160px]">
            <Link href="/shared-files" className="block h-full">
              <Card className="border-brand-purple/20 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg cursor-pointer h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
                  <CardTitle className="text-sm font-medium">Shared Files</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-brand-purple/10 flex items-center justify-center">
                    <Share2 className="h-5 w-5 text-brand-purple" />
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                  <div className="text-2xl font-bold text-brand-purple">{sharedFilesCount}</div>
                  <p className="text-xs text-muted-foreground">Files you've shared</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="h-[160px]">
            <Link href="/storage-details" className="block h-full">
              <Card className="border-brand-teal/20 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg cursor-pointer h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
                  <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-brand-teal/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-brand-teal" />
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                  <div>
                    <div className="text-2xl font-bold text-brand-teal">{formatBytes(totalStorage)}</div>
                    <p className="text-xs text-muted-foreground">of 5 GB ({storagePercentage.toFixed(1)}%)</p>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-brand-teal to-brand-blue" 
                      style={{ width: `${storagePercentage}%` }}
                    ></div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="h-[160px]">
            <Link href="/sharing-management" className="block h-full">
              <Card className="border-brand-orange/20 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg cursor-pointer h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
                  <CardTitle className="text-sm font-medium">Access Requests</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-brand-orange/10 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-brand-orange" />
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                  <div className="text-2xl font-bold text-brand-orange">{pendingRequests}</div>
                  <p className="text-xs text-muted-foreground">Pending requests</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 border-muted/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Files</CardTitle>
                <CardDescription>Recently uploaded and modified files</CardDescription>
              </div>
              <Link href="/my-files">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-brand-blue/20 text-brand-blue hover:text-brand-blue hover:border-brand-blue/40"
                >
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-muted rounded-lg"></div>
                  ))}
                </div>
              ) : recentFiles.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {recentFiles.map((file) => (
                    <FileCard 
                      key={file.id} 
                      id={file.id}
                      name={file.name}
                      type={file.type}
                      size={file.size}
                      path={file.path}
                      uploadedAt={file.created_at}
                      shared={file.shared}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <p className="text-muted-foreground">No files uploaded yet</p>
                  <Link href="/upload" className="mt-2">
                    <Button variant="link" size="sm">Upload your first file</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="col-span-3 border-muted/40">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and actions</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Link href="/upload">
                <Button className="w-full justify-start gradient-button" size="lg">
                  <Upload className="mr-2 h-5 w-5" />
                  Upload Files
                </Button>
              </Link>
              <Link href="/shared-files">
                <Button className="w-full justify-start" variant="outline" size="lg">
                  <Share2 className="mr-2 h-5 w-5 text-brand-purple" />
                  View Shared Files
                </Button>
              </Link>
              <Link href="/sharing-management">
                <Button className="w-full justify-start" variant="outline" size="lg">
                  <Plus className="mr-2 h-5 w-5 text-brand-teal" />
                  Manage Access Requests
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
