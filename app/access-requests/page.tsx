"use client"

import { useState, useEffect } from 'react'
import { Loader2, InboxIcon, SendIcon } from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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

export default function AccessRequestsPage() {
  const { user } = useUser()
  const [activeTab, setActiveTab] = useState('received')
  const [receivedRequests, setReceivedRequests] = useState<AccessRequest[]>([])
  const [sentRequests, setSentRequests] = useState<AccessRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isResponding, setIsResponding] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null)
  const [responseMessage, setResponseMessage] = useState('')
  const [responseAction, setResponseAction] = useState<'approved' | 'rejected' | null>(null)

  // Function to fetch access requests
  const fetchRequests = async (type: 'sent' | 'received') => {
    if (!user) return

    try {
      const response = await fetch(`/api/access-requests?type=${type}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch access requests')
      }

      return data.requests || []
    } catch (error: any) {
      console.error(`Error fetching ${type} access requests:`, error)
      toast.error(`Failed to load access requests: ${error.message}`)
      return []
    }
  }

  // Load requests on mount and when user changes
  useEffect(() => {
    async function loadRequests() {
      if (!user) return

      setIsLoading(true)
      try {
        const [received, sent] = await Promise.all([
          fetchRequests('received'),
          fetchRequests('sent')
        ])
        
        setReceivedRequests(received)
        setSentRequests(sent)
      } finally {
        setIsLoading(false)
      }
    }

    loadRequests()
  }, [user])

  // Handle responding to a request
  const handleRespond = (request: AccessRequest, action: 'approved' | 'rejected') => {
    setSelectedRequest(request)
    setResponseAction(action)
    setResponseMessage('')
  }

  // Submit the response
  const submitResponse = async () => {
    if (!selectedRequest || !responseAction) return

    setIsResponding(true)
    try {
      const response = await fetch(`/api/access-requests/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: responseAction,
          responseMessage: responseMessage
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to respond to access request')
      }

      // Update the local state
      setReceivedRequests(prev => 
        prev.map(req => 
          req.id === selectedRequest.id 
            ? { 
                ...req, 
                status: responseAction,
                response_message: responseMessage,
                responded_at: new Date().toISOString()
              } 
            : req
        )
      )

      toast.success(`Access request ${responseAction} successfully`)
      
      // Close the dialog
      setSelectedRequest(null)
      setResponseAction(null)
    } catch (error: any) {
      console.error('Error responding to request:', error)
      toast.error(`Failed to respond: ${error.message}`)
    } finally {
      setIsResponding(false)
    }
  }

  // Helper to get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      case 'pending':
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  // Helper to get user display name
  const getUserName = (user: { email: string | null, full_name: string | null }) => {
    return user.full_name || user.email || 'Unknown User'
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Access Requests</h1>
          <p className="text-muted-foreground">
            Manage access requests for shared files
          </p>
        </div>

        <Tabs defaultValue="received" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received" className="flex items-center">
              <InboxIcon className="mr-2 h-4 w-4" />
              Received Requests
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex items-center">
              <SendIcon className="mr-2 h-4 w-4" />
              Sent Requests
            </TabsTrigger>
          </TabsList>

          {/* Received Requests Tab */}
          <TabsContent value="received" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
              </div>
            ) : receivedRequests.length > 0 ? (
              receivedRequests.map(request => (
                <Card key={request.id} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">
                        File Request: {request.files.name}
                      </CardTitle>
                      {getStatusBadge(request.status)}
                    </div>
                    <CardDescription>
                      From {getUserName(request.requester)} • {formatDate(new Date(request.created_at))}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Request message:</p>
                      <p className="text-sm p-3 bg-muted rounded-md">{request.message}</p>
                      
                      {request.response_message && (
                        <>
                          <p className="text-sm font-medium">Your response:</p>
                          <p className="text-sm p-3 bg-muted rounded-md">{request.response_message}</p>
                          <p className="text-xs text-muted-foreground">
                            Responded on {request.responded_at ? formatDate(new Date(request.responded_at)) : 'N/A'}
                          </p>
                        </>
                      )}
                    </div>
                  </CardContent>
                  
                  {request.status === 'pending' && (
                    <CardFooter className="flex justify-end space-x-2 bg-muted/20 pt-2">
                      <Button 
                        variant="outline" 
                        onClick={() => handleRespond(request, 'rejected')}
                      >
                        Reject
                      </Button>
                      <Button 
                        onClick={() => handleRespond(request, 'approved')}
                      >
                        Approve
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <InboxIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No requests received</h3>
                <p className="text-muted-foreground max-w-md">
                  You haven't received any access requests yet. When users request access to your shared files, they'll appear here.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Sent Requests Tab */}
          <TabsContent value="sent" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
              </div>
            ) : sentRequests.length > 0 ? (
              sentRequests.map(request => (
                <Card key={request.id} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">
                        {request.files.name}
                      </CardTitle>
                      {getStatusBadge(request.status)}
                    </div>
                    <CardDescription>
                      To {getUserName(request.owner)} • {formatDate(new Date(request.created_at))}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Your message:</p>
                      <p className="text-sm p-3 bg-muted rounded-md">{request.message}</p>
                      
                      {request.response_message && (
                        <>
                          <p className="text-sm font-medium">Response:</p>
                          <p className="text-sm p-3 bg-muted rounded-md">{request.response_message}</p>
                          <p className="text-xs text-muted-foreground">
                            Responded on {request.responded_at ? formatDate(new Date(request.responded_at)) : 'N/A'}
                          </p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <SendIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No requests sent</h3>
                <p className="text-muted-foreground max-w-md">
                  You haven't sent any access requests yet. Browse the shared files and request access to files you need.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Response Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {responseAction === 'approved' ? 'Approve' : 'Reject'} Access Request
            </DialogTitle>
            <DialogDescription>
              {responseAction === 'approved' 
                ? 'The user will be granted access to this file.' 
                : 'The user will not be granted access to this file.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <label htmlFor="response-message" className="text-sm font-medium mb-2 block">
              Response Message (Optional)
            </label>
            <Textarea 
              id="response-message"
              placeholder={responseAction === 'approved' 
                ? "Any additional information they should know..."
                : "Reason for rejection..."}
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)} disabled={isResponding}>
              Cancel
            </Button>
            <Button 
              onClick={submitResponse} 
              disabled={isResponding}
              variant={responseAction === 'approved' ? 'default' : 'destructive'}
            >
              {isResponding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                responseAction === 'approved' ? 'Approve Request' : 'Reject Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
} 