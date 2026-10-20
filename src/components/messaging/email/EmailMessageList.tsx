import { usePaginationScrollReset } from '@/hooks/usePaginationScrollReset';
import { PageSearch } from '@/components/search/PageSearch';
import { pageSearchResults } from '@/components/search/pageSearchResults';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, RefreshCw, Mail, Clock, Send, AlertCircle, Filter, ChevronDown, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import type { Message } from '@/types/messaging';
import { useAuth } from '@/components/auth/AuthProvider';

const FILTER_OPTIONS = [
  { value: null, label: 'All Messages' },
  { value: 'SENT', label: 'Sent' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'BOUNCED', label: 'Bounced' },
  { value: 'COMPLAINED', label: 'Spam complaint' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

interface EmailMessageListProps {
  messages: Message[];
  isLoading: boolean;
  selectedMessage: Message | null;
  onSelectMessage: (message: Message) => void;
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: string | null) => void;
  onRefresh: () => void;
  searchValue: string;
  statusFilter: string | null;
  page: number;
  lastPage: number;
  total: number;
  onPageChange: (page: number) => void;
  isError: boolean;
}

const statusIcons = {
  SENT: Send,
  SCHEDULED: Clock,
  FAILED: AlertCircle,
  QUEUED: Clock,
  DELIVERED: Send,
  CANCELLED: AlertCircle,
  BOUNCED: AlertCircle,
  COMPLAINED: AlertCircle,
};

const statusColors = {
  SENT: 'text-green-600',
  SCHEDULED: 'text-blue-600',
  FAILED: 'text-red-600',
  QUEUED: 'text-yellow-600',
  DELIVERED: 'text-green-600',
  CANCELLED: 'text-gray-600',
  BOUNCED: 'text-red-600',
  COMPLAINED: 'text-red-600',
};

const contextLabels = {
  new_shoot: 'New Shoot',
  previous_shoot: 'Previous Shoot',
} as const;

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'MMM d');
  }
}

export function EmailMessageList({
  messages,
  isLoading,
  selectedMessage,
  onSelectMessage,
  onSearchChange,
  onStatusFilterChange,
  onRefresh,
  searchValue,
  statusFilter: filterStatus,
  page,
  lastPage,
  total,
  onPageChange,
  isError,
}: EmailMessageListProps) {
  const { role, user } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchValue);
  };

  const handleFilterChange = (status: string | null) => {
    onStatusFilterChange(status);
  };

  const activeFilterLabel = FILTER_OPTIONS.find((o) => o.value === filterStatus)?.label || 'All Messages';

  const paginationListRef = usePaginationScrollReset(page, { isLoading });
  return (
    <>
      {/* Compact Single-Row Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <form data-page-search-container onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <PageSearch scope="email" onResultOpen={result => { const message = messages.find(row => String(row.id) === result.id); if (message) onSelectMessage(message); }} scopeLabel="Email inbox" searchId="email" priority={20} filters={{ status: filterStatus }} searchLoading={isLoading} searchError={isError} searchResults={pageSearchResults(messages, 'email', '/messaging/email/inbox?message={id}')}
              placeholder="Search messages..."
              aria-label="Search email messages"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 pr-9 h-9"
            />
            {searchValue && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9" aria-label="Clear email search" onClick={() => onSearchChange('')}><X className="h-4 w-4" /></Button>}
          </form>
          
          {/* Filter Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={filterStatus ? 'secondary' : 'outline'} 
                size="sm" 
                className="h-9 gap-1"
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">{activeFilterLabel}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value ?? 'all'}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-muted',
                    filterStatus === option.value && 'bg-muted'
                  )}
                  onClick={() => handleFilterChange(option.value)}
                >
                  {option.label}
                  {filterStatus === option.value && <Check className="h-4 w-4" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Refresh email messages" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Message List */}
      <div ref={paginationListRef} data-pagination-list className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] sm:pb-0">
        {isLoading ? (
          <div role="status" aria-label="Loading email messages">
            {[...Array(5)].map((_, index) => <div key={index} className="p-4 border-b border-border"><Skeleton className="h-16 w-full" /></div>)}
          </div>
        ) : isError ? (
          <div role="alert" className="p-6 text-center text-sm">Messages could not be loaded. <Button variant="link" onClick={onRefresh}>Retry</Button></div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center space-y-2">

              <EmptyState icon={searchValue.trim() || filterStatus ? 'search' : 'email'} title={searchValue.trim() || filterStatus ? 'No matching messages' : 'No messages yet'} size="compact" />
              <p className="text-sm">{searchValue.trim() || filterStatus ? 'Try another search or status filter.' : 'Try sending your first message'}</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const StatusIcon = statusIcons[message.status] || Mail;
            const isSelected = selectedMessage?.id === message.id;
            const isUnread = Boolean(
              user?.id
              && message.thread?.unread_for_user_ids_json?.some((id) => Number(id) === Number(user.id)),
            );
            const senderLabel = message.sender_display_name
              ? message.sender_display_name
              : message.direction === 'OUTBOUND'
                ? message.to_address
                : message.from_address;

            return (
              <div
                key={message.id}
                className={cn(
                  'p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors',
                  isSelected && 'bg-muted',
                  isUnread && !isSelected && 'bg-primary/[0.035]',
                )}
                onClick={() => onSelectMessage(message)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <StatusIcon className={cn('h-4 w-4', statusColors[message.status])} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('truncate', isUnread ? 'font-semibold' : 'font-medium')}>
                        {isUnread && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                        {senderLabel}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatMessageTime(message.created_at)}
                      </span>
                    </div>

                    <div className="font-medium text-sm truncate">{message.subject || '(No Subject)'}</div>

                    <div className="text-sm text-muted-foreground truncate">
                      {message.body_text?.substring(0, 100) || '(No content)'}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {message.direction === 'OUTBOUND' && message.provider !== 'INTERNAL' && (
                        <span className="text-xs text-muted-foreground capitalize">{message.status.toLowerCase()}</span>
                      )}
                      {Number(message.metadata?.open_count) > 0 && <span className="text-xs text-muted-foreground">Opened {Number(message.metadata?.open_count)}×</span>}
                      {Number(message.metadata?.click_count) > 0 && <span className="text-xs text-muted-foreground">Clicked {Number(message.metadata?.click_count)}×</span>}
                      {message.template && (
                        <Badge variant="outline" className="text-xs">
                          {message.template.name}
                        </Badge>
                      )}
                      {message.send_source === 'AUTOMATION' && (
                        <Badge variant="secondary" className="text-xs">
                          Auto
                        </Badge>
                      )}
                      {message.related_shoot_id && (
                        <Badge variant="outline" className="text-xs">
                          Shoot #{message.related_shoot_id}
                        </Badge>
                      )}
                      {message.related_shoot_context_type && (
                        <Badge variant="secondary" className="text-xs">
                          {contextLabels[message.related_shoot_context_type]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {!isLoading && !isError && total > 0 && <nav aria-label="Email message pages" className="flex shrink-0 items-center justify-between gap-2 border-t p-3 text-xs">
        <span>Page {page} of {lastPage} · {total} messages</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      </nav>}
    </>
  );
}
