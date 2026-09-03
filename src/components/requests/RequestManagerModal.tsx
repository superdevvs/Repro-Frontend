import React, { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Inbox,
  MapPin,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { API_BASE_URL } from '@/config/env';
import { useRequestManager } from '@/context/RequestManagerContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DashboardClientRequest } from '@/types/dashboard';

type NormalizedStatus = 'open' | 'in-progress' | 'resolved' | 'dismissed';
type RequestSection = 'active' | 'history';
type ActiveStatusFilter = 'all' | 'open' | 'in-progress';
type SortOption = 'newest' | 'oldest' | 'client';

const HISTORY_PAGE_SIZE = 8;

const normalizeStatus = (status?: string | null): NormalizedStatus => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'in_progress') return 'in-progress';
  if (
    normalized === 'resolved' ||
    normalized === 'dismissed' ||
    normalized === 'in-progress' ||
    normalized === 'open'
  ) {
    return normalized;
  }
  return 'open';
};

const statusPresentation: Record<
  NormalizedStatus,
  { label: string; className: string; dotClassName: string }
> = {
  open: {
    label: 'Needs review',
    className: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300',
    dotClassName: 'bg-rose-500',
  },
  'in-progress': {
    label: 'In progress',
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    dotClassName: 'bg-amber-500',
  },
  resolved: {
    label: 'Resolved',
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    dotClassName: 'bg-emerald-500',
  },
  dismissed: {
    label: 'Dismissed',
    className: 'border-border bg-muted text-muted-foreground',
    dotClassName: 'bg-muted-foreground',
  },
};

const formatActivityTime = (value?: string | null) => {
  if (!value) return 'No activity time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return formatDistanceToNow(date, { addSuffix: true });
};

const requestMatchesSearch = (request: DashboardClientRequest, query: string) => {
  if (!query) return true;
  const searchable = [
    request.note,
    request.raisedBy?.name,
    request.shoot?.address,
    request.shoot?.client?.name,
    normalizeStatus(request.status),
  ];
  return searchable.some((value) => value?.toLowerCase().includes(query));
};

