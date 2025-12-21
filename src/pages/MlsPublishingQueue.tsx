import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/components/auth/AuthProvider';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import API_ROUTES from '@/lib/api';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Loader2, 
  RefreshCw, 
  Eye, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MlsQueueItem {
  id: number;
  address: string;
  mls_id: string;
  client: string;
  photographer: string;
  status: 'pending' | 'published' | 'error';
  last_published: string | null;
  manifest_id: string | null;
  response: any;
}

const MlsPublishingQueue = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const [queueItems, setQueueItems] = useState<MlsQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MlsQueueItem | null>(null);
  const [manifestDialogOpen, setManifestDialogOpen] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  // Only allow admin and superadmin to access this page
  if (!['admin', 'superadmin'].includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(API_ROUTES.integrations.brightMls.queue);
      if (response.data.success && Array.isArray(response.data.data)) {
        setQueueItems(response.data.data);
      } else {
        setQueueItems([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to load MLS queue.",
        variant: "destructive",
      });
      setQueueItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (shootId: number) => {
    setRetryingId(shootId);
    try {
      // Get shoot details first
      const shootResponse = await apiClient.get(`/shoots/${shootId}`);
      const shoot = shootResponse.data.data;

      // Prepare photos
      const photos = shoot.files
        ?.filter((f: any) => f.path || f.url)
        .slice(0, 20)
        .map((f: any) => ({
          url: f.path || f.url || '',
          filename: f.filename || `photo-${f.id}`,
          selected: true,
        })) || [];

      // Publish again
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
      );

      if (publishResponse.data.success) {
        toast({
          title: "Republished",
          description: "Media manifest has been republished successfully.",
        });
        loadQueue();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to republish.",
        variant: "destructive",
      });
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Published
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6 p-6">
          <PageHeader
            badge="Admin"
            title="MLS Publishing Queue"
            description="Track and manage Bright MLS publishing status for all shoots"
          />

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : queueItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No shoots with MLS IDs found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shoot ID</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>MLS ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Photographer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Published</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">#{item.id}</TableCell>
                        <TableCell>{item.address}</TableCell>
                        <TableCell>{item.mls_id || '—'}</TableCell>
                        <TableCell>{item.client}</TableCell>
                        <TableCell>{item.photographer}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(item.last_published)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.response && (
                              <Dialog
                                open={manifestDialogOpen && selectedItem?.id === item.id}
                                onOpenChange={(open) => {
                                  setManifestDialogOpen(open);
                                  if (open) {
                                    setSelectedItem(item);
                                  }
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedItem(item);
                                      setManifestDialogOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl">
                                  <DialogHeader>
                                    <DialogTitle>Publish Details</DialogTitle>
                                    <DialogDescription>
                                      View manifest response and error details
                                    </DialogDescription>
                                  </DialogHeader>
                                  <ScrollArea className="max-h-[500px]">
                                    <div className="space-y-4">
                                      {item.manifest_id && (
                                        <div>
                                          <p className="text-sm font-medium">Manifest ID</p>
                                          <p className="text-sm text-muted-foreground">
                                            {item.manifest_id}
                                          </p>
                                        </div>
                                      )}
                                      <div>
                                        <p className="text-sm font-medium mb-2">Response</p>
                                        <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
                                          {JSON.stringify(
                                            typeof item.response === 'string'
                                              ? JSON.parse(item.response)
                                              : item.response,
                                            null,
                                            2
                                          )}
                                        </pre>
                                      </div>
                                    </div>
                                  </ScrollArea>
                                </DialogContent>
                              </Dialog>
                            )}
                            {item.status === 'error' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRetry(item.id)}
                                disabled={retryingId === item.id}
                              >
                                {retryingId === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <RefreshCw className="mr-1 h-4 w-4" />
                                    Retry
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="outline" onClick={loadQueue} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default MlsPublishingQueue;


