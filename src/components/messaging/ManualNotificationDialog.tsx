import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info, Mail, MapPin, MessageSquare, Send, User, Users } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';

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
  getNotificationCatalogue,
  type ManualNotificationChannel,
  type ManualNotificationPreviewResult,
  type ManualNotificationRecipient,
  type ManualNotificationType,
  type NotificationCatalogueItem,
  type NotificationRecipientPerson,
  previewManualNotification,
  sendManualNotification,
} from '@/services/messaging';

const RECIPIENT_OPTIONS: ReadonlyArray<{
  value: ManualNotificationRecipient;
  label: string;
  icon: ReactNode;
}> = [
  { value: 'client', label: 'Client', icon: <User className="h-4 w-4" /> },
  { value: 'rep', label: 'Sales rep', icon: <Users className="h-4 w-4" /> },
  { value: 'photographer', label: 'Photographer', icon: <Users className="h-4 w-4" /> },
];

const FALLBACK_TYPE_LABELS: Record<string, string> = {
  shoot_scheduled: 'Shoot scheduled',
  shoot_on_hold: 'Shoot on hold',
  shoot_cancelled: 'Shoot cancelled',
  shoot_ready: 'Shoot ready',
  shoot_updated: 'Shoot Updated',
  shoot_delivered: 'Shoot Delivered',
  payment_due: 'Payment due',
  payment_receipt: 'Payment receipt',
};

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
    <div className={cn('inline-flex w-full rounded-lg border bg-muted/40 p-1', options.length > 2 && 'flex-col')}>
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
 *   2. Pick the client or staff recipient (including assigned photographers for holds).
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

  const catalogueQuery = useQuery({
    queryKey: ['manual-notification', 'catalogue', shootId],
    queryFn: () => getNotificationCatalogue(shootId),
    enabled: open && Number.isFinite(shootId) && shootId > 0,
    staleTime: 30_000,
  });

  const catalogueItems: NotificationCatalogueItem[] = catalogueQuery.data?.notifications ?? [];
  const selectedCatalogueItem = catalogueItems.find((item) => item.type === type)
    ?? catalogueItems.find((item) => (item.aliases ?? []).includes(type));

  const recipientOptions = RECIPIENT_OPTIONS.filter((option) =>
    (selectedCatalogueItem?.recipients ?? ['client', 'photographer', 'rep']).includes(option.value),
  );
  const channelOptions = CHANNEL_OPTIONS.filter((option) =>
    (selectedCatalogueItem?.channels ?? ['email', 'sms']).includes(option.value),
  );

  const typeLabel = selectedCatalogueItem?.label
    ?? FALLBACK_TYPE_LABELS[type]
    ?? type.replace(/_/g, ' ');

  // Seed selection from catalogue when the dialog opens / catalogue loads.
  useEffect(() => {
    if (!open) return;
    const items = catalogueQuery.data?.notifications ?? [];
    if (items.length === 0) return;
    const preferred = items.find((item) => item.available) ?? items[0];
    setType((current) => (
      items.some((item) => item.type === current || (item.aliases ?? []).includes(current))
        ? current
        : preferred.type
    ));
  }, [open, catalogueQuery.data]);

  useEffect(() => {
    if (!selectedCatalogueItem) return;
    if (!selectedCatalogueItem.recipients.includes(recipientType)) {
      setRecipientType(selectedCatalogueItem.recipients[0] ?? 'client');
    }
    if (!selectedCatalogueItem.channels.includes(channel)) {
      setChannel(selectedCatalogueItem.channels[0] ?? 'email');
    }
  }, [selectedCatalogueItem, recipientType, channel]);

  const catalogueBlocksType = Boolean(selectedCatalogueItem && selectedCatalogueItem.available === false);

  // Each channel uses its own template, so changing channels must refresh the preview.
  const previewQuery = useQuery<ManualNotificationPreviewResult>({
    queryKey: ['manual-notification', 'preview', shootId, type, recipientType, channel],
    queryFn: () =>
      previewManualNotification({
        shoot_id: shootId,
        type,
        recipient_type: recipientType,
        channel,
      }),
    enabled: open && Number.isFinite(shootId) && shootId > 0 && !catalogueBlocksType,
    refetchOnWindowFocus: false,
    placeholderData: undefined,
  });

  // The preview uses the same type-specific routing as send. Do not substitute the
  // generic assignment roster, which can include a superseded primary photographer.
  const listedRecipients: NotificationRecipientPerson[] = useMemo(
    () => previewQuery.isFetching || previewQuery.isError
      ? []
      : (previewQuery.data?.recipients ?? []).filter((row) => row.recipient_type === recipientType),
    [previewQuery.data, previewQuery.isFetching, previewQuery.isError, recipientType],
  );
  const assignedPhotographers = listedRecipients.filter((row) => row.recipient_type === 'photographer');

  const sendMutation = useMutation({
    mutationFn: () =>
      sendManualNotification({
        shoot_id: shootId,
        type,
        recipient_type: recipientType,
        channel,
      }),
    onSuccess: (result) => {
      const status = String(result.status || '').toUpperCase();
      if (['BLOCKED', 'FAILED', 'PARTIAL'].includes(status)) {
        toast.error(result.message || (status === 'PARTIAL' ? 'Some notifications were not sent.' : 'Notification was not sent.'));
        return;
      }
      const description = `${typeLabel} for ${recipientType} via ${(result.channel || channel).toUpperCase()}.`;
      if (['QUEUED', 'PENDING'].includes(status)) {
        toast.info('Notification queued', { description });
      } else if (['SENT', 'DELIVERED'].includes(status)) {
        toast.success('Notification sent', { description });
      } else {
        toast.info('Notification submitted', { description: `${description} Delivery has not been confirmed.` });
      }
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
  const missingRequired = useMemo(
    () => previewQuery.data?.missing_required ?? [],
    [previewQuery.data],
  );
  const hasMissingVariables = missingVariables.length > 0;
  const hasMissingRequired = missingRequired.length > 0;
  const previewBlocksSend = previewQuery.data?.can_send === false
    || Boolean(previewQuery.data?.block_reason)
    || hasMissingRequired;
  const catalogueBlockReason = selectedCatalogueItem?.block_reason ?? null;
  const previewBlockReason = previewQuery.data?.block_reason ?? null;
  const dashboardLink = previewQuery.data?.dashboard_link
    ?? catalogueQuery.data?.dashboard_link
    ?? null;

  const isPreviewLoading = previewQuery.isFetching || catalogueQuery.isFetching;
  const isPreviewError = previewQuery.isError || catalogueQuery.isError;
  const isSending = sendMutation.isPending;
  const canSend = !isPreviewLoading
    && !isPreviewError
    && !isSending
    && !catalogueBlocksType
    && !previewBlocksSend;

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
                onValueChange={(next) => {
                  const nextItem = catalogueItems.find((item) => item.type === next)
                    ?? catalogueItems.find((item) => (item.aliases ?? []).includes(next));
                  const allowed = nextItem?.recipients ?? ['client', 'photographer', 'rep'];
                  setType(next);
                  // Sync reset so preview never fires with a disallowed pair (e.g. scheduled+rep).
                  if (!allowed.includes(recipientType)) {
                    setRecipientType(allowed[0] ?? 'client');
                  }
                  if (nextItem && !nextItem.channels.includes(channel)) {
                    setChannel(nextItem.channels[0] ?? 'email');
                  }
                }}
                disabled={isSending}
              >
                <SelectTrigger id="manual-notification-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {(catalogueItems.length > 0 ? catalogueItems : Object.keys(FALLBACK_TYPE_LABELS).map((typeName) => ({
                    type: typeName,
                    label: FALLBACK_TYPE_LABELS[typeName],
                    recipients: ['client', 'photographer', 'rep'] as ManualNotificationRecipient[],
                    channels: ['email', 'sms'] as ManualNotificationChannel[],
                    available: true,
                  }))).map((option) => (
                    <SelectItem key={option.type} value={option.type} disabled={option.available === false}>
                      {option.label}{option.available === false ? ' (unavailable)' : ''}
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
                options={recipientOptions}
                value={recipientType}
                onChange={(next) => setRecipientType(next)}
                disabled={isSending}
              />
              {listedRecipients.length > 0 && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground" data-testid="manual-notification-recipients">
                  <p className="mb-1 font-medium text-foreground">
                    {recipientType === 'photographer'
                      ? (assignedPhotographers.length === 1 ? 'Assigned photographer' : 'Assigned photographers')
                      : recipientType === 'rep' ? 'Assigned sales rep' : 'Recipient'}
                  </p>
                  <ul className="space-y-0.5">
                    {listedRecipients.map((person) => (
                      <li key={`${person.recipient_type}-${person.id}`}>
                        {person.name}
                        {person.email ? ` · ${person.email}` : ''}
                        {person.phone && !person.email ? ` · ${person.phone}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Channel
              </Label>
              <SegmentedControl
                options={channelOptions.length > 0 ? channelOptions : CHANNEL_OPTIONS}
                value={channel}
                onChange={(next) => setChannel(next)}
                disabled={isSending}
              />
            </div>

            {(catalogueBlockReason || previewBlockReason || hasMissingRequired) && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3" data-testid="manual-notification-block">
                <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Cannot send this notification
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {previewBlockReason || catalogueBlockReason || 'Required shoot context is missing.'}
                </p>
                {hasMissingRequired && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {missingRequired.map((variable) => (
                      <Badge key={variable} variant="outline" className="border-destructive/40 text-destructive">
                        {prettyVariable(variable)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {dashboardLink && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground" data-testid="manual-notification-dashboard-link">
                Dashboard link: <span className="break-all text-foreground">{dashboardLink}</span>
              </div>
            )}

            {hasMissingVariables && !isPreviewLoading && !isPreviewError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <Info className="h-4 w-4 shrink-0" />
                  Required details are missing
                </div>
                <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">
                  Complete these details before sending this notification.
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
                {typeLabel} · {recipientLabel}
              </Badge>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              {isPreviewLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4" />
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
                <Loader2 aria-hidden="true" className="h-4 w-4" />
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
