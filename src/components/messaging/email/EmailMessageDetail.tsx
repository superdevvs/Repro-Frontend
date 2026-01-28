import { useState } from 'react';
import { X, Reply, Archive, MoreVertical, Download, Printer, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { retryEmail, cancelEmail } from '@/services/messaging';
import type { Message } from '@/types/messaging';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface EmailMessageDetailProps {
  message: Message;
  onClose: () => void;
  onRefresh: () => void;
}

const statusIcons = {
  SENT: CheckCircle,
  SCHEDULED: Clock,
  FAILED: XCircle,
  QUEUED: Clock,
  DELIVERED: CheckCircle,
  CANCELLED: XCircle,
};

const statusLabels = {
  SENT: 'Sent',
  SCHEDULED: 'Scheduled',
  FAILED: 'Failed',
  QUEUED: 'Queued',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const statusColors = {
  SENT: 'bg-green-100 text-green-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  FAILED: 'bg-red-100 text-red-800',
  QUEUED: 'bg-yellow-100 text-yellow-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

export function EmailMessageDetail({ message, onClose, onRefresh }: EmailMessageDetailProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';

  const StatusIcon = statusIcons[message.status];
  const senderLabel = message.sender_display_name || message.from_address;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryEmail(message.id);
      toast.success('Message resent successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend message');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCancel = async () => {
    if (message.status !== 'SCHEDULED') {
      toast.error('Can only cancel scheduled messages');
      return;
    }

    setIsCancelling(true);
    try {
      await cancelEmail(message.id);
      toast.success('Message cancelled successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel message');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <StatusIcon className="h-5 w-5" />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Printer className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAdmin && message.status === 'FAILED' && (
                <DropdownMenuItem onClick={handleRetry} disabled={isRetrying}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Send
                </DropdownMenuItem>
              )}
              {isAdmin && message.status === 'SCHEDULED' && (
                <DropdownMenuItem onClick={handleCancel} disabled={isCancelling}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Export
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Status Badge */}
        <Badge className={statusColors[message.status]}>
          {statusLabels[message.status]}
        </Badge>

        {/* Subject */}
        <div>
          <h2 className="text-2xl font-bold">{message.subject || '(No Subject)'}</h2>
        </div>

        {/* Meta */}
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground w-20">Sender:</span>
            <span>{senderLabel}</span>
            {message.sender_role && (
              <Badge variant="outline" className="ml-2 text-xs">
                {message.sender_role}
              </Badge>
            )}
          </div>
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground w-20">From:</span>
            <span>{message.from_address}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground w-20">To:</span>
            <span>{message.to_address}</span>
          </div>
          {message.reply_to_email && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-20">Reply-To:</span>
              <span>{message.reply_to_email}</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground w-20">Date:</span>
            <span>{format(new Date(message.created_at), 'PPpp')}</span>
          </div>
          {message.scheduled_at && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-20">Scheduled:</span>
              <span>{format(new Date(message.scheduled_at), 'PPpp')}</span>
            </div>
          )}
          {message.channel_config && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-20">Channel:</span>
              <span>{message.channel_config.display_name}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Body */}
        <div className="prose prose-sm max-w-none">
          {message.body_html ? (
            <div dangerouslySetInnerHTML={{ __html: message.body_html }} />
          ) : (
            <pre className="whitespace-pre-wrap font-sans">{message.body_text}</pre>
          )}
        </div>

        {/* Attachments */}
        {message.attachments_json && message.attachments_json.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="font-semibold">Attachments</h3>
              <div className="space-y-2">
                {message.attachments_json.map((attachment, idx) => (
                  <Card key={idx} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <span className="text-xs font-mono">
                          {attachment.type.split('/')[1]?.toUpperCase() || 'FILE'}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-sm">{attachment.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(attachment.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={attachment.url} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Related Context */}
        {(message.related_shoot_id || message.related_invoice_id || message.template) && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="font-semibold">Related</h3>
              <div className="flex gap-2 flex-wrap">
                {message.related_shoot_id && (
                  <Badge variant="outline">Shoot #{message.related_shoot_id}</Badge>
                )}
                {message.related_invoice_id && (
                  <Badge variant="outline">Invoice #{message.related_invoice_id}</Badge>
                )}
                {message.template && (
                  <Badge variant="outline">{message.template.name}</Badge>
                )}
              </div>
            </div>
          </>
        )}

        {/* Error */}
        {message.status === 'FAILED' && message.error_message && (
          <>
            <Separator />
            <Card className="p-4 bg-red-50 border-red-200">
              <h3 className="font-semibold text-red-800 mb-2">Error Details</h3>
              <p className="text-sm text-red-700">{message.error_message}</p>
            </Card>
          </>
        )}
      </div>

      {/* Reply Section */}
      {isAdmin && (
        <div className="p-4 border-t border-border">
          <Button className="w-full">
            <Reply className="mr-2 h-4 w-4" />
            Reply
          </Button>
        </div>
      )}
    </div>
  );
}

