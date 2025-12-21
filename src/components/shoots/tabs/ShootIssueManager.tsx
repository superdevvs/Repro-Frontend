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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { cn } from '@/lib/utils';

interface Issue {
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

interface ShootIssueManagerProps {
  isOpen: boolean;
  onClose: () => void;
  shootId: string;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  onIssueUpdate: () => void;
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
}: ShootIssueManagerProps) {
  const { toast } = useToast();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [resolvedIssues, setResolvedIssues] = useState<Set<string>>(new Set());

  // Create issue form state
  const [selectedMediaId, setSelectedMediaId] = useState<string>('none');
  const [issueNote, setIssueNote] = useState('');
  const [assignToRole, setAssignToRole] = useState<'editor' | 'photographer' | 'unassigned'>('unassigned');
  const [assignToUserId, setAssignToUserId] = useState<string>('any');
  const [editors, setEditors] = useState<Array<{ id: string; name: string }>>([]);
  const [photographers, setPhotographers] = useState<Array<{ id: string; name: string }>>([]);
  const [mediaFiles, setMediaFiles] = useState<Array<{ id: string; filename: string }>>([]);

  // Load issues
  useEffect(() => {
    if (!isOpen || !shootId) return;
    
    const loadIssues = async () => {
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
          setIssues(json.data || json || []);
        }
      } catch (error) {
        console.error('Error loading issues:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadIssues();
  }, [isOpen, shootId, onIssueUpdate]);

  // Load media files for issue creation
  useEffect(() => {
    if (!shootId || !createDialogOpen) return;
    
    const loadMedia = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        
        if (res.ok) {
          const json = await res.json();
          const files = (json.data || json || []).map((f: any) => ({
            id: String(f.id),
            filename: f.filename || f.stored_filename,
          }));
          setMediaFiles(files);
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

  // Filter issues based on role
  const visibleIssues = useMemo(() => {
    let filtered = issues.filter(issue => {
      // Filter out resolved issues if they're in the resolved set
      if (resolvedIssues.has(issue.id)) return false;
      
      if (isAdmin) return true;
      if (isClient) {
        const currentUserId = localStorage.getItem('userId') || '';
        return issue.raisedBy.id === currentUserId;
      }
      if (isEditor) {
        return issue.assignedToRole === 'editor';
      }
      if (isPhotographer) {
        return issue.assignedToRole === 'photographer';
      }
      return false;
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(issue =>
        issue.note.toLowerCase().includes(query) ||
        issue.raisedBy.name.toLowerCase().includes(query) ||
        issue.mediaFilename?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(issue => issue.status === statusFilter);
    }

    // Apply severity filter (mapped from status)
    if (severityFilter !== 'all') {
      filtered = filtered.filter(issue => {
        const severity = getSeverityFromStatus(issue.status);
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
  }, [issues, searchQuery, statusFilter, severityFilter, sortOption, resolvedIssues, isAdmin, isClient, isEditor, isPhotographer]);

  // Create issue
  const handleCreateIssue = async () => {
    if (!issueNote.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a note for the issue',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const payload: any = {
        note: issueNote,
      };
      
      if (selectedMediaId && selectedMediaId !== 'none') {
        payload.mediaId = selectedMediaId;
      }
      
      // Admin can assign directly
      if (isAdmin && assignToRole && assignToRole !== 'unassigned') {
        payload.assignedToRole = assignToRole;
        if (assignToUserId && assignToUserId !== 'any') {
          payload.assignedToUserId = assignToUserId;
        }
      }
      
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to create issue: ${errorText}`);
      }
      
      toast({
        title: 'Success',
        description: 'Issue created successfully',
      });
      
      // Reset form and close dialog
      resetCreateForm();
      setCreateDialogOpen(false);
      
      // Refresh issues
      onIssueUpdate();
    } catch (error) {
      console.error('Error creating issue:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create issue',
        variant: 'destructive',
      });
    }
  };

  // Mark issue as resolved
  const handleMarkResolved = (issueId: string) => {
    setResolvedIssues(prev => new Set(prev).add(issueId));
    // Also update status on backend
    handleUpdateStatus(issueId, 'resolved');
  };

  // Update issue status
  const handleUpdateStatus = async (issueId: string, newStatus: 'open' | 'in-progress' | 'resolved') => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!res.ok) throw new Error('Failed to update issue');
      
      if (newStatus === 'resolved') {
        toast({
          title: "Issue Resolved",
          description: "The issue has been marked as resolved.",
          variant: "default",
        });
      } else {
        toast({
          title: 'Success',
          description: 'Issue status updated',
        });
      }
      
      onIssueUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update issue',
        variant: 'destructive',
      });
    }
  };

  // Notify concerned parties
  const handleNotifyConcerned = (issue: Issue, recipient: 'photographer' | 'editor' | 'management') => {
    const recipientName = recipient === 'photographer' ? 'Photographer' : 
                          recipient === 'editor' ? 'Editor' : 
                          'Management';
    toast({
      title: "Notification Sent",
      description: `${recipientName} has been notified about this issue.`,
      variant: "default",
    });
  };

  // Assign issue
  const handleAssignIssue = async (issueId: string, role: 'editor' | 'photographer', userId?: string) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/issues/${issueId}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ assignedToRole: role, assignedToUserId: userId }),
      });
      
      if (!res.ok) throw new Error('Failed to assign issue');
      
      toast({
        title: 'Success',
        description: 'Issue assigned successfully',
      });
      
      onIssueUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign issue',
        variant: 'destructive',
      });
    }
  };


  const resetCreateForm = () => {
    setIssueNote('');
    setSelectedMediaId('none');
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
                <DialogTitle className="text-2xl font-bold">Issue Manager</DialogTitle>
                <DialogDescription>
                  Manage and track all issues for this shoot
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
                  {isClient ? 'Raise Issue' : 'Create Issue'}
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
                    placeholder="Search issues..."
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
                  Showing {visibleIssues.length} of {issues.length} issues
                </span>
                {resolvedIssues.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setResolvedIssues(new Set())}
                  >
                    Show resolved ({resolvedIssues.size})
                  </Button>
                )}
              </div>
            </div>

            {/* Issues List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-muted-foreground">Loading issues...</div>
                </div>
              ) : visibleIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="text-muted-foreground mb-2">
                    {issues.length === 0 ? (
                      <>
                        <p className="text-lg font-medium mb-1">No issues found</p>
                        <p className="text-sm">All clear! No issues to manage.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-medium mb-1">No matching issues</p>
                        <p className="text-sm">Try adjusting your filters or search query.</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleIssues.map((issue) => {
                    const severity = getSeverityFromStatus(issue.status);
                    return (
                      <div
                        key={issue.id}
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
                                {issue.note}
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
                              {issue.raisedBy.name} ({issue.raisedBy.role}){issue.mediaFilename ? ` • ${issue.mediaFilename}` : ''} • {issue.status || 'Needs review'}
                            </span>
                            {issue.updatedAt && (
                              <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">
                                Updated {new Date(issue.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary flex-shrink-0"
                              onClick={() => handleMarkResolved(issue.id)}
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
                                <DropdownMenuItem onClick={() => handleNotifyConcerned(issue, 'photographer')}>
                                  <Bell className="h-4 w-4 mr-2" />
                                  Notify Photographer
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleNotifyConcerned(issue, 'editor')}>
                                  <Bell className="h-4 w-4 mr-2" />
                                  Notify Editor
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleNotifyConcerned(issue, 'management')}>
                                  <Bell className="h-4 w-4 mr-2" />
                                  Notify Management
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {isAdmin && issue.status !== 'resolved' && (
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
                                  <DropdownMenuItem onClick={() => handleAssignIssue(issue.id, 'editor')}>
                                    Assign to Editor
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAssignIssue(issue.id, 'photographer')}>
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

      {/* Create Issue Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isClient ? 'Raise Issue' : 'Create Issue'}</DialogTitle>
            <DialogDescription>
              {isClient
                ? 'Describe the issue you found with this shoot or specific media.'
                : 'Create a new issue for this shoot.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Media Selection */}
            <div className="space-y-2">
              <Label>Attach to media (optional)</Label>
              <Select value={selectedMediaId} onValueChange={setSelectedMediaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select media file or leave for general issue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General shoot issue</SelectItem>
                  {mediaFiles.map(file => (
                    <SelectItem key={file.id} value={file.id}>
                      {file.filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label>Issue description</Label>
              <Textarea
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
                placeholder="Describe the issue..."
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
                  handleCreateIssue();
                }} 
                disabled={!issueNote.trim()}
              >
                Create issue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
