import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  Plus,
  CheckCircle2,
  UserCog,
  Camera,
  Paintbrush,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { ShootData } from '@/types/shoots';
import { API_BASE_URL } from '@/config/env';
import { format } from 'date-fns';
import { ShootIssueManager } from './ShootIssueManager';

interface ShootDetailsIssuesTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  role: string;
  onShootUpdate: () => void;
}

interface Request {
  id: string;
  shootId: string;
  mediaId?: string;
  mediaIds?: string[];
  mediaFiles?: Array<{
    id: string;
    filename: string;
    url?: string;
    thumbnail?: string;
  }>;
  raisedBy: {
    id: string;
    name: string;
    role: string;
  };
  assignedToRole?: 'editor' | 'photographer';
  assignedToUser?: {
    id: string;
    name: string;
  };
  status: 'open' | 'in-progress' | 'resolved';
  note: string;
  createdAt: string;
  updatedAt: string;
  mediaFilename?: string;
}

export function ShootDetailsIssuesTab({
  shoot,
  isAdmin,
  isPhotographer,
  isEditor,
  isClient,
  role,
  onShootUpdate,
}: ShootDetailsIssuesTabProps) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<Request[]>([]);
  const [requestManagerOpen, setRequestManagerOpen] = useState(false);
  const [markingResolved, setMarkingResolved] = useState(false);
  
  // Check if shoot has requests that can be marked as resolved
  const shootHasRequests = shoot.isFlagged || 
    ['on_hold', 'raw_issue', 'editing_issue'].includes(shoot.workflowStatus || '');
  
  // Can mark as resolved if photographer/editor and shoot has requests
  const canMarkResolved = (isPhotographer || isEditor) && shootHasRequests;
  
  // Handle marking requests as resolved
  const handleMarkRequestsResolved = async () => {
    setMarkingResolved(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/mark-issues-resolved`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to mark requests as resolved');
      }

      toast({
        title: 'Success',
        description: 'Requests marked as resolved. Shoot resubmitted for review.',
      });
      onShootUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark requests as resolved',
        variant: 'destructive',
      });
    } finally {
      setMarkingResolved(false);
    }
  };

  // Load requests
  useEffect(() => {
    if (!shoot.id) return;
    
    const loadRequests = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/issues`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        
        if (res.ok) {
          const json = await res.json();
          setRequests(json.data || json || []);
        }
      } catch (error) {
        console.error('Error loading requests:', error);
      }
    };
    
    loadRequests();
  }, [shoot.id, onShootUpdate]);

  // Filter requests based on role
  const visibleRequests = requests.filter(request => {
    if (isAdmin) return true;
    if (isClient) {
      // Client sees only requests they created
      const currentUserId = localStorage.getItem('userId') || '';
      return request.raisedBy.id === currentUserId;
    }
    if (isEditor) {
      // Editor sees requests assigned to editor role or specific editor
      return request.assignedToRole === 'editor';
    }
    if (isPhotographer) {
      // Photographer sees requests assigned to photographer role
      return request.assignedToRole === 'photographer';
    }
    return false;
  });


  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'open': { label: 'Open', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
      'in-progress': { label: 'In Progress', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
      'resolved': { label: 'Resolved', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
    };
    const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' };
    return <Badge className={statusInfo.className}>{statusInfo.label}</Badge>;
  };

  const handleRequestUpdate = () => {
    onShootUpdate();
    // Reload requests
    const loadRequests = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/issues`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        
        if (res.ok) {
          const json = await res.json();
          setRequests(json.data || json || []);
        }
      } catch (error) {
        console.error('Error loading requests:', error);
      }
    };
    loadRequests();
  };

  const hasOpenRequests = visibleRequests.some(request => request.status === 'open' || request.status === 'in-progress');

  // Assign request to photographer or editor
  const handleAssignRequest = async (requestId: string, assignTo: 'photographer' | 'editor') => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/issues/${requestId}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ assignedToRole: assignTo }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to assign request');
      }

      toast({
        title: 'Request assigned',
        description: `Request has been assigned to ${assignTo}.`,
      });
      handleRequestUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign request',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Requests</h3>
          {hasOpenRequests && (
            <p className="text-sm text-muted-foreground mt-1">
              {visibleRequests.filter(r => r.status === 'open' || r.status === 'in-progress').length} open request(s)
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canMarkResolved && (
            <Button 
              onClick={handleMarkRequestsResolved}
              disabled={markingResolved}
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {markingResolved ? 'Submitting...' : 'Mark Resolved & Resubmit'}
            </Button>
          )}
          {(isAdmin || isClient) && (
            <Button onClick={() => setRequestManagerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {isClient ? 'Create request' : 'Add request'}
            </Button>
          )}
        </div>
      </div>

      {/* Requests List */}
      {visibleRequests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No requests found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleRequests.map(request => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(request.status)}
                      {request.mediaFiles && request.mediaFiles.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {request.mediaFiles.length} photo{request.mediaFiles.length !== 1 ? 's' : ''} tagged
                        </Badge>
                      )}
                      {request.mediaFilename && !request.mediaFiles && (
                        <Badge variant="outline" className="text-xs">
                          {request.mediaFilename}
                        </Badge>
                      )}
                      {request.assignedToRole && (
                        <Badge variant="secondary" className="text-xs">
                          → {request.assignedToRole === 'photographer' ? 'Photographer' : 'Editor'}
                          {request.assignedToUser && `: ${request.assignedToUser.name}`}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created by {request.raisedBy.name} ({request.raisedBy.role}) on{' '}
                      {format(new Date(request.createdAt), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                  {/* Admin: Assign to photographer or editor */}
                  {isAdmin && request.status !== 'resolved' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <UserCog className="h-3.5 w-3.5" />
                          Assign
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleAssignRequest(request.id, 'photographer')}>
                          <Camera className="h-4 w-4 mr-2" />
                          Assign to Photographer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAssignRequest(request.id, 'editor')}>
                          <Paintbrush className="h-4 w-4 mr-2" />
                          Assign to Editor
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap">{request.note}</p>
                
                {/* Show tagged photos */}
                {request.mediaFiles && request.mediaFiles.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Tagged Photos ({request.mediaFiles.length}):
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {request.mediaFiles.map((mediaFile) => (
                        <div
                          key={mediaFile.id}
                          className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted group cursor-pointer hover:border-primary transition-colors"
                          title={mediaFile.filename}
                          onClick={() => {
                            // Open image in new tab if URL is available
                            if (mediaFile.url) {
                              window.open(mediaFile.url, '_blank');
                            }
                          }}
                        >
                          {mediaFile.thumbnail || mediaFile.url ? (
                            <img
                              src={mediaFile.thumbnail || mediaFile.url}
                              alt={mediaFile.filename}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to a placeholder if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  const fallback = document.createElement('div');
                                  fallback.className = 'w-full h-full flex items-center justify-center text-xs text-muted-foreground p-1 text-center';
                                  fallback.textContent = mediaFile.filename;
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-1 text-center break-words">
                              {mediaFile.filename}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {mediaFile.filename}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Warning if open requests exist */}
      {hasOpenRequests && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This shoot has open requests and will remain in "In review" status until all requests are resolved.
          </AlertDescription>
        </Alert>
      )}

      {/* Request Manager Modal */}
      <ShootIssueManager
        isOpen={requestManagerOpen}
        onClose={() => setRequestManagerOpen(false)}
        shootId={shoot.id}
        isAdmin={isAdmin}
        isPhotographer={isPhotographer}
        isEditor={isEditor}
        isClient={isClient}
        onIssueUpdate={handleRequestUpdate}
      />
    </div>
  );
}



