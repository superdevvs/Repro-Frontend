import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Check,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  X,
  MoreVertical,
  Bell,
  Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';

interface Request {
  id: string;
  shootId: string;
  mediaId?: string;
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

interface ShootRequestManagerProps {
  isOpen: boolean;
  onClose: () => void;
  shootId: string;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  onIssueUpdate: () => void;
  preselectedMediaIds?: string[]; // Pre-selected media IDs when opened from media tab
}

type StatusFilter = 'all' | 'open' | 'in-progress' | 'resolved';
type SortOption = 'newest' | 'oldest' | 'status';
type SeverityFilter = 'all' | 'high' | 'medium' | 'low';

// Map status to severity for display consistency with dashboard
const getSeverityFromStatus = (status: string): 'high' | 'medium' | 'low' => {
  if (status === 'open') return 'high';
  if (status === 'in-progress') return 'medium';
  return 'low';
};

const severityBadge = (severity: 'high' | 'medium' | 'low') => {
  switch (severity) {
    case 'high':
      return 'bg-destructive text-destructive-foreground border-destructive/30';
    case 'medium':
      return 'bg-amber-500 text-white border-amber-500/30 dark:bg-amber-600 dark:text-amber-50';
    default:
      return 'bg-slate-500 text-white border-slate-500/30 dark:bg-slate-600 dark:text-slate-50';
  }
};

export function ShootIssueManager({
  isOpen,
  onClose,
  shootId,
  isAdmin,
  isPhotographer,
  isEditor,
  isClient,
  onIssueUpdate,
  preselectedMediaIds = [],
}: ShootRequestManagerProps) {
  const { toast } = useToast();
  const { user, isImpersonating } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [resolvedRequests, setResolvedRequests] = useState<Set<string>>(new Set());

  // Create request form state
  const [selectedMediaId, setSelectedMediaId] = useState<string>('none');
  const [requestNote, setRequestNote] = useState('');
  const [assignToRole, setAssignToRole] = useState<'editor' | 'photographer' | 'unassigned'>('unassigned');
  const [assignToUserId, setAssignToUserId] = useState<string>('any');
  const [editors, setEditors] = useState<Array<{ id: string; name: string }>>([]);
  const [photographers, setPhotographers] = useState<Array<{ id: string; name: string }>>([]);
  const [mediaFiles, setMediaFiles] = useState<Array<{ id: string; filename: string; url?: string; thumbnail?: string }>>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());

