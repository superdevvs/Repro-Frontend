import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/sonner-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  listClientConfirmationRecoveries,
  replayClientConfirmations,
  type ClientConfirmationDelivery,
  type RecoveryStatus,
} from '@/services/clientConfirmationRecoveryService';

const STATUS_TABS: Array<{ value: RecoveryStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'sent', label: 'Sent' },
];

const REASON_LABEL: Record<string, string> = {
  missing_email: 'Client has no email',
  no_delivery_path: 'No delivery path resolved',
  provider_error: 'Provider returned an error',
};

const SOURCE_LABEL: Record<string, string> = {
  automation: 'Automation',
  fallback: 'Blade fallback',
  replay: 'Manual replay',
};

const getRecoveryErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object') {
    const response = 'response' in error
      ? (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response
      : undefined;
    const responseError = response?.data?.error;
    if (typeof responseError === 'string' && responseError) return responseError;
    const responseMessage = response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage) return responseMessage;
    const message = 'message' in error ? (error as { message?: unknown }).message : undefined;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
};

const formatDate = (value: string | null): string => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const formatShootAddress = (delivery: ClientConfirmationDelivery): string => {
  const shoot = delivery.shoot;
  if (!shoot) return 'Shoot deleted';
  const parts = [shoot.address, shoot.city, shoot.state, shoot.zip]
    .map((p) => (p ?? '').toString().trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : `Shoot #${shoot.id}`;
};

const StatusBadge = ({ status }: { status: RecoveryStatus }) => {
  if (status === 'sent') {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Sent
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge className="border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
        <XCircle className="mr-1 h-3 w-3" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <ShieldAlert className="mr-1 h-3 w-3" />
      Skipped
    </Badge>
  );
};

export default function EmailRecovery() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<RecoveryStatus | 'all'>('failed');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['client-confirmation-recovery', statusFilter, page],
    queryFn: () =>
      listClientConfirmationRecoveries({
        status: statusFilter === 'all' ? undefined : statusFilter,
        per_page: 25,
        page,
      }),
    placeholderData: (prev) => prev,
  });

  const deliveries = data?.data ?? [];

  const replayableSelected = useMemo(() => {
    return deliveries.filter((delivery) => {
      if (!selected.has(delivery.id)) return false;
      if (delivery.status === 'sent') return false;
      if (!delivery.shoot) return false;
      if (!delivery.client?.email) return false;
      return true;
    });
  }, [deliveries, selected]);

  const allRowsSelected = deliveries.length > 0
    && deliveries.every((delivery) => selected.has(delivery.id));

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(deliveries.map((delivery) => delivery.id)));
  };

  const toggleRow = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const replayMutation = useMutation({
    mutationFn: replayClientConfirmations,
    onSuccess: (result) => {
      const replayedCount = result.replayed.length;
      const rejectedCount = result.rejected.length;

      if (replayedCount > 0 && rejectedCount === 0) {
        toast.success(`Replayed ${replayedCount} confirmation${replayedCount === 1 ? '' : 's'}.`);
      } else if (replayedCount > 0) {
        toast.warning(
          `Replayed ${replayedCount}, but ${rejectedCount} could not be replayed.`,
          {
            description: result.rejected
              .map((entry) => `#${entry.delivery_id}: ${entry.reason}`)
              .join('\n'),
          }
        );
      } else {
        toast.error('No confirmations were replayed.', {
          description: result.rejected
            .map((entry) => `#${entry.delivery_id}: ${entry.reason}`)
            .join('\n'),
        });
      }

      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ['client-confirmation-recovery'] });
    },
    onError: (error: unknown) => {
      toast.error(getRecoveryErrorMessage(error, 'Failed to replay client confirmations.'));
    },
  });

  const runReplay = () => {
    if (replayableSelected.length === 0) {
      toast.warning('Select at least one eligible failed/skipped row to replay.');
      return;
    }

    replayMutation.mutate(replayableSelected.map((delivery) => delivery.id));
  };

  const summary = useMemo(() => {
    const counts = { failed: 0, skipped: 0, sent: 0 };
    deliveries.forEach((delivery) => {
      counts[delivery.status] = (counts[delivery.status] ?? 0) + 1;
    });
    return counts;
  }, [deliveries]);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full min-h-screen bg-background">
        <EmailNavigation />
        <div className="flex-1 px-3 sm:px-6 py-4 sm:py-6 overflow-y-auto">
          <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                  Client Confirmation Recovery
                </h1>
                <p className="text-sm text-muted-foreground">
                  Audit failed or skipped <code className="rounded bg-muted px-1 text-xs">SHOOT_SCHEDULED</code>{' '}
                  client confirmations and replay them after fixing the cause.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCcw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={runReplay}
                  disabled={replayableSelected.length === 0 || replayMutation.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Replay {replayableSelected.length > 0 ? `(${replayableSelected.length})` : 'selected'}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Failed (this page)
                    </p>
                    <p className="text-2xl font-semibold">{summary.failed}</p>
                  </div>
                  <XCircle className="h-7 w-7 text-rose-500" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Skipped (this page)
                    </p>
                    <p className="text-2xl font-semibold">{summary.skipped}</p>
                  </div>
                  <ShieldAlert className="h-7 w-7 text-amber-500" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Sent total (filter)
                    </p>
                    <p className="text-2xl font-semibold">{data?.total ?? 0}</p>
                  </div>
                  <Mail className="h-7 w-7 text-sky-500" />
                </div>
              </Card>
            </div>

            <Card className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Tabs
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as RecoveryStatus | 'all');
                    setPage(1);
                    setSelected(new Set());
                  }}
                >
                  <TabsList>
                    {STATUS_TABS.map((tab) => (
                      <TabsTrigger key={tab.value} value={tab.value} className="capitalize">
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground">
                  {data?.total ?? 0} total · page {data?.current_page ?? 1} of {data?.last_page ?? 1}
                </p>
              </div>

              <div className="mt-4 overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          aria-label="Select all rows"
                          checked={allRowsSelected}
                          onCheckedChange={(checked) => toggleAll(checked === true)}
                        />
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Shoot</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Reason / Error</TableHead>
                      <TableHead>Last attempt</TableHead>
                      <TableHead className="text-right">Attempts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && deliveries.length === 0 ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <TableRow key={`skeleton-${idx}`}>
                          <TableCell colSpan={8}>
                            <Skeleton className="h-6 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : deliveries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                            <p>No deliveries match this filter — you're all caught up.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      deliveries.map((delivery) => {
                        const isSelected = selected.has(delivery.id);
                        const reasonText = delivery.reason_code
                          ? REASON_LABEL[delivery.reason_code] ?? delivery.reason_code
                          : null;
                        const eligibilityBlocker = !delivery.shoot
                          ? 'Original shoot was deleted'
                          : !delivery.client?.email
                            ? 'Client has no deliverable email'
                            : delivery.status === 'sent'
                              ? 'Already sent'
                              : null;

                        return (
                          <TableRow
                            key={delivery.id}
                            className={isSelected ? 'bg-primary/5' : undefined}
                          >
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Checkbox
                                        aria-label={`Select delivery ${delivery.id}`}
                                        checked={isSelected}
                                        disabled={Boolean(eligibilityBlocker)}
                                        onCheckedChange={(checked) =>
                                          toggleRow(delivery.id, checked === true)
                                        }
                                      />
                                    </span>
                                  </TooltipTrigger>
                                  {eligibilityBlocker && (
                                    <TooltipContent>{eligibilityBlocker}</TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={delivery.status} />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="text-sm font-medium">
                                  {delivery.shoot ? `#${delivery.shoot.id}` : '—'}{' '}
                                  <span className="text-muted-foreground font-normal">
                                    {delivery.shoot?.workflow_status ?? delivery.shoot?.status ?? ''}
                                  </span>
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {formatShootAddress(delivery)}
                                </p>
                                {delivery.shoot?.scheduled_at && (
                                  <p className="text-xs text-muted-foreground">
                                    <Clock className="inline-block h-3 w-3 mr-1" />
                                    {formatDate(delivery.shoot.scheduled_at)}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium">
                                  {delivery.client?.name ?? '—'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {delivery.client?.email ?? (
                                    <span className="text-rose-500">no email on file</span>
                                  )}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {SOURCE_LABEL[delivery.source] ?? delivery.source}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              {reasonText && (
                                <p className="text-sm font-medium">{reasonText}</p>
                              )}
                              {delivery.last_error_message && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {delivery.last_error_message}
                                </p>
                              )}
                              {!reasonText && !delivery.last_error_message && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatDate(delivery.last_attempted_at)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {delivery.attempt_count}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <p>
                  Showing {data?.from ?? 0}–{data?.to ?? 0} of {data?.total ?? 0}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(data?.current_page ?? 1) <= 1 || isFetching}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      !data || data.current_page >= data.last_page || isFetching
                    }
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Before replaying</p>
                  <ul className="list-disc list-inside text-xs space-y-0.5">
                    <li>Make sure the client has a working email address — rows missing one are disabled.</li>
                    <li>Replays send the standard shoot scheduled blade template via Cakemail.</li>
                    <li>
                      Stuck <code className="rounded bg-amber-100 dark:bg-amber-900/60 px-1">QUEUED</code> messages are
                      retried automatically every 5 minutes by the scheduler.
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
