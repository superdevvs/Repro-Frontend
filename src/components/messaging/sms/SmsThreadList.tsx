import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Plus, RefreshCcw, Search, MoreHorizontal, X } from 'lucide-react';
import { getSmsGroups } from '@/services/messaging';
import { SmsThreadListItem } from './SmsThreadListItem';
import type { PaginatedResponseMeta, SmsInboxScope, SmsThreadFilter, SmsThreadSummary } from '@/types/messaging';
import { SmsThreadFilterTabs } from './SmsThreadListTabs';

interface SmsThreadListProps {
  threads: SmsThreadSummary[];
  activeThreadId?: string;
  filter: SmsThreadFilter;
  onFilterChange: (filter: SmsThreadFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectThread: (threadId: string) => void;
  onRefresh: () => void;
  onCompose: () => void;
  isRefreshing?: boolean;
  scope?: SmsInboxScope;
  canViewSystem?: boolean;
  onScopeChange?: (scope: SmsInboxScope) => void;
  meta?: PaginatedResponseMeta;
  onPageChange?: (page: number) => void;
  error?: boolean;
}

export const SmsThreadList = ({
  threads,
  activeThreadId,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  onSelectThread,
  onRefresh,
  onCompose,
  isRefreshing,
  scope = 'inbox',
  canViewSystem = false,
  onScopeChange,
  meta,
  onPageChange,
  error,
}: SmsThreadListProps) => {
  const groupsQuery = useQuery({
    queryKey: ['sms-groups'],
    queryFn: getSmsGroups,
    staleTime: 60_000,
  });

  const enrichedThreads = useMemo(() => {
    const groups = groupsQuery.data ?? [];
    if (!groups.length) return threads;
    const byId = new Map(groups.map((group) => [String(group.id), group]));
    return threads.map((thread) => {
      if (!thread.group?.id) return thread;
      if (thread.group.members && thread.group.members.length > 0) return thread;
      const record = byId.get(String(thread.group.id));
      if (!record?.members?.length) return thread;
      return {
        ...thread,
        group: {
          ...thread.group,
          memberCount: thread.group.memberCount || record.member_count || record.members.length,
          members: record.members.map((member) => ({
            id: member.id ?? member.user_id ?? 0,
            name: member.name,
            phone: member.phone,
          })),
        },
      };
    });
  }, [threads, groupsQuery.data]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background lg:border-r lg:border-border/70">
      <div className="border-b border-border/70 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight">{scope === 'system' ? 'System SMS' : 'Inbox'}</p>
            <p className="text-xs text-muted-foreground">{scope === 'system' ? 'Automated messages without replies' : 'Replies and staff conversations'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <Button
              type="button"
              size="icon"
              onClick={onCompose}
              title="Send new message"
              aria-label="Send new message"
              className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isRefreshing} title="Refresh conversations" className="h-10 w-10 rounded-full">
              {isRefreshing ? <InlineSpinner aria-hidden="true" className="h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Conversation actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onCompose}>Send new message</DropdownMenuItem>
                <DropdownMenuItem onClick={onRefresh}>Refresh list</DropdownMenuItem>
                {canViewSystem && <DropdownMenuItem onClick={() => onScopeChange?.(scope === 'system' ? 'inbox' : 'system')}>
                  {scope === 'system' ? 'Back to inbox' : 'System SMS'}
                </DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {scope === 'system' ? (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => onScopeChange?.('inbox')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to inbox
          </Button>
        ) : <SmsThreadFilterTabs value={filter} onValueChange={onFilterChange} />}

        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              placeholder="Search name, phone, or message..."
              aria-label="Search SMS"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            {search && <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-9" aria-label="Clear SMS search" onClick={() => onSearchChange('')}>
              <X className="h-4 w-4" />
            </Button>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error ? <div role="alert" className="p-4 text-sm">Could not load conversations. <Button variant="link" onClick={onRefresh}>Retry</Button></div> : threads.length === 0 ? (
          <EmptyState icon="conversations" title={isRefreshing ? 'Loading conversations…' : search.trim() ? 'No matching conversations.' : scope === 'system' ? 'No system messages.' : 'No conversations yet.'} size="compact" />
        ) : (
          enrichedThreads.map((thread) => (
            <SmsThreadListItem
              key={thread.id}
              thread={thread}
              active={activeThreadId === thread.id}
              onSelect={() => onSelectThread(thread.id)}
            />
          ))
        )}
      </div>
      {!!meta?.last_page && meta.last_page > 1 && <div className="flex shrink-0 items-center justify-between gap-2 border-t p-3">
        <Button variant="outline" size="sm" disabled={isRefreshing || (meta.current_page ?? 1) <= 1} onClick={() => onPageChange?.((meta.current_page ?? 1) - 1)}>Previous</Button>
        <span className="text-xs text-muted-foreground">Page {meta.current_page ?? 1} of {meta.last_page}</span>
        <Button variant="outline" size="sm" disabled={isRefreshing || (meta.current_page ?? 1) >= meta.last_page} onClick={() => onPageChange?.((meta.current_page ?? 1) + 1)}>Next</Button>
      </div>}
    </div>
  );
};