  // Load requests
  useEffect(() => {
    if (!isOpen || !shootId) return;
    
    const loadRequests = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/issues`, {
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
      } finally {
        setLoading(false);
      }
    };
    
    loadRequests();
    
    // If preselected media IDs provided, auto-open create dialog and pre-select them
    if (preselectedMediaIds.length > 0) {
      setSelectedMediaIds(new Set(preselectedMediaIds));
      setCreateDialogOpen(true);
    }
  }, [isOpen, shootId, onIssueUpdate, preselectedMediaIds]);

  // Load media files for request creation - get image files with URLs
  useEffect(() => {
    if (!shootId || !createDialogOpen) return;
    
    const loadMedia = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files?type=edited`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        
        if (res.ok) {
          const json = await res.json();
          // Filter for image files and include URLs
          const imageFiles = (json.data || json || [])
            .filter((f: any) => {
              const fileType = (f.file_type || f.fileType || f.mime_type || '').toLowerCase();
              const filename = (f.filename || f.stored_filename || '').toLowerCase();
              return fileType.startsWith('image/') || 
                     /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif)$/.test(filename);
            })
            .map((f: any) => ({
              id: String(f.id),
              filename: f.filename || f.stored_filename || 'unknown',
              url: f.thumb_url || f.medium_url || f.thumbnail_path || f.web_path || null,
              thumbnail: f.thumb_url || f.thumbnail_path || f.placeholder_path || null,
            }));
          setMediaFiles(imageFiles);
        }
      } catch (error) {
        console.error('Error loading media:', error);
      }
    };
    
    loadMedia();
  }, [shootId, createDialogOpen]);

  // Load editors and photographers for assignment
  useEffect(() => {
    if (!isAdmin || !createDialogOpen) return;
    
    const loadUsers = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        const [editorsRes, photographersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users/editors`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
          }),
          fetch(`${API_BASE_URL}/api/users/photographers`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
          }),
        ]);
        
        if (editorsRes.ok) {
          const json = await editorsRes.json();
          setEditors((json.data || json || []).map((u: any) => ({
            id: String(u.id),
            name: u.name,
          })));
        }
        
        if (photographersRes.ok) {
          const json = await photographersRes.json();
          setPhotographers((json.data || json || []).map((u: any) => ({
            id: String(u.id),
            name: u.name,
          })));
        }
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    
    loadUsers();
  }, [isAdmin, createDialogOpen]);

  // Filter requests based on role
  const visibleRequests = useMemo(() => {
    let filtered = requests.filter(request => {
      // Filter out resolved requests if they're in the resolved set
      if (resolvedRequests.has(request.id)) return false;
      
      if (isAdmin) return true;
      if (isClient) {
        const currentUserId = localStorage.getItem('userId') || '';
        return request.raisedBy.id === currentUserId;
      }
      if (isEditor) {
        return request.assignedToRole === 'editor';
      }
      if (isPhotographer) {
        return request.assignedToRole === 'photographer';
      }
      return false;
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(request =>
        request.note.toLowerCase().includes(query) ||
        request.raisedBy.name.toLowerCase().includes(query) ||
        request.mediaFilename?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(request => request.status === statusFilter);
    }

    // Apply severity filter (mapped from status)
    if (severityFilter !== 'all') {
      filtered = filtered.filter(request => {
        const severity = getSeverityFromStatus(request.status);
        return severity === severityFilter;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'status':
          const statusOrder = { 'open': 3, 'in-progress': 2, 'resolved': 1 };
          return statusOrder[b.status] - statusOrder[a.status];
        default:
          return 0;
      }
    });

    return filtered;
  }, [requests, searchQuery, statusFilter, severityFilter, sortOption, resolvedRequests, isAdmin, isClient, isEditor, isPhotographer]);

  // Create request - send all selected photos in one request using mediaIds array
  const handleCreateRequest = async () => {
    if (!requestNote.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a note for the request',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const mediaIdsArray = Array.from(selectedMediaIds);
      
      const payload: any = {
        note: requestNote,
      };
      
      // Send all selected photos as mediaIds array
      if (mediaIdsArray.length > 0) {
        payload.mediaIds = mediaIdsArray;
      }
      
      // Admin can assign directly
      if (isAdmin && assignToRole && assignToRole !== 'unassigned') {
        payload.assignedToRole = assignToRole;
        if (assignToUserId && assignToUserId !== 'any') {
          payload.assignedToUserId = assignToUserId;
        }
      }
      
      // Build headers with impersonation support
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      // Add impersonation header if impersonating (use the impersonated user's ID)
      if (isImpersonating && user?.id) {
        headers['X-Impersonate-User-Id'] = String(user.id);
      }
      
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create request');
      }
      
      toast({
        title: 'Success',
        description: mediaIdsArray.length > 0 
          ? `Request created with ${mediaIdsArray.length} photo${mediaIdsArray.length !== 1 ? 's' : ''}`
          : 'Request created successfully',
      });
      
      // Reset form and close dialog
      resetCreateForm();
      setCreateDialogOpen(false);
      
      // Refresh requests
      onIssueUpdate();
    } catch (error) {
      console.error('Error creating request:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create request',
        variant: 'destructive',
      });
    }
  };

  // Mark request as resolved
  const handleMarkResolved = (requestId: string) => {
    setResolvedRequests(prev => new Set(prev).add(requestId));
    // Also update status on backend
    handleUpdateStatus(requestId, 'resolved');
  };

  // Update request status
  const handleUpdateStatus = async (requestId: string, newStatus: 'open' | 'in-progress' | 'resolved') => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/issues/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!res.ok) throw new Error('Failed to update request');
      
      if (newStatus === 'resolved') {
        toast({
          title: "Request Resolved",
          description: "The request has been marked as resolved.",
          variant: "default",
        });
      } else {
        toast({
          title: 'Success',
          description: 'Request status updated',
        });
      }
      
      onIssueUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update request',
        variant: 'destructive',
      });
    }
  };

  // Notify concerned parties
  const handleNotifyConcerned = (request: Request, recipient: 'photographer' | 'editor' | 'management') => {
    const recipientName = recipient === 'photographer' ? 'Photographer' : 
                          recipient === 'editor' ? 'Editor' : 
                          'Management';
    toast({
      title: "Notification Sent",
      description: `${recipientName} has been notified about this request.`,
      variant: "default",
    });
  };

  // Assign request
  const handleAssignRequest = async (requestId: string, role: 'editor' | 'photographer', userId?: string) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/issues/${requestId}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ assignedToRole: role, assignedToUserId: userId }),
      });
      
      if (!res.ok) throw new Error('Failed to assign request');
      
      toast({
        title: 'Success',
        description: 'Request assigned successfully',
      });
      
      onIssueUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign request',
        variant: 'destructive',
      });
    }
  };


  const resetCreateForm = () => {
    setRequestNote('');
    setSelectedMediaId('none');
    setSelectedMediaIds(new Set());
    setAssignToRole('unassigned');
    setAssignToUserId('any');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold">Request Manager</DialogTitle>
                <DialogDescription>
                  Manage and track all requests for this shoot
                </DialogDescription>
              </div>
              {(isAdmin || isClient) && (
                <Button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCreateDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isClient ? 'Create Request' : 'Create Request'}
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0">
            {/* Filters and Search */}
            <div className="px-6 py-4 border-b space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as SeverityFilter)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="status">By Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {visibleRequests.length} of {requests.length} requests
                </span>
                {resolvedRequests.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setResolvedRequests(new Set())}
                  >
                    Show resolved ({resolvedRequests.size})
                  </Button>
                )}
              </div>
            </div>

            {/* Requests List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-muted-foreground">Loading requests...</div>
                </div>
              ) : visibleRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="text-muted-foreground mb-2">
                    {requests.length === 0 ? (
                      <>
                        <p className="text-lg font-medium mb-1">No requests found</p>
                        <p className="text-sm">All clear! No requests to manage.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-medium mb-1">No matching requests</p>
                        <p className="text-sm">Try adjusting your filters or search query.</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleRequests.map((request) => {
                    const severity = getSeverityFromStatus(request.status);
                    return (
                      <div
                        key={request.id}
                        className={cn(
                          'rounded-xl border p-4 bg-card hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer',
                          severity === 'high' 
                            ? 'border-destructive/40 bg-destructive/5 dark:bg-destructive/10' 
                            : severity === 'medium'
                            ? 'border-amber-500/40 bg-amber-50/30 dark:bg-amber-500/10 dark:border-amber-500/40'
                            : 'border-border bg-card'
                        )}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground leading-snug break-words">
                                {request.note}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0 whitespace-nowrap border',
                                severityBadge(severity)
                              )}
                            >
                              {severity}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="truncate">
                              {request.raisedBy.name} ({request.raisedBy.role}){request.mediaFilename ? ` • ${request.mediaFilename}` : ''} • {request.status || 'Needs review'}
                            </span>
                            {request.updatedAt && (
                              <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">
                                Updated {new Date(request.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary flex-shrink-0"
                              onClick={() => handleMarkResolved(request.id)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Mark Resolved
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary flex-shrink-0"
                                >
                                  <Bell className="h-3 w-3 mr-1" />
                                  Notify
                                  <MoreVertical className="h-3 w-3 ml-0.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleNotifyConcerned(request, 'photographer')}>
                                  <Bell className="h-4 w-4 mr-2" />
                                  Notify Photographer
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleNotifyConcerned(request, 'editor')}>
                                  <Bell className="h-4 w-4 mr-2" />
                                  Notify Editor
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleNotifyConcerned(request, 'management')}>
                                  <Bell className="h-4 w-4 mr-2" />
                                  Notify Management
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {isAdmin && request.status !== 'resolved' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary flex-shrink-0"
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleAssignRequest(request.id, 'editor')}>
                                    Assign to Editor
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAssignRequest(request.id, 'photographer')}>
                                    Assign to Photographer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Request Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isClient ? 'Create Request' : 'Create Request'}</DialogTitle>
            <DialogDescription>
              {isClient
                ? 'Select photos and describe your request for this shoot.'
                : 'Select photos and create a new request for this shoot.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 flex-1 overflow-y-auto">
            {/* Photo Selection Grid */}
            <div className="space-y-2">
              <Label>Select photos (optional - leave empty for general request)</Label>
              {mediaFiles.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  Loading photos...
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[300px] overflow-y-auto p-2 border rounded-lg">
                  {mediaFiles.map(file => {
                    const isSelected = selectedMediaIds.has(file.id);
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => {
                          const newSelected = new Set(selectedMediaIds);
                          if (isSelected) {
                            newSelected.delete(file.id);
                          } else {
                            newSelected.add(file.id);
                          }
                          setSelectedMediaIds(newSelected);
                        }}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                          isSelected 
                            ? "border-primary ring-2 ring-primary/50" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {file.url || file.thumbnail ? (
                          <img
                            src={file.url || file.thumbnail}
                            alt={file.filename}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground p-1 text-center">
                            {file.filename}
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <Check className="h-6 w-6 text-primary bg-background rounded-full p-1" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedMediaIds.size > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedMediaIds.size} photo{selectedMediaIds.size !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label>Request description</Label>
              <Textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="Describe your request..."
                rows={4}
              />
            </div>

            {/* Assignment (Admin only) */}
            {isAdmin && (
              <>
                <div className="space-y-2">
                  <Label>Assign to role</Label>
                  <Select value={assignToRole} onValueChange={(v) => {
                    setAssignToRole(v as 'editor' | 'photographer' | 'unassigned');
                    setAssignToUserId('any');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="photographer">Photographer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {assignToRole && assignToRole !== 'unassigned' && (
                  <div className="space-y-2">
                    <Label>Assign to specific user (optional)</Label>
                    <Select value={assignToUserId} onValueChange={setAssignToUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any {assignToRole}</SelectItem>
                        {(assignToRole === 'editor' ? editors : photographers).map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button"
                variant="outline" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCreateDialogOpen(false);
                  resetCreateForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateRequest();
                }} 
                disabled={!requestNote.trim()}
              >
                Create Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