const sortRequests = (requests: DashboardClientRequest[], sortOption: SortOption) =>
  [...requests].sort((a, b) => {
    if (sortOption === 'client') {
      return (a.shoot?.client?.name || '').localeCompare(b.shoot?.client?.name || '');
    }

    const firstTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const secondTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return sortOption === 'oldest' ? firstTime - secondTime : secondTime - firstTime;
  });

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
  const [activeStatusFilter, setActiveStatusFilter] = useState<ActiveStatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [activeSection, setActiveSection] = useState<RequestSection>('active');
  const [historyPage, setHistoryPage] = useState(1);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setActiveSection('active');
      setHistoryPage(1);
      setSearchQuery('');
      setActiveStatusFilter('all');
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
  }, [activeSection, activeStatusFilter, searchQuery, sortOption]);

  const availableRequests = useMemo(
    () =>
      requests.filter((request) => {
        const shootId = request.shootId || request.shoot?.id;
        return Boolean(shootId) && normalizeStatus(request.status) !== 'dismissed';
      }),
    [requests],
  );

  const allActiveRequests = useMemo(
    () =>
      availableRequests.filter(
        (request) => !['resolved', 'dismissed'].includes(normalizeStatus(request.status)),
      ),
    [availableRequests],
  );

  const allHistoryRequests = useMemo(
    () => availableRequests.filter((request) => normalizeStatus(request.status) === 'resolved'),
    [availableRequests],
  );

  const filteredSectionRequests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const sectionRequests = activeSection === 'active' ? allActiveRequests : allHistoryRequests;
    const filtered = sectionRequests.filter((request) => {
      const matchesStatus =
        activeSection === 'history' ||
        activeStatusFilter === 'all' ||
        normalizeStatus(request.status) === activeStatusFilter;
      return matchesStatus && requestMatchesSearch(request, normalizedQuery);
    });
    return sortRequests(filtered, sortOption);
  }, [activeSection, activeStatusFilter, allActiveRequests, allHistoryRequests, searchQuery, sortOption]);

  const totalHistoryPages = Math.max(
    1,
    Math.ceil(filteredSectionRequests.length / HISTORY_PAGE_SIZE),
  );

  const visibleRequests = useMemo(() => {
    if (activeSection === 'active') return filteredSectionRequests;
    const safePage = Math.min(historyPage, totalHistoryPages);
    const startIndex = (safePage - 1) * HISTORY_PAGE_SIZE;
    return filteredSectionRequests.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);
  }, [activeSection, filteredSectionRequests, historyPage, totalHistoryPages]);

  useEffect(() => {
    setHistoryPage((previous) => Math.min(previous, totalHistoryPages));
  }, [totalHistoryPages]);

  const selectedRequest =
    visibleRequests.find((request) => String(request.id) === String(selectedRequestId)) ??
    visibleRequests[0] ??
    null;

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

      if (!response.ok) throw new Error('Failed to mark request as resolved');

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
        title: 'Request resolved',
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

  const handleDismissResolved = async (request: DashboardClientRequest) => {
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
        body: JSON.stringify({ status: 'dismissed' }),
      });

      if (!response.ok) throw new Error('Failed to dismiss request');

      updateRequest(requestId, { status: 'dismissed', updatedAt: new Date().toISOString() });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shoot-request-updated'));
      }
      toast({
        title: 'Request dismissed',
        description: 'The resolved request has been closed.',
      });
    } catch (error) {
      toast({
        title: 'Unable to dismiss request',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleNotifyConcerned = (recipient: 'photographer' | 'editor' | 'management') => {
    const recipientName =
      recipient === 'photographer'
        ? 'Photographer'
        : recipient === 'editor'
          ? 'Editor'
          : 'Management';
    toast({
      title: 'Notification sent',
      description: `${recipientName} has been notified about this request.`,
    });
  };

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

  const resultSummary = `${visibleRequests.length} of ${
    activeSection === 'active' ? allActiveRequests.length : allHistoryRequests.length
  }`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="flex h-[92dvh] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:h-[86vh] sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-4 pr-14 text-left sm:px-6 sm:py-5 sm:pr-16">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                Request Manager
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs sm:text-sm">
                Review client requests, coordinate the team, and close the loop.
              </DialogDescription>
            </div>
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">
              <span className="text-foreground">{allActiveRequests.length}</span> active
              <span className="px-1.5 text-border">·</span>
              <span className="text-foreground">{allHistoryRequests.length}</span> resolved
            </p>
          </div>
        </DialogHeader>

        <div className="shrink-0 border-b border-border/70 px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-1 border-b border-border/60 lg:border-b-0">
              {(['active', 'history'] as const).map((section) => {
                const isActive = section === activeSection;
                const count = section === 'active' ? allActiveRequests.length : allHistoryRequests.length;
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setActiveSection(section)}
                    className={cn(
                      'relative min-h-9 px-3 text-sm font-semibold capitalize text-muted-foreground transition-colors',
                      'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
                      isActive
                        ? 'text-foreground after:bg-primary'
                        : 'hover:text-foreground after:bg-transparent',
                    )}
                  >
                    {section}
                    <span
                      className={cn(
                        'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]',
                        isActive ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search requests"
                placeholder="Search note, address, client..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-9 pl-9 pr-9"
              />
              {searchQuery ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>

            <div
              className={cn(
                'grid gap-2 lg:contents',
                activeSection === 'active' ? 'grid-cols-2' : 'grid-cols-1',
              )}
            >
              {activeSection === 'active' ? (
                <Select
                  value={activeStatusFilter}
                  onValueChange={(value) => setActiveStatusFilter(value as ActiveStatusFilter)}
                >
                  <SelectTrigger aria-label="Filter request status" className="h-9 w-full lg:w-[10rem]">
                    <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All active</SelectItem>
                    <SelectItem value="open">Needs review</SelectItem>
                    <SelectItem value="in-progress">In progress</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}

              <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                <SelectTrigger aria-label="Sort requests" className="h-9 w-full lg:w-[9.5rem]">
                  <Clock3 className="mr-2 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="client">Client name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(13rem,0.9fr)_minmax(15rem,1.1fr)] md:grid-cols-[minmax(18rem,0.9fr)_minmax(22rem,1.1fr)] md:grid-rows-1">
          <section aria-label="Request queue" className="flex min-h-0 flex-col bg-muted/[0.12]">
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {activeSection === 'active' ? 'Active queue' : 'Resolved history'}
              </p>
              <span className="text-xs text-muted-foreground">{resultSummary}</span>
            </div>

            <div data-request-list className="min-h-0 flex-1 overflow-y-auto">
              {visibleRequests.length === 0 ? (
                <div className="flex h-full min-h-44 flex-col items-center justify-center px-6 text-center">
                  <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
                    {allActiveRequests.length + allHistoryRequests.length === 0 ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Inbox className="h-5 w-5" />
                    )}
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {allActiveRequests.length + allHistoryRequests.length === 0
                      ? 'All clear'
                      : 'No matching requests'}
                  </p>
                  <p className="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">
                    {allActiveRequests.length + allHistoryRequests.length === 0
                      ? 'There are no requests to manage right now.'
                      : 'Adjust the search or filter to see more results.'}
                  </p>
                </div>
              ) : (
                visibleRequests.map((request) => {
                  const requestId = String(request.id);
                  const normalizedStatus = normalizeStatus(request.status);
                  const presentation = statusPresentation[normalizedStatus];
                  const isSelected = String(selectedRequest?.id) === requestId;
                  return (
                    <button
                      key={requestId}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => selectRequest(requestId)}
                      className={cn(
                        'group relative w-full border-b border-border/55 px-4 py-3 text-left transition-colors',
                        'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                        isSelected ? 'bg-primary/[0.07]' : 'hover:bg-muted/45',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute inset-y-2 left-0 w-0.5 rounded-r-full transition-colors',
                          isSelected ? 'bg-primary' : 'bg-transparent',
                        )}
                      />
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full shadow-[0_0_0_3px_hsl(var(--background))]',
                            presentation.dotClassName,
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                              {request.note}
                            </p>
                            <MoreHorizontal className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                          </div>
                          <p className="mt-1.5 truncate text-xs text-muted-foreground">
                            {request.shoot?.address || `Shoot #${request.shootId}`}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground/80">
                            <span className="truncate">
                              {request.shoot?.client?.name || request.raisedBy?.name || 'Client request'}
                            </span>
                            <span className="shrink-0">
                              {formatActivityTime(request.updatedAt || request.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {activeSection === 'history' && filteredSectionRequests.length > HISTORY_PAGE_SIZE ? (
              <div className="flex shrink-0 items-center justify-between border-t border-border/60 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Page {Math.min(historyPage, totalHistoryPages)} of {totalHistoryPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((previous) => Math.max(1, previous - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    disabled={historyPage >= totalHistoryPages}
                    onClick={() =>
                      setHistoryPage((previous) => Math.min(totalHistoryPages, previous + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          <section aria-label="Request details" className="flex min-h-0 flex-col border-t border-border/70 bg-background md:border-l md:border-t-0">
            {selectedRequest ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                  {(() => {
                    const requestId = String(selectedRequest.id);
                    const normalizedStatus = normalizeStatus(selectedRequest.status);
                    const presentation = statusPresentation[normalizedStatus];
                    return (
                      <div className="mx-auto max-w-2xl">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Request #{requestId}
                          </p>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                              presentation.className,
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', presentation.dotClassName)} />
                            {presentation.label}
                          </span>
                        </div>

                        <h2 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
                          {selectedRequest.note}
                        </h2>

                        <dl className="mt-6 divide-y divide-border/60 border-y border-border/60">
                          <div className="grid grid-cols-[1.25rem_5.5rem_1fr] items-start gap-2 py-3 text-sm">
                            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <dt className="text-muted-foreground">Property</dt>
                            <dd className="min-w-0 text-right font-medium text-foreground">
                              {selectedRequest.shoot?.address || `Shoot #${selectedRequest.shootId}`}
                            </dd>
                          </div>
                          <div className="grid grid-cols-[1.25rem_5.5rem_1fr] items-start gap-2 py-3 text-sm">
                            <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <dt className="text-muted-foreground">Client</dt>
                            <dd className="min-w-0 text-right font-medium text-foreground">
                              {selectedRequest.shoot?.client?.name || 'Not available'}
                            </dd>
                          </div>
                          <div className="grid grid-cols-[1.25rem_5.5rem_1fr] items-start gap-2 py-3 text-sm">
                            <Bell className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <dt className="text-muted-foreground">Raised by</dt>
                            <dd className="min-w-0 text-right font-medium text-foreground">
                              {selectedRequest.raisedBy?.name || 'Client'}
                              {selectedRequest.raisedBy?.role ? (
                                <span className="ml-1 font-normal text-muted-foreground">
                                  · {selectedRequest.raisedBy.role}
                                </span>
                              ) : null}
                            </dd>
                          </div>
                          <div className="grid grid-cols-[1.25rem_5.5rem_1fr] items-start gap-2 py-3 text-sm">
                            <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <dt className="text-muted-foreground">Activity</dt>
                            <dd className="min-w-0 text-right font-medium text-foreground">
                              {formatActivityTime(selectedRequest.updatedAt || selectedRequest.createdAt)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })()}
                </div>

                <div className="shrink-0 border-t border-border/70 bg-background/95 px-4 py-3 sm:px-6">
                  <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2 sm:flex sm:items-center">
                    <Button
                      type="button"
                      className="col-span-2 sm:flex-1"
                      onClick={() => void handleViewShoot(selectedRequest)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open shoot
                    </Button>

                    {normalizeStatus(selectedRequest.status) === 'resolved' ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="sm:flex-1"
                        disabled={updatingRequestId === String(selectedRequest.id)}
                        onClick={() => void handleDismissResolved(selectedRequest)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        {updatingRequestId === String(selectedRequest.id) ? 'Dismissing...' : 'Dismiss'}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="sm:flex-1"
                        disabled={updatingRequestId === String(selectedRequest.id)}
                        onClick={() => void handleMarkResolved(selectedRequest)}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        {updatingRequestId === String(selectedRequest.id) ? 'Resolving...' : 'Resolve'}
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" className="w-full sm:w-auto sm:px-3">
                          <Bell className="mr-2 h-4 w-4" />
                          Notify
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleNotifyConcerned('photographer')}>
                          Notify photographer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleNotifyConcerned('editor')}>
                          Notify editor
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleNotifyConcerned('management')}>
                          Notify management
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Inbox className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-foreground">Select a request</p>
                <p className="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">
                  Choose a request from the queue to review its property and available actions.
                </p>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
