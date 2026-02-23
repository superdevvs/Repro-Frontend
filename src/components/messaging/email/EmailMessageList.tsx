import { useState } from 'react';
import { Search, RefreshCw, Mail, Clock, Send, AlertCircle, Filter, ChevronDown, Check } from 'lucide-react';
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
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import type { Message } from '@/types/messaging';
import { useAuth } from '@/components/auth/AuthProvider';

const FILTER_OPTIONS = [
  { value: null, label: 'All Messages' },
  { value: 'SENT', label: 'Sent' },
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
}

const statusIcons = {
  SENT: Send,
  SCHEDULED: Clock,
  FAILED: AlertCircle,
  QUEUED: Clock,
  DELIVERED: Send,
  CANCELLED: AlertCircle,
};

const statusColors = {
  SENT: 'text-green-600',
  SCHEDULED: 'text-blue-600',
  FAILED: 'text-red-600',
  QUEUED: 'text-yellow-600',
  DELIVERED: 'text-green-600',
  CANCELLED: 'text-gray-600',
};

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
}: EmailMessageListProps) {
  const [searchValue, setSearchValue] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchValue);
  };

  const handleFilterChange = (status: string | null) => {
    setFilterStatus(status);
    onStatusFilterChange(status);
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-10 w-full" />
        </div>
        {[...Array(10)].map((_, i) => (
          <div key={i} className="p-4 border-b border-border">
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const activeFilterLabel = FILTER_OPTIONS.find((o) => o.value === filterStatus)?.label || 'All Messages';

  return (
    <>
      {/* Compact Single-Row Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 h-9"
            />
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

          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] sm:pb-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center space-y-2">
              <Mail className="h-12 w-12 mx-auto opacity-20" />
              <p>No messages yet</p>
              <p className="text-sm">Try sending your first message</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const StatusIcon = statusIcons[message.status] || Mail;
            const isSelected = selectedMessage?.id === message.id;
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
                  isSelected && 'bg-muted'
                )}
                onClick={() => onSelectMessage(message)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <StatusIcon className={cn('h-4 w-4', statusColors[message.status])} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">
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
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

