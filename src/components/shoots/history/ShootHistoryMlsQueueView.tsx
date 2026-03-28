import { useEffect, useState } from 'react'
import { Eye, Clock, XCircle, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { HorizontalLoader } from '@/components/ui/horizontal-loader'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/services/api'
import API_ROUTES from '@/lib/api'

export const ShootHistoryMlsQueueView: React.FC = () => {
  const { toast } = useToast()
  const [queueItems, setQueueItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [manifestDialogOpen, setManifestDialogOpen] = useState(false)
  const [retryingId, setRetryingId] = useState<number | null>(null)

  useEffect(() => {
    loadQueue()
  }, [])

  const loadQueue = async () => {
    setLoading(true)
    try {
      const response = await apiClient.get(API_ROUTES.integrations.brightMls.queue)
      if (response.data.success && Array.isArray(response.data.data)) {
        setQueueItems(response.data.data)
      } else {
        setQueueItems([])
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load MLS queue.',
        variant: 'destructive',
      })
      setQueueItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async (shootId: number) => {
    setRetryingId(shootId)
    try {
      const shootResponse = await apiClient.get(`/shoots/${shootId}`)
      const shoot = shootResponse.data.data

      const photos = shoot.files
        ?.filter((f: any) => f.path || f.url)
        .map((f: any) => ({
          id: f.id,
          url: f.path || f.url || '',
          filename: f.filename || `photo-${f.id}`,
          selected: true,
        })) || []

      const publishResponse = await apiClient.post(
        API_ROUTES.integrations.brightMls.publish(shootId),
        {
          photos,
          iguide_tour_url: shoot.iguide_tour_url,
          documents: shoot.iguide_floorplans?.map((fp: any) => ({
            url: fp.url || fp,
            filename: fp.filename || 'floorplan.pdf',
            visibility: 'private',
          })) || [],
        }
      )

      if (publishResponse.data.success) {
        toast({
          title: 'Republished',
          description: 'Media manifest has been republished successfully.',
        })
        loadQueue()
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to republish.',
        variant: 'destructive',
      })
    } finally {
      setRetryingId(null)
    }
  }

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return <Badge variant="outline">Not Published</Badge>
    switch (status) {
      case 'published':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Published
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <HorizontalLoader message="Loading shoots..." className="px-4" />
          ) : queueItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No shoots with MLS IDs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left text-sm font-medium">Shoot ID</th>
                    <th className="p-3 text-left text-sm font-medium">Address</th>
                    <th className="p-3 text-left text-sm font-medium">MLS ID</th>
                    <th className="p-3 text-left text-sm font-medium">Client</th>
                    <th className="p-3 text-left text-sm font-medium">Photographer</th>
                    <th className="p-3 text-left text-sm font-medium">Status</th>
                    <th className="p-3 text-left text-sm font-medium">Last Published</th>
                    <th className="p-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queueItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">#{item.id}</td>
                      <td className="p-3">{item.address}</td>
                      <td className="p-3">{item.mls_id || '—'}</td>
                      <td className="p-3">{item.client}</td>
                      <td className="p-3">{item.photographer}</td>
                      <td className="p-3">{getStatusBadge(item.status)}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {formatDate(item.last_published)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {item.response && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedItem(item)
                                  setManifestDialogOpen(true)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {item.status === 'error' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetry(item.id)}
                              disabled={retryingId === item.id}
                            >
                              {retryingId === item.id ? 'Retrying...' : 'Retry'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={loadQueue} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {manifestDialogOpen && selectedItem && (
        <Dialog open={manifestDialogOpen} onOpenChange={setManifestDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Publish Details</DialogTitle>
              <DialogDescription>
                View manifest response and error details
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[500px] overflow-auto">
              <div className="space-y-4">
                {selectedItem.manifest_id && (
                  <div>
                    <p className="text-sm font-medium">Manifest ID</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedItem.manifest_id}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-2">Response</p>
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
                    {JSON.stringify(
                      typeof selectedItem.response === 'string'
                        ? JSON.parse(selectedItem.response)
                        : selectedItem.response,
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
