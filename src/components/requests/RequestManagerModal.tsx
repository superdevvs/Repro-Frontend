import React, { useEffect, useMemo, useState } from 'react';
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
import { API_BASE_URL } from '@/config/env';
import { Check, Bell, MoreVertical, Search, Filter, X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardClientRequest } from '@/types/dashboard';
import { useRequestManager } from '@/context/RequestManagerContext';
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
type RequestSection = 'active' | 'history';

const HISTORY_PAGE_SIZE = 8;

const statusToSeverity = (status?: string | null): Severity => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'resolved') return 'low';
  if (normalized === 'in-progress' || normalized === 'in_progress') return 'medium';
  return 'high';
};

const normalizeStatus = (status?: string | null) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'in_progress') return 'in-progress';
  if (normalized === 'resolved' || normalized === 'in-progress' || normalized === 'open') {
    return normalized;
  }
  return 'open';
};

export const RequestManagerModal: React.FC = () => {
  const {
    isOpen,
    requests,
    selectedRequestId,
    closeModal,
    selectRequest,
    updateRequest,
    openRequestShoot,
  } = useRequestManager();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [activeSection, setActiveSection] = useState<RequestSection>('active');
  const [historyPage, setHistoryPage] = useState(1);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setActiveSection('active');
      setHistoryPage(1);
      return;
    }

    const selectedRequest = requests.find(
      (request) => String(request.id) === String(selectedRequestId),
    );
    if (selectedRequest && normalizeStatus(selectedRequest.status) === 'resolved') {
      setActiveSection('history');
    }
  }, [isOpen, requests, selectedRequestId]);

  useEffect(() => {
    setHistoryPage(1);
  }, [searchQuery, severityFilter, sortOption]);

  const handleMarkResolved = async (request: DashboardClientRequest) => {
    const shootId = request.shootId || request.shoot?.id;
    if (!shootId) {
      toast({
        title: 'Shoot unavailable',
        description: 'This request is no longer linked to an active shoot.',
        variant: 'destructive',
      });
      return;
    }

    const requestId = String(request.id);
    setUpdatingRequestId(requestId);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/issues/${requestId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ status: 'resolved' }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark request as resolved');
      }

      const json = await response.json();
      updateRequest(requestId, {
        status: normalizeStatus(json.data?.status || 'resolved'),
        updatedAt: json.data?.updatedAt || new Date().toISOString(),
      });
      setActiveSection('history');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shoot-request-updated'));
      }
      toast({
        title: 'Request Resolved',
        description: 'The request has been moved to history.',
      });
    } catch (error) {
      toast({
        title: 'Unable to resolve request',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingRequestId(null);
    }
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
    let filtered = requests.filter((request) => {
      const shootId = request.shootId || request.shoot?.id;
      return Boolean(shootId);
    });

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
        case 'severity': {
          const severityOrder = { high: 3, medium: 2, low: 1 };
          return severityOrder[statusToSeverity(b.status)] - severityOrder[statusToSeverity(a.status)];
        }
        case 'client':
          return (a.shoot?.client?.name || '').localeCompare(b.shoot?.client?.name || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [requests, searchQuery, severityFilter, sortOption]);

  const activeRequests = useMemo(
    () => filteredAndSortedRequests.filter((request) => normalizeStatus(request.status) !== 'resolved'),
    [filteredAndSortedRequests],
  );

  const historyRequests = filteredAndSortedRequests;
  const totalHistoryPages = Math.max(1, Math.ceil(historyRequests.length / HISTORY_PAGE_SIZE));
  const paginatedHistoryRequests = useMemo(() => {
    const safePage = Math.min(historyPage, totalHistoryPages);
    const startIndex = (safePage - 1) * HISTORY_PAGE_SIZE;
    return historyRequests.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);
  }, [historyPage, historyRequests, totalHistoryPages]);

  useEffect(() => {
    setHistoryPage((prev) => Math.min(prev, totalHistoryPages));
  }, [totalHistoryPages]);

  const handleViewShoot = async (request: DashboardClientRequest) => {
    const result = await openRequestShoot(request);
    if (result === 'opened') {
      closeModal();
      return;
    }

    if (result === 'missing') {
      toast({
        title: 'Shoot no longer exists',
        description: 'This request was removed because its shoot has already been deleted.',
      });
      return;
    }

    const shootId = request.shootId || request.shoot?.id;
    if (!shootId) {
      toast({
        title: 'Shoot unavailable',
        description: 'This request is no longer linked to an active shoot.',
        variant: 'destructive',
      });
      return;
    }

    closeModal();
    navigate(`/shoots/${shootId}#requests`);
  };

  const visibleRequests = activeSection === 'active' ? activeRequests : paginatedHistoryRequests;

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
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={activeSection === 'active' ? 'default' : 'outline'}
                className="rounded-full"
                onClick={() => setActiveSection('active')}
              >
                Active ({activeRequests.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeSection === 'history' ? 'default' : 'outline'}
                className="rounded-full"
                onClick={() => setActiveSection('history')}
              >
                History ({historyRequests.length})
              </Button>
            </div>
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
                {activeSection === 'active'
                  ? `Showing ${activeRequests.length} active of ${historyRequests.length} total requests`
                  : `Showing ${visibleRequests.length} of ${historyRequests.length} total requests`}
              </span>
            </div>
          </div>

          {/* Issues List */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {visibleRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-muted-foreground mb-2">
                  {historyRequests.length === 0 ? (
                    <>
                      <p className="text-lg font-medium mb-1">No requests found</p>
                      <p className="text-sm">All clear! No requests to manage.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium mb-1">
                        {activeSection === 'active' ? 'No active requests' : 'No matching requests'}
                      </p>
                      <p className="text-sm">
                        {activeSection === 'active'
                          ? 'Everything active has been cleared.'
                          : 'Try adjusting your filters or search query.'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleRequests.map((request) => {
                  const requestId = String(request.id);
                  const severity = statusToSeverity(request.status);
                  const statusLabel = normalizeStatus(request.status);
                  const isResolved = statusLabel === 'resolved';
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
                          {statusLabel || 'Needs review'}
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
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleViewShoot(request);
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Shoot
                        </Button>
                        {!isResolved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary flex-shrink-0"
                            disabled={updatingRequestId === requestId}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleMarkResolved(request);
                            }}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {updatingRequestId === requestId ? 'Resolving...' : 'Mark Resolved'}
                          </Button>
                        )}
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
            {activeSection === 'history' && historyRequests.length > HISTORY_PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {Math.min(historyPage, totalHistoryPages)} of {totalHistoryPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={historyPage >= totalHistoryPages}
                    onClick={() => setHistoryPage((prev) => Math.min(totalHistoryPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};



