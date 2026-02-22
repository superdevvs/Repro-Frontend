import React, { useState } from 'react';
import { DashboardIssueItem, DashboardShootSummary, DashboardClientRequest } from '@/types/dashboard';
import { Card } from './SharedComponents';
import { cn } from '@/lib/utils';
import { useIssueManager } from '@/context/IssueManagerContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EditingRequest } from '@/services/editingRequestService';

type RequestsTab = 'client' | 'editing';

interface PendingReviewsCardProps {
  reviews: DashboardShootSummary[];
  issues: DashboardIssueItem[];
  onSelect: (shoot: DashboardShootSummary) => void;
  title?: string;
  emptyRequestsText?: string;
  // Client requests click handler - opens shoot modal with Requests tab
  onClientIssueClick?: (issue: DashboardIssueItem) => void;
  // Special Editing Requests props
  editingRequests?: EditingRequest[];
  editingRequestsLoading?: boolean;
  onCreateEditingRequest?: () => void;
  onEditingRequestClick?: (requestId: number) => void;
  // Client Requests props
  clientRequests?: DashboardClientRequest[];
  clientRequestsLoading?: boolean;
  onClientRequestClick?: (request: DashboardClientRequest) => void;
  // Show tabs
  showEditingTab?: boolean;
  showClientTab?: boolean;
}

const severityBadge = (severity: DashboardIssueItem['severity']) => {
  switch (severity) {
    case 'high':
      return 'bg-destructive text-destructive-foreground border-destructive/30';
    case 'medium':
      return 'bg-amber-500 text-white border-amber-500/30 dark:bg-amber-600 dark:text-amber-50';
    default:
      return 'bg-slate-500 text-white border-slate-500/30 dark:bg-slate-600 dark:text-slate-50';
  }
};

const severityFromStatus = (status?: string | null): DashboardIssueItem['severity'] => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'resolved' || normalized === 'completed') return 'low';
  if (normalized === 'in-progress' || normalized === 'in_progress') return 'medium';
  return 'high';
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  normal: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800',
  high: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
};

const STATUS_STYLES: Record<string, string> = {
  open: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  in_progress: 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800',
  completed: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const PendingReviewsCard: React.FC<PendingReviewsCardProps> = React.memo(({
  reviews,
  issues,
  onSelect,
  title = 'Requests',
  emptyRequestsText = 'No active requests.',
  onClientIssueClick,
  editingRequests = [],
  editingRequestsLoading = false,
  onCreateEditingRequest,
  onEditingRequestClick,
  clientRequests = [],
  clientRequestsLoading = false,
  onClientRequestClick,
  showEditingTab = false,
  showClientTab = false,
}) => {
  const { openModal } = useIssueManager();
  const [resolvedIssues, setResolvedIssues] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<RequestsTab>('client');

  const safeIssues = Array.isArray(issues) ? issues : [];
  const visibleIssues = safeIssues.filter(issue => issue && !resolvedIssues.has(issue.id));
  const safeClientRequests = Array.isArray(clientRequests) ? clientRequests : [];
  const displayClientRequests = showClientTab;

  const activeEditingRequests = Array.isArray(editingRequests) 
    ? editingRequests.filter(r => r && r.status !== 'completed') 
    : [];

  const tabs: { id: RequestsTab; label: string; count: number }[] = [
    {
      id: 'client',
      label: displayClientRequests ? 'Client' : 'Issues',
      count: displayClientRequests ? safeClientRequests.length : visibleIssues.length,
    },
  ];
  
  if (showEditingTab) {
    tabs.push({ id: 'editing', label: 'Editing', count: activeEditingRequests.length });
  }

  return (
    <Card className="flex flex-col h-full flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-col h-full flex-1 min-h-0">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-foreground">{title}</h2>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex gap-1 mb-2 flex-shrink-0 border-b border-border pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {tab.label} {tab.count > 0 && <span className="ml-1 opacity-70">({tab.count})</span>}
              </button>
            ))}
          </div>
        )}

        {/* Client Tab Content */}
        {activeTab === 'client' && (
          <div className="flex-1 flex flex-col min-h-0">
            {displayClientRequests ? (
              safeClientRequests.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-3">
                  {clientRequestsLoading ? 'Loading requests...' : emptyRequestsText}
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div className="space-y-1.5" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {safeClientRequests.map((request) => (
                      <button
                        key={request.id}
                        onClick={() => openModal(safeClientRequests, String(request.id))}
                        className="w-full text-left rounded-lg border border-border/60 bg-muted/20 p-2.5 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-foreground break-words flex-1 min-w-0 line-clamp-1">
                            {request.note}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Badge className={cn('text-[9px] font-semibold border whitespace-nowrap px-1.5 py-0', severityBadge(severityFromStatus(request.status)))}>
                              {request.status}
                            </Badge>
                          </div>
                        </div>
                        {request.shoot?.client?.name && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {request.shoot.client.name}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : visibleIssues.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-3">{emptyRequestsText}</div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="space-y-1.5" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {visibleIssues.map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => onClientIssueClick?.(issue)}
                      className="w-full text-left rounded-lg border border-border/60 bg-muted/20 p-2.5 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                      disabled={!onClientIssueClick}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground break-words flex-1 min-w-0 line-clamp-1">
                          {issue.message}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Badge className={cn('text-[9px] font-semibold border whitespace-nowrap px-1.5 py-0', severityBadge(issue.severity))}>
                            {issue.severity}
                          </Badge>
                        </div>
                      </div>
                      {issue.client && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {issue.client}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Special Editing Requests Tab Content */}
        {activeTab === 'editing' && showEditingTab && (
          <div className="flex-1 flex flex-col min-h-0">
            {editingRequestsLoading ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0">Loading...</div>
            ) : activeEditingRequests.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-3">
                <p className="text-xs text-muted-foreground italic mb-3">No active requests.</p>
                {onCreateEditingRequest && (
                  <Button size="sm" onClick={onCreateEditingRequest} className="w-full">
                    New request
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                <div className="overflow-y-auto flex-1 min-h-0 pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div className="space-y-1.5">
                    {activeEditingRequests.slice(0, 5).map((request) => (
                      <button
                        key={request.id}
                        onClick={() => onEditingRequestClick?.(request.id)}
                        className="w-full text-left rounded-lg border border-border/60 bg-muted/20 p-2.5 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-foreground break-words flex-1 min-w-0 line-clamp-1">
                            {request.summary || 'Untitled request'}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Badge className={cn('text-[9px] font-semibold border whitespace-nowrap px-1.5 py-0', PRIORITY_STYLES[request.priority] || PRIORITY_STYLES.normal)}>
                              {request.priority || 'normal'}
                            </Badge>
                            <Badge className={cn('text-[9px] font-semibold border whitespace-nowrap px-1.5 py-0', STATUS_STYLES[request.status] || STATUS_STYLES.open)}>
                              {STATUS_LABELS[request.status] || 'Open'}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                {onCreateEditingRequest && (
                  <div className="pt-2 mt-auto">
                    <Button size="sm" onClick={onCreateEditingRequest} className="w-full">
                      New request
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </Card>
  );
});

