import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RefreshCcw, Search, MoreHorizontal } from 'lucide-react';
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
  isRefreshing,
}: SmsThreadListProps) => {
  return (
    <div className="flex h-full flex-col border-r border-border/70 bg-background">
      <div className="border-b border-border/70 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Conversations</p>
            <p className="text-xs text-muted-foreground">Auto updated</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isRefreshing} title="Refresh conversations">
              <RefreshCcw className="h-4 w-4 animate-spin" hidden={!isRefreshing} />
              <RefreshCcw className="h-4 w-4" hidden={!!isRefreshing} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Conversation actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
          <div className="p-6 text-center text-sm text-muted-foreground">No conversations yet.</div>
        ) : (
          threads.map((thread) => (
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

