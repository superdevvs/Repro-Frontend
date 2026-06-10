import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Send } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/sonner-toast';

import {
  MANUAL_NOTIFICATION_TYPES,
  type ManualNotificationChannel,
  type ManualNotificationPreviewResult,
  type ManualNotificationRecipient,
  type ManualNotificationType,
  previewManualNotification,
  sendManualNotification,
} from '@/services/messaging';

const TYPE_LABELS: Record<ManualNotificationType, string> = {
  shoot_scheduled: 'Shoot scheduled',
  shoot_on_hold: 'Shoot on hold',
  shoot_cancelled: 'Shoot cancelled',
  shoot_ready: 'Shoot ready',
  payment_due: 'Payment due',
  payment_receipt: 'Payment receipt',
};

const RECIPIENT_OPTIONS: ReadonlyArray<{ value: ManualNotificationRecipient; label: string }> = [
  { value: 'client', label: 'Client' },
  { value: 'photographer', label: 'Photographer' },
];

const CHANNEL_OPTIONS: ReadonlyArray<{ value: ManualNotificationChannel; label: string }> = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
];

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object') {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (data && typeof data === 'object') {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message) return message;
      const errorMsg = (data as { error?: unknown }).error;
      if (typeof errorMsg === 'string' && errorMsg) return errorMsg;
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
};

export interface ManualNotificationDialogProps {
  /** Numeric shoot id the notification concerns. */
  shootId: number;
  /** Open / closed state controlled by the parent. */
  open: boolean;
  /** Notify parent that the dialog should close. */
  onClose: () => void;
  /** Optional human-friendly identifier for the shoot, surfaced in the dialog header. */
  shootLabel?: string;
}

/**
 * `ManualNotificationDialog` (Req 12.5, 12.6, 12.7, 12.8).
 *
 * Lets an admin manually send a shoot notification:
 *   1. Pick the notification type (shoot_scheduled / on_hold / cancelled / ready /
 *      payment_due / payment_receipt) — AC 12.2.
 *   2. Pick the recipient (client | photographer) — AC 12.6.
 *   3. Pick the channel (email | sms) — AC 12.7.
 *   4. Preview the rendered subject/body before sending — AC 12.5.
 *   5. If the backend reports `missing_variables`, show a warning banner before send — AC 12.8.
 *   6. On send, dispatches via POST /messaging/notifications/manual-send and surfaces a
 *      success / error toast.
 */
export function ManualNotificationDialog({
  shootId,
  open,
  onClose,
  shootLabel,
}: ManualNotificationDialogProps) {
  const [type, setType] = useState<ManualNotificationType>('shoot_scheduled');
  const [recipientType, setRecipientType] = useState<ManualNotificationRecipient>('client');
  const [channel, setChannel] = useState<ManualNotificationChannel>('email');

  // Reset form whenever the dialog re-opens so a previous selection doesn't leak.
  useEffect(() => {
    if (open) {
      setType('shoot_scheduled');
      setRecipientType('client');
      setChannel('email');
    }
  }, [open]);

  // Preview is keyed off (shoot, type, recipient) only — channel doesn't affect the rendered
  // body, matching the backend's manual-preview contract.
  const previewQuery = useQuery<ManualNotificationPreviewResult>({
    queryKey: ['manual-notification', 'preview', shootId, type, recipientType],
    queryFn: () =>
      previewManualNotification({
        shoot_id: shootId,
        type,
        recipient_type: recipientType,
      }),
    enabled: open && Number.isFinite(shootId) && shootId > 0,
    refetchOnWindowFocus: false,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      sendManualNotification({
        shoot_id: shootId,
        type,
        recipient_type: recipientType,
        channel,
      }),
    onSuccess: (result) => {
      toast.success('Notification sent', {
        description: `${TYPE_LABELS[type]} delivered to ${recipientType} via ${result.channel.toUpperCase()}.`,
      });
      onClose();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to send notification.'));
    },
  });

  const missingVariables = useMemo(
    () => previewQuery.data?.missing_variables ?? [],
    [previewQuery.data],
  );
  const hasMissingVariables = missingVariables.length > 0;

  const isPreviewLoading = previewQuery.isFetching;
  const isPreviewError = previewQuery.isError;
  const isSending = sendMutation.isPending;
  const canSend = !isPreviewLoading && !isPreviewError && !isSending;

  const previewSubject = previewQuery.data?.subject ?? '';
  const previewBodyText = previewQuery.data?.body_text ?? '';
  const previewBodyHtml = previewQuery.data?.body_html ?? '';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Send manual notification</DialogTitle>
          <DialogDescription>
            Choose the notification type, recipient, and channel, review the preview, then send.
            {shootLabel ? ` Shoot: ${shootLabel}.` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="manual-notification-type">Type</Label>
              <Select
                value={type}
                onValueChange={(next) => setType(next as ManualNotificationType)}
                disabled={isSending}
              >
                <SelectTrigger id="manual-notification-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_NOTIFICATION_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {TYPE_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-notification-recipient">Recipient</Label>
              <Select
                value={recipientType}
                onValueChange={(next) =>
                  setRecipientType(next as ManualNotificationRecipient)
                }
                disabled={isSending}
              >
                <SelectTrigger id="manual-notification-recipient">
                  <SelectValue placeholder="Select recipient" />
                </SelectTrigger>
                <SelectContent>
                  {RECIPIENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-notification-channel">Channel</Label>
              <Select
                value={channel}
                onValueChange={(next) => setChannel(next as ManualNotificationChannel)}
                disabled={isSending}
              >
                <SelectTrigger id="manual-notification-channel">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasMissingVariables && !isPreviewLoading && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Missing template variables</AlertTitle>
              <AlertDescription>
                <p className="mb-2 text-sm">
                  The selected template has variables that did not resolve for this shoot.
                  Sending now may produce a partially populated message.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missingVariables.map((variable) => (
                    <Badge
                      key={variable}
                      variant="outline"
                      className="border-destructive/40 bg-destructive/10 text-destructive"
                    >
                      {variable}
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Preview</Label>
            {isPreviewLoading ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Rendering preview…
              </div>
            ) : isPreviewError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Preview failed</AlertTitle>
                <AlertDescription>
                  {getApiErrorMessage(previewQuery.error, 'Unable to render this template.')}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3 rounded-md border bg-muted/30 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Subject</p>
                  <p className="mt-1 text-sm font-medium">
                    {previewSubject || (
                      <span className="text-muted-foreground">(no subject)</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {channel === 'sms' ? 'Message' : 'Body'}
                  </p>
                  {channel === 'sms' || !previewBodyHtml ? (
                    <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border bg-background p-3 text-sm">
                      {previewBodyText ||
                        previewBodyHtml.replace(/<[^>]+>/g, '') ||
                        '(empty body)'}
                    </pre>
                  ) : (
                    <div
                      className="prose prose-sm dark:prose-invert mt-1 max-h-64 max-w-none overflow-auto rounded border bg-background p-3 text-sm"
                      // The backend renders templates server-side using TemplateRenderer; the
                      // resulting HTML is intended for an email body. It is shown to the admin
                      // here for review before send.
                      dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => sendMutation.mutate()}
            disabled={!canSend}
            className="gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send notification
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ManualNotificationDialog;
