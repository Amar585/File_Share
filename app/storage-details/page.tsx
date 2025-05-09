"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useUser } from "@/hooks/use-user"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowLeft, Files, HardDrive, DownloadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { formatBytes } from "@/lib/utils"

// File type categories for grouping in chart
const FILE_CATEGORIES: Record<string, string[]> = {
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
  video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'aac'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz'],
  other: []
};

// Get file category based on file extension
const getFileCategory = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(extension)) {
      return category;
    }
  }
  
  return 'other';
};

export default function StorageDetailsPage() {
  const [storageData, setStorageData] = useState<any[]>([]);
  const [totalStorage, setTotalStorage] = useState(0);
  const [usedStorage, setUsedStorage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    async function fetchStorageDetails() {
      if (!user) return;

      try {
        setIsLoading(true);
        
        // Fetch all files for the user
        const { data: files, error } = await supabase
          .from("files")
          .select("*")
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }

        // Calculate total size and categorize by file type
        const totalSize = files?.reduce((sum, file) => sum + (file.size || 0), 0) || 0;
        
        // Group files by category
        const categorizedData: { [key: string]: number } = {};
        
        files?.forEach(file => {
          const category = getFileCategory(file.name);
          categorizedData[category] = (categorizedData[category] || 0) + (file.size || 0);
        });
        
        // Convert to chart data format
        const chartData = Object.entries(categorizedData).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
          value: value,
          percentage: ((value / totalSize) * 100).toFixed(1)
        }));
        
        // Calculate storage metrics in MB
        const usedStorageMB = totalSize / (1024 * 1024);
        // In a real app, you would get the total storage limit from your user's plan
        const totalStorageMB = 5 * 1024; // 5GB storage limit in MB
        
        setStorageData(chartData);
        setTotalStorage(totalStorageMB);
        setUsedStorage(usedStorageMB);
      } catch (error: any) {
        console.error("Error fetching storage details:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStorageDetails();
  }, [user]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Storage Details</h1>
            <p className="text-muted-foreground">View your storage usage and breakdown</p>
          </div>
          <Button 
            onClick={() => router.back()} 
            variant="outline" 
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading storage information...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Main storage usage card */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-950/20 dark:to-teal-950/20">
                <CardTitle>Storage Overview</CardTitle>
                <CardDescription>
                  You've used {formatBytes(usedStorage * 1024 * 1024)} of {formatBytes(totalStorage * 1024 * 1024)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center py-6">
                  <div className="storage-gauge relative flex items-center justify-center">
                    <div className="absolute text-center">
                      <div className="text-5xl font-bold text-primary">{((usedStorage / totalStorage) * 100).toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">Used</div>
                    </div>
                    <svg className="h-52 w-52" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="12"
                        className="dark:stroke-slate-800"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="url(#storage-gradient)"
                        strokeWidth="12"
                        strokeDasharray={2 * Math.PI * 38}
                        strokeDashoffset={2 * Math.PI * 38 * (1 - (usedStorage / totalStorage))}
                        strokeLinecap="round"
                        className="animate-dash"
                        style={{ 
                          transformOrigin: "center",
                          transform: "rotate(-90deg)"
                        }}
                      />
                      <defs>
                        <linearGradient id="storage-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
                
                <style jsx>{`
                  @keyframes dash {
                    from {
                      stroke-dashoffset: ${2 * Math.PI * 38};
                    }
                    to {
                      stroke-dashoffset: ${2 * Math.PI * 38 * (1 - (usedStorage / totalStorage))};
                    }
                  }
                  .animate-dash {
                    animation: dash 1.5s ease-in-out forwards;
                  }
                `}</style>
              </CardContent>
            </Card>

            {/* File type breakdown */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Files className="h-5 w-5 text-blue-500" />
                    Storage Breakdown
                  </CardTitle>
                  <CardDescription>
                    Distribution of storage by file type
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {storageData.map((item, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div 
                              className="h-3 w-3 rounded-sm mr-2" 
                              style={{ 
                                backgroundColor: [
                                  '#3b82f6', // Blue
                                  '#14b8a6', // Teal
                                  '#f59e0b', // Amber
                                  '#8b5cf6', // Violet
                                  '#ec4899', // Pink
                                  '#6b7280', // Gray
                                ][index % 6] 
                              }}
                            />
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="text-sm font-medium">{formatBytes(item.value)}</div>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full" 
                            style={{ 
                              width: `${item.percentage}%`,
                              backgroundColor: [
                                '#3b82f6', // Blue
                                '#14b8a6', // Teal
                                '#f59e0b', // Amber
                                '#8b5cf6', // Violet
                                '#ec4899', // Pink
                                '#6b7280', // Gray
                              ][index % 6] 
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-teal-500" />
                    Storage Management
                  </CardTitle>
                  <CardDescription>
                    Tips to optimize your storage usage
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-2">
                      <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <DownloadCloud className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Compress Large Files</h4>
                        <p className="text-sm text-muted-foreground">Use ZIP or RAR compression to reduce file sizes before uploading.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="p-2 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
                        <Files className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Regular Cleanup</h4>
                        <p className="text-sm text-muted-foreground">Delete unused files and duplicates to free up space.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                        <HardDrive className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Cloud Links</h4>
                        <p className="text-sm text-muted-foreground">Use cloud links instead of uploading very large files directly.</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button variant="outline" className="w-full" onClick={() => router.push('/my-files')}>
                      Manage My Files
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
