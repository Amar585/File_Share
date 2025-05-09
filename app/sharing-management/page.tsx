"use client"

import { useState, useEffect } from 'react'
import { Loader2, CheckIcon, XIcon } from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'

// Define interface for access request with joined data
interface AccessRequest {
  id: string
  created_at: string
  status: string
  message: string
  response_message: string | null
  responded_at: string | null
  file_id: string
  requester_id: string
  owner_id: string
  files: {
    name: string
    type: string
    size: number
    path: string
    shared: boolean
  }
  requester: {
    email: string | null
    full_name: string | null
  }
  owner: {
    email: string | null
    full_name: string | null
  }
}

export default function SharingManagementPage() {
  const { user } = useUser()
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingRequestIds, setProcessingRequestIds] = useState<string[]>([])

  // Fetch access requests on mount
  useEffect(() => {
    async function fetchRequests() {
      if (!user) return

      try {
        setIsLoading(true)
        console.log('Fetching access requests for user:', user.id)
        
        // Try direct Supabase query first (bypassing relationship issues)
        try {
          const { data, error } = await supabase
            .from('file_access_requests')
            .select('*')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false })
          
          if (error) {
            console.error('Error with simple query:', error)
            throw error
          }
          
          console.log('Raw requests:', data)
          
          if (data && data.length > 0) {
            // Fetch related data separately to avoid join issues
            const enhancedRequests = await Promise.all(
              data.map(async (request) => {
                // Get file data
                const { data: fileData } = await supabase
                  .from('files')
                  .select('name, type, size, path, shared')
                  .eq('id', request.file_id)
                  .single()
                
                // Get requester profile data for full name
                const { data: requesterProfileData } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('id', request.requester_id)
                  .single()

                // Get requester email from auth data using REST API
                let requesterEmail = null;
                try {
                  const authResponse = await fetch(`/api/users/${request.requester_id}/email`)
                  if (authResponse.ok) {
                    const authData = await authResponse.json()
                    requesterEmail = authData.email
                  }
                } catch (err) {
                  console.error('Error fetching requester email:', err)
                }
                
                // Combine the data
                const requesterData = {
                  email: requesterEmail,
                  full_name: requesterProfileData?.full_name || null
                }
                
                // Get owner data
                const { data: ownerData } = await supabase
                  .from('profiles')
                  .select('email, full_name')
                  .eq('id', request.owner_id)
                  .single()
                
                return {
                  ...request,
                  files: fileData || { 
                    name: 'Unknown File',
                    type: '',
                    size: 0,
                    path: '',
                    shared: true
                  },
                  requester: requesterData || {
                    email: null, 
                    full_name: null
                  },
                  owner: ownerData || {
                    email: null,
                    full_name: null
                  }
                }
              })
            )
            
            console.log('Enhanced requests:', enhancedRequests)
            setRequests(enhancedRequests)
          } else {
            setRequests([])
          }
        } catch (supabaseError) {
          console.error('Supabase query failed, trying API endpoint:', supabaseError)
          
          // Fall back to API endpoint if direct query fails
          const response = await fetch('/api/access-requests?type=received')
          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch access requests')
          }

          setRequests(data.requests || [])
        }
      } catch (error: any) {
        console.error('Error fetching access requests:', error)
        toast.error(`Failed to load access requests: ${error.message}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRequests()
  }, [user])

  // Handle approving or denying an access request
  const handleAccessResponse = async (requestId: string, approval: boolean) => {
    setProcessingRequestIds(prev => [...prev, requestId])
    
    try {
      const response = await fetch(`/api/access-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: approval ? 'approved' : 'rejected',
          responseMessage: approval 
            ? 'Your request has been approved. You can now access this file.' 
            : 'Your request has been denied.'
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to respond to access request')
      }

      // Update the local state
      setRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { 
                ...req, 
                status: approval ? 'approved' : 'rejected',
                response_message: approval 
                  ? 'Your request has been approved. You can now access this file.' 
                  : 'Your request has been denied.',
                responded_at: new Date().toISOString()
              } 
            : req
        )
      )

      toast.success(`Access request ${approval ? 'approved' : 'denied'} successfully`)
    } catch (error: any) {
      console.error('Error responding to request:', error)
      toast.error(`Failed to respond: ${error.message}`)
    } finally {
      setProcessingRequestIds(prev => prev.filter(id => id !== requestId))
    }
  }

  // Helper to get user display name
  const getUserName = (user: { email: string | null, full_name: string | null }) => {
    if (user.full_name) return user.full_name;
    if (user.email) return user.email;
    return 'Unknown User';
  }

  // Filter pending requests
  const pendingRequests = requests.filter(req => req.status === 'pending')

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Access Requests</h1>
          <p className="text-muted-foreground">
            Review and manage requests for access to your files
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Access Requests</CardTitle>
            <CardDescription>Review and manage requests for access to your files</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
              </div>
            ) : pendingRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 text-left font-medium">Requester</th>
                      <th className="pb-2 text-left font-medium">File</th>
                      <th className="pb-2 text-left font-medium">Reason</th>
                      <th className="pb-2 text-left font-medium">Date</th>
                      <th className="pb-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map((request) => {
                      const isProcessing = processingRequestIds.includes(request.id)
                      return (
                        <tr key={request.id} className="border-b">
                          <td className="py-4">{getUserName(request.requester)}</td>
                          <td className="py-4">{request.files.name}</td>
                          <td className="py-4 max-w-[300px] truncate">{request.message}</td>
                          <td className="py-4">{formatDate(new Date(request.created_at))}</td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAccessResponse(request.id, false)}
                                disabled={isProcessing}
                                className="border-red-200 hover:bg-red-50 hover:text-red-600"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <XIcon className="mr-1 h-4 w-4 text-red-500" />
                                    Deny
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAccessResponse(request.id, true)}
                                disabled={isProcessing}
                                className="border-green-200 hover:bg-green-50 hover:text-green-600"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckIcon className="mr-1 h-4 w-4 text-green-500" />
                                    Allow
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="text-lg font-semibold mb-2">No pending access requests</h3>
                <p className="text-muted-foreground max-w-md">
                  You don't have any pending access requests for your files right now.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
} 