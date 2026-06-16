import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info, Loader2, Mail, MapPin, MessageSquare, Send, User, Users } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/sonner-toast';
import { cn } from '@/lib/utils';

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

const RECIPIENT_OPTIONS: ReadonlyArray<{
  value: ManualNotificationRecipient;
  label: string;
  icon: ReactNode;
}> = [
  { value: 'client', label: 'Client', icon: <User className="h-4 w-4" /> },
  { value: 'photographer', label: 'Photographer', icon: <Users className="h-4 w-4" /> },
];

const CHANNEL_OPTIONS: ReadonlyArray<{
  value: ManualNotificationChannel;
  label: string;
  icon: ReactNode;
}> = [
  { value: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
  { value: 'sms', label: 'SMS', icon: <MessageSquare className="h-4 w-4" /> },
];

/** Turn a snake_case template variable into a readable label, e.g. "assigned_photographers" → "Assigned photographers". */
const prettyVariable = (name: string): string => {
  const spaced = name.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** Compact pill-style toggle for two/three mutually-exclusive options. */
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex w-full rounded-lg border bg-muted/40 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

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
  const recipientLabel =
    RECIPIENT_OPTIONS.find((option) => option.value === recipientType)?.label ?? 'Client';
  const smsText =
    previewBodyText || previewBodyHtml.replace(/<[^>]+>/g, '').trim() || '(empty message)';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1040px]">
        <DialogHeader className="space-y-0 border-b px-6 py-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Send className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg leading-tight">Notify</DialogTitle>
              <DialogDescription className="mt-0.5">
                Send a shoot notification and review it before it goes out.
              </DialogDescription>
              {shootLabel ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{shootLabel}</span>
                </div>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Left column: notification controls */}
          <div className="flex w-full flex-col gap-5 overflow-y-auto border-b p-6 md:w-[300px] md:shrink-0 md:border-b-0 md:border-r">
            <div className="space-y-2">
              <Label
                htmlFor="manual-notification-type"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Notification
              </Label>
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
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recipient
              </Label>
              <SegmentedControl
                options={RECIPIENT_OPTIONS}
                value={recipientType}
                onChange={(next) => setRecipientType(next)}
                disabled={isSending}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Channel
              </Label>
              <SegmentedControl
                options={CHANNEL_OPTIONS}
                value={channel}
                onChange={(next) => setChannel(next)}
                disabled={isSending}
              />
            </div>

            {hasMissingVariables && !isPreviewLoading && !isPreviewError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <Info className="h-4 w-4 shrink-0" />
                  Some details aren&apos;t filled in
                </div>
                <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">
                  These optional fields are empty for this shoot and will be left blank.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {missingVariables.map((variable) => (
                    <Badge
                      key={variable}
                      variant="outline"
                      className="border-amber-300 bg-amber-100/60 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    >
                      {prettyVariable(variable)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: full-height channel-aware preview */}
          <div className="flex min-h-0 flex-1 flex-col bg-muted/30">
            <div className="flex items-center justify-between gap-2 border-b bg-background/60 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {channel === 'sms' ? (
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Mail className="h-4 w-4 text-muted-foreground" />
                )}
                {channel === 'sms' ? 'SMS preview' : 'Email preview'}
              </div>
              <Badge variant="secondary" className="font-normal">
                {TYPE_LABELS[type]} · {recipientLabel}
              </Badge>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              {isPreviewLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rendering preview…
                </div>
              ) : isPreviewError ? (
                <div className="mx-auto max-w-[520px] rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Preview unavailable
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {getApiErrorMessage(previewQuery.error, 'Unable to render this template.')}
                  </p>
                </div>
              ) : channel === 'sms' ? (
                <div className="mx-auto flex max-w-[420px] flex-col items-start gap-1.5">
                  <div className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
                    {smsText}
                  </div>
                  <span className="pl-1 text-[11px] text-muted-foreground">
                    Text message to {recipientLabel.toLowerCase()}
                  </span>
                </div>
              ) : (
                <div className="mx-auto max-w-[720px] overflow-hidden rounded-xl border bg-background shadow-sm">
                  <div className="border-b bg-muted/40 px-5 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Subject
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {previewSubject || (
                        <span className="font-normal text-muted-foreground">(no subject)</span>
                      )}
                    </p>
                  </div>
                  {previewBodyHtml ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none p-5"
                      // The backend renders templates server-side using TemplateRenderer; the
                      // resulting HTML is intended for an email body. It is shown to the admin
                      // here for review before send.
                      dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap break-words p-5 text-sm">
                      {previewBodyText || '(empty body)'}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t px-6 py-4 sm:gap-2">
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
                Notify
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ManualNotificationDialog;
