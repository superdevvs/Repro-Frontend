import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { BrightMlsImportDialog } from '@/components/integrations/BrightMlsImportDialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import API_ROUTES from '@/lib/api';
import type { ShootData } from '@/types/shoots';
import {
  buildBrightMlsPublishPayloadWithFallback,
  closePendingBrightMlsWindow,
  navigateBrightMlsWindow,
  openPendingBrightMlsWindow,
} from '@/utils/brightMls';
import { HorizontalLoader } from '@/components/ui/horizontal-loader';
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
  XCircle,
  ExternalLink
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
  mode: string | null;
  environment: string | null;
  redirect_url: string | null;
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
  const [brightMlsRedirectUrl, setBrightMlsRedirectUrl] = useState<string | null>(null);

  // Only allow admin and superadmin to access this page
  if (!['admin', 'superadmin', 'editing_manager'].includes(role)) {
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
    let brightMlsPopup: Window | null = null;
    try {
      // Get shoot details first
      const shootResponse = await apiClient.get(`/shoots/${shootId}`);
      const shoot = shootResponse.data.data;

      brightMlsPopup = openPendingBrightMlsWindow();
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const payload = await buildBrightMlsPublishPayloadWithFallback(
        shoot as unknown as Partial<ShootData> & Record<string, unknown>,
        token,
      );
      if (payload.photos.length === 0) {
        throw new Error('No images found to send. Please ensure the shoot has completed images.');
      }

      // Publish again
      const publishResponse = await apiClient.post(
        API_ROUTES.integrations.brightMls.publish(shootId),
        payload
      );

      if (publishResponse.data.success) {
        const redirectUrl = publishResponse.data.data?.redirect_url || publishResponse.data.redirect_url;
        const popupOpened = navigateBrightMlsWindow(brightMlsPopup, redirectUrl || null);
        if (!popupOpened) {
          throw new Error('Failed to open Bright MLS popup. Please allow popups and try again.');
        }

        setBrightMlsRedirectUrl(null);
        toast({
          title: "Republished",
          description: "Bright MLS opened in a popup window. Complete the import there.",
        });
        loadQueue();
      }
    } catch (error: any) {
      closePendingBrightMlsWindow(brightMlsPopup);
      toast({
        title: "Error",
        description: error.response?.data?.message || error.message || "Failed to republish.",
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
      <div className="space-y-6 p-6">
        <PageHeader
          badge="Admin"
          title="MLS Publishing Queue"
          description="Track and manage Bright MLS publishing status for all shoots"
        />

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <HorizontalLoader message="Loading MLS queue..." className="px-4" />
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
                      <TableHead>Mode / Env</TableHead>
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
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="text-xs w-fit">
                              {item.mode === 'new' ? 'New API' : 'Legacy'}
                            </Badge>
                            <Badge variant="secondary" className="text-xs w-fit">
                              {(item.environment || 't1').toUpperCase()}
                            </Badge>
                          </div>
                        </TableCell>
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
                            {item.redirect_url && (
                              <a
                                href={item.redirect_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="ghost" size="sm">
                                  <ExternalLink className="mr-1 h-4 w-4" />
                                  View on MLS
                                </Button>
                              </a>
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
          <BrightMlsImportDialog
            redirectUrl={brightMlsRedirectUrl}
            onRedirectUrlChange={setBrightMlsRedirectUrl}
          />
      </div>
    </DashboardLayout>
  );
};

export default MlsPublishingQueue;


