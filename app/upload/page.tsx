import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FileUpload } from "@/components/ui/file-upload"

export default function UploadPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Files</h1>
          <p className="text-muted-foreground">Upload files to your account</p>
        </div>

        <FileUpload />
      </div>
    </DashboardLayout>
  )
}
