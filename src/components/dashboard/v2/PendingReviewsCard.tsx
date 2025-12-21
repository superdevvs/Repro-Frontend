import React, { useState } from 'react';
import { DashboardIssueItem, DashboardShootSummary } from '@/types/dashboard';
import { Card } from './SharedComponents';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIssueManager } from '@/context/IssueManagerContext';

type PendingReviewsVariant = 'reviews-with-issues' | 'reviews-only';

interface PendingReviewsCardProps {
  reviews: DashboardShootSummary[];
  issues: DashboardIssueItem[];
  onSelect: (shoot: DashboardShootSummary) => void;
  title?: string;
  variant?: PendingReviewsVariant;
  emptyReviewsText?: string;
  emptyIssuesText?: string;
}

const getReviewTag = (shoot: DashboardShootSummary) => {
  const status = (shoot.workflowStatus || '').toLowerCase();
  if (status.includes('qc')) return { label: 'QC', variant: 'warning' as const };
  if (shoot.isFlagged) return { label: 'Issue', variant: 'destructive' as const };
  return { label: 'Client', variant: 'outline' as const };
};

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

const renderReviewList = (
  reviews: DashboardShootSummary[],
  onSelect: (shoot: DashboardShootSummary) => void,
) =>
  reviews.slice(0, 5).map((review) => {
    const tag = getReviewTag(review);
    return (
      <div
        key={review.id}
        className="border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:border-primary/40 hover:bg-primary/5 transition-all bg-card"
      >
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold text-foreground break-words">{review.addressLine}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{review.clientName || 'Client TBD'}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground/70">
              Submitted{' '}
              {review.submittedForReviewAt
                ? new Date(review.submittedForReviewAt).toLocaleString()
                : '—'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Badge
              variant={tag.variant === 'outline' ? 'outline' : 'secondary'}
              className={cn(
                'rounded-full text-[10px] sm:text-[11px] font-semibold',
                tag.variant === 'warning' && 'bg-amber-100 text-amber-600 border-none',
                tag.variant === 'destructive' && 'bg-destructive text-destructive-foreground border-none',
              )}
            >
              {tag.label}
            </Badge>
            <Button variant="link" className="px-0 text-xs sm:text-sm" onClick={() => onSelect(review)}>
              Review
            </Button>
          </div>
        </div>
      </div>
    );
  });

export const PendingReviewsCard: React.FC<PendingReviewsCardProps> = ({
  reviews,
  issues,
  onSelect,
  title = 'Review',
  variant = 'reviews-with-issues',
  emptyReviewsText = 'All shoots are current. 🎉',
  emptyIssuesText = 'No open issues.',
}) => {
  const { openModal } = useIssueManager();
  const [resolvedIssues, setResolvedIssues] = useState<Set<number>>(new Set());

  const visibleIssues = issues.filter(issue => !resolvedIssues.has(issue.id));
  if (variant === 'reviews-only') {
    return (
      <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold text-foreground">{title}</h2>
        <span className="text-[10px] sm:text-xs text-muted-foreground">{reviews.length}</span>
      </div>
        {reviews.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground">{emptyReviewsText}</div>
        ) : (
          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
            {renderReviewList(reviews, onSelect)}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col p-0">
      <div className="px-3 pt-3 pb-0">
        <Tabs defaultValue="reviews" className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 flex-shrink-0">
            <h2 className="text-base sm:text-lg font-bold text-foreground">{title}</h2>
            <TabsList className="grid grid-cols-2 bg-muted/60 rounded-full w-full sm:w-auto">
              <TabsTrigger value="reviews" className="rounded-full text-[10px] sm:text-xs px-3 sm:px-4 py-1">
                Reviews <span className="ml-1 text-[10px] sm:text-[11px] text-muted-foreground">({reviews.length})</span>
              </TabsTrigger>
              <TabsTrigger value="issues" className="rounded-full text-[10px] sm:text-xs px-3 sm:px-4 py-1">
                Issues <span className="ml-1 text-[10px] sm:text-[11px] text-muted-foreground">({visibleIssues.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="reviews" className="flex-1 flex flex-col min-h-0">
            {reviews.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground px-3 pb-3">{emptyReviewsText}</div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 px-3 pb-3">
                <div className="space-y-3">
                  {renderReviewList(reviews, onSelect)}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="issues" className="flex-1 flex flex-col min-h-0">
            {visibleIssues.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground px-3 pb-3">{emptyIssuesText}</div>
            ) : (
              <div className="overflow-y-auto overflow-x-auto custom-scrollbar px-3 pb-3" style={{ maxHeight: '396px' }}>
                <div className="space-y-1.5">
                {visibleIssues.map((issue) => (
                <div
                  key={issue.id}
                  onClick={() => openModal(visibleIssues, issue.id)}
                  className={cn(
                    'rounded-lg border p-2.5 bg-card hover:border-primary/40 hover:shadow-sm transition-all w-full cursor-pointer',
                    issue.severity === 'high' 
                      ? 'border-destructive/40 bg-destructive/5 dark:bg-destructive/10' 
                      : issue.severity === 'medium'
                      ? 'border-amber-500/40 bg-amber-50/30 dark:bg-amber-500/10 dark:border-amber-500/40'
                      : 'border-border bg-card'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">
                        {issue.message}
                      </p>
                      {issue.client && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {issue.client}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 whitespace-nowrap border',
                        severityBadge(issue.severity)
                      )}
                    >
                      {issue.severity}
                    </span>
                  </div>
                </div>
                ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};

