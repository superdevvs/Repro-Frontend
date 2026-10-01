import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, RefreshCcw, Search, MoreHorizontal } from 'lucide-react';
import { getSmsGroups } from '@/services/messaging';
import { SmsThreadListItem } from './SmsThreadListItem';
import type { SmsThreadFilter, SmsThreadSummary } from '@/types/messaging';
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
            <p className="text-base font-semibold tracking-tight">Messages</p>
            <p className="text-xs text-muted-foreground">Auto updated</p>
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
                <DropdownMenuItem>Mark all as read</DropdownMenuItem>
                <DropdownMenuItem>Export</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <SmsThreadFilterTabs value={filter} onValueChange={onFilterChange} />

        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <EmptyState icon="conversations" title={<>No conversations yet.</>} size="compact" />
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
    </div>
  );
};
