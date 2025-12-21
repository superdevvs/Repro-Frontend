import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Check, Bell, MoreVertical, Search, Filter, X } from 'lucide-react';
import { DashboardIssueItem } from '@/types/dashboard';
import { useIssueManager } from '@/context/IssueManagerContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

type SeverityFilter = 'all' | 'high' | 'medium' | 'low';
type SortOption = 'newest' | 'oldest' | 'severity' | 'client';

export const IssueManagerModal: React.FC = () => {
  const { isOpen, issues, selectedIssueId, closeModal, selectIssue } = useIssueManager();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [resolvedIssues, setResolvedIssues] = useState<Set<number>>(new Set());

  const handleMarkResolved = (issueId: number) => {
    setResolvedIssues(prev => new Set(prev).add(issueId));
    toast({
      title: "Issue Resolved",
      description: "The issue has been marked as resolved.",
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

  const filteredAndSortedIssues = useMemo(() => {
    let filtered = issues.filter(issue => !resolvedIssues.has(issue.id));

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(issue =>
        issue.message.toLowerCase().includes(query) ||
        issue.client?.toLowerCase().includes(query) ||
        issue.status?.toLowerCase().includes(query)
      );
    }

    // Apply severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(issue => issue.severity === severityFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.updatedAt || b.id).getTime() - new Date(a.updatedAt || a.id).getTime();
        case 'oldest':
          return new Date(a.updatedAt || a.id).getTime() - new Date(b.updatedAt || b.id).getTime();
        case 'severity':
          const severityOrder = { high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        case 'client':
          return (a.client || '').localeCompare(b.client || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [issues, resolvedIssues, searchQuery, severityFilter, sortOption]);

  const selectedIssue = useMemo(() => {
    if (selectedIssueId === null) return null;
    return issues.find(issue => issue.id === selectedIssueId) || null;
  }, [issues, selectedIssueId]);

  return (
    <Dialog open={isOpen} onOpenChange={closeModal}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold">Issue Manager</DialogTitle>
          <DialogDescription>
            Manage and track all issues across your shoots
          </DialogDescription>
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
                  <SelectItem value="severity">By Severity</SelectItem>
                  <SelectItem value="client">By Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {filteredAndSortedIssues.length} of {issues.length} issues
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
            {filteredAndSortedIssues.length === 0 ? (
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
                {filteredAndSortedIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={cn(
                      'rounded-xl border p-4 bg-card hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer',
                      selectedIssueId === issue.id && 'border-primary ring-2 ring-primary/20',
                      issue.severity === 'high' 
                        ? 'border-destructive/40 bg-destructive/5 dark:bg-destructive/10' 
                        : issue.severity === 'medium'
                        ? 'border-amber-500/40 bg-amber-50/30 dark:bg-amber-500/10 dark:border-amber-500/40'
                        : 'border-border bg-card'
                    )}
                    onClick={() => selectIssue(issue.id)}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-snug break-words">
                            {issue.message}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0 whitespace-nowrap border',
                            severityBadge(issue.severity)
                          )}
                        >
                          {issue.severity}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">
                          {issue.client ? `${issue.client} • ` : ''}
                          {issue.status || 'Needs review'}
                        </span>
                        {issue.updatedAt && (
                          <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">
                            Updated {new Date(issue.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                            handleMarkResolved(issue.id);
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};



