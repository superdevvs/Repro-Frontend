import { useState } from 'react';
import { Search, RefreshCw, Filter, Mail, Clock, Send, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import type { Message } from '@/types/messaging';

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

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            Inbox {messages.length > 0 && `(${messages.length})`}
          </h3>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </form>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterStatus === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange(null)}
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'SENT' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('SENT')}
          >
            Sent
          </Button>
          <Button
            variant={filterStatus === 'SCHEDULED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('SCHEDULED')}
          >
            Scheduled
          </Button>
          <Button
            variant={filterStatus === 'FAILED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('FAILED')}
          >
            Failed
          </Button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center space-y-2">
              <Mail className="h-12 w-12 mx-auto opacity-20" />
              <p>No messages yet</p>
              <p className="text-sm">Try sending your first email</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const StatusIcon = statusIcons[message.status] || Mail;
            const isSelected = selectedMessage?.id === message.id;

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
                        {message.direction === 'OUTBOUND' ? message.to_address : message.from_address}
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

