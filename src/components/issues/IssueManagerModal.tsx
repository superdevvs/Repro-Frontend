import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Bell, MoreVertical, Search, Filter, X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardClientRequest } from '@/types/dashboard';
import { useIssueManager } from '@/context/IssueManagerContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Severity = 'high' | 'medium' | 'low';

const severityBadge = (severity: Severity) => {
  switch (severity) {
    case 'high':
      return 'bg-destructive text-destructive-foreground border-destructive/30';
    case 'medium':
      return 'bg-amber-500 text-white border-amber-500/30 dark:bg-amber-600 dark:text-amber-50';
    default:
      return 'bg-slate-500 text-white border-slate-500/30 dark:bg-slate-600 dark:text-slate-50';
  }
};

type SeverityFilter = 'all' | 'high' | 'medium' | 'low';
type SortOption = 'newest' | 'oldest' | 'severity' | 'client';

const statusToSeverity = (status?: string | null): Severity => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'resolved') return 'low';
  if (normalized === 'in-progress' || normalized === 'in_progress') return 'medium';
  return 'high';
};

export const IssueManagerModal: React.FC = () => {
  const { isOpen, requests, selectedRequestId, closeModal, selectRequest } = useIssueManager();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [resolvedRequests, setResolvedRequests] = useState<Set<string>>(new Set());

  const handleMarkResolved = (requestId: string) => {
    setResolvedRequests(prev => new Set(prev).add(requestId));
    toast({
      title: "Request Resolved",
      description: "The request has been marked as resolved.",
      variant: "default",
    });
  };

  const handleNotifyConcerned = (recipient: 'photographer' | 'editor' | 'management') => {
    const recipientName = recipient === 'photographer' ? 'Photographer' : 
                          recipient === 'editor' ? 'Editor' : 
                          'Management';
    toast({
      title: "Notification Sent",
      description: `${recipientName} has been notified about this request.`,
      variant: "default",
    });
  };

  const filteredAndSortedRequests = useMemo(() => {
    let filtered = requests.filter(request => !resolvedRequests.has(String(request.id)));

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(request =>
        request.note.toLowerCase().includes(query) ||
        request.raisedBy?.name?.toLowerCase().includes(query) ||
        request.shoot?.address?.toLowerCase().includes(query) ||
        request.status?.toLowerCase().includes(query)
      );
    }

    // Apply severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(request => statusToSeverity(request.status) === severityFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
        case 'oldest':
          return new Date(a.updatedAt || a.createdAt || 0).getTime() - new Date(b.updatedAt || b.createdAt || 0).getTime();
        case 'severity':
          const severityOrder = { high: 3, medium: 2, low: 1 };
          return severityOrder[statusToSeverity(b.status)] - severityOrder[statusToSeverity(a.status)];
        case 'client':
          return (a.shoot?.client?.name || '').localeCompare(b.shoot?.client?.name || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [requests, resolvedRequests, searchQuery, severityFilter, sortOption]);

  return (
    <Dialog open={isOpen} onOpenChange={closeModal}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold">Request Manager</DialogTitle>
          <DialogDescription>
            Manage and track all requests across your shoots
          </DialogDescription>
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
                  <SelectItem value="severity">By Severity</SelectItem>
                  <SelectItem value="client">By Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {filteredAndSortedRequests.length} of {requests.length} requests
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

          {/* Issues List */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {filteredAndSortedRequests.length === 0 ? (
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
                {filteredAndSortedRequests.map((request) => {
                  const requestId = String(request.id);
                  const severity = statusToSeverity(request.status);
                  return (
                  <div
                    key={requestId}
                    className={cn(
                      'rounded-xl border p-4 bg-card hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer',
                      selectedRequestId === requestId && 'border-primary ring-2 ring-inset ring-primary/20',
                      severity === 'high' 
                        ? 'border-destructive/40 bg-destructive/5 dark:bg-destructive/10' 
                        : severity === 'medium'
                        ? 'border-amber-500/40 bg-amber-50/30 dark:bg-amber-500/10 dark:border-amber-500/40'
                        : 'border-border bg-card'
                    )}
                    onClick={() => selectRequest(requestId)}
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
                          {request.raisedBy?.name ? `${request.raisedBy.name} • ` : ''}
                          {request.status || 'Needs review'}
                        </span>
                        {request.updatedAt && (
                          <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">
                            Updated {new Date(request.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            const shootId = request.shootId || request.shoot?.id;
                            closeModal();
                            navigate(`/shoots/${shootId}#requests`);
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Shoot
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkResolved(requestId);
                          }}
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
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Bell className="h-3 w-3 mr-1" />
                              Notify
                              <MoreVertical className="h-3 w-3 ml-0.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleNotifyConcerned('photographer')}>
                              <Bell className="h-4 w-4 mr-2" />
                              Notify Photographer
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleNotifyConcerned('editor')}>
                              <Bell className="h-4 w-4 mr-2" />
                              Notify Editor
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleNotifyConcerned('management')}>
                              <Bell className="h-4 w-4 mr-2" />
                              Notify Management
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
  );
};



