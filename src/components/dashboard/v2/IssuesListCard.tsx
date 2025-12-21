import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Check, Bell, MoreVertical } from 'lucide-react';
import { Card } from './SharedComponents';
import { DashboardIssueItem } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useIssueManager } from '@/context/IssueManagerContext';

interface IssuesListCardProps {
  issues: DashboardIssueItem[];
  title?: string;
  emptyStateText?: string;
  maxItems?: number;
}

const severityStyles: Record<DashboardIssueItem['severity'], string> = {
  high: 'border-destructive/40 bg-destructive/10 text-destructive',
  medium: 'border-amber-300 bg-amber-50 text-amber-700',
  low: 'border-muted bg-muted/60 text-muted-foreground',
};

export const IssuesListCard: React.FC<IssuesListCardProps> = ({
  issues,
  title = 'Requests',
  emptyStateText = 'All clear. No requests logged.',
  maxItems = 4,
}) => {
  const { toast } = useToast();
  const { openModal } = useIssueManager();
  const [resolvedIssues, setResolvedIssues] = useState<Set<number>>(new Set());

  const handleMarkResolved = (issueId: number) => {
    setResolvedIssues(prev => new Set(prev).add(issueId));
    toast({
      title: "Request Resolved",
      description: "The request has been marked as resolved.",
      variant: "default",
    });
  };

  const handleNotifyConcerned = (issue: DashboardIssueItem, recipient: 'photographer' | 'editor' | 'management') => {
    const recipientName = recipient === 'photographer' ? 'Photographer' : 
                          recipient === 'editor' ? 'Editor' : 
                          'Management';
    toast({
      title: "Notification Sent",
      description: `${recipientName} has been notified about this issue.`,
      variant: "default",
    });
  };

  const visibleIssues = issues.filter(issue => !resolvedIssues.has(issue.id));

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{visibleIssues.length}</span>
      </div>
      {visibleIssues.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground">{emptyStateText}</div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">
          {visibleIssues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => openModal(visibleIssues, issue.id)}
              className={cn(
                'rounded-2xl border p-3 flex items-start gap-3 cursor-pointer hover:shadow-md transition-all',
                severityStyles[issue.severity],
              )}
            >
              <div className="mt-0.5">
                {issue.severity === 'high' ? (
                  <AlertTriangle size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{issue.message}</p>
                  <span className="text-[11px] font-semibold capitalize flex-shrink-0">{issue.severity}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {issue.client ? `${issue.client} • ` : ''}
                  {issue.status || 'Needs review'}
                </p>
                <p className="text-[11px] text-muted-foreground/70">
                  Updated{' '}
                  {issue.updatedAt
                    ? new Date(issue.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </p>
                <div 
                  className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
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
                        className="h-7 text-xs px-2"
                      >
                        <Bell className="h-3 w-3 mr-1" />
                        Notify
                        <MoreVertical className="h-3 w-3 ml-1" />
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
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

