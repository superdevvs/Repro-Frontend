import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  Download,
  FileText,
  Loader2,
  MessageSquareMore,
  RefreshCw,
  Search,
  User2,
} from 'lucide-react';

import { PayoutReportPanel } from '@/components/accounting/PayoutReportPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  adminRejectWeeklyInvoice,
  approveWeeklyInvoice,
  fetchAdminInvoiceReviewDetail,
  fetchAdminInvoiceReviewQueue,
  type WeeklyInvoice,
  type WeeklyInvoiceReviewQueueResponse,
  type WeeklyInvoiceTimelineEvent,
} from '@/services/invoiceService';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';
import { InvoiceApprovalDialog } from '@/components/invoices/InvoiceApprovalDialog';

import type {
  InvoiceReviewWorkspaceProps,
  ReviewStatusFilter,
  ReviewWorkspaceTab,
} from './invoiceReviewWorkspaceUtils';
import {
  DetailShell,
  EmptyQueueState,
} from './InvoiceReviewWorkspaceParts';
import {
  STATUS_OPTIONS,
  formatBillingPeriod,
  formatCurrency,
  formatRelativeTimestamp,
  getInvoiceWarnings,
  getStatusBadgeClassName,
  getStatusLabel,
} from './invoiceReviewWorkspaceUtils';

export function PhotographerInvoiceReviewWorkspace({
  role = 'photographer',
  title,
  shortLabel,
  pluralLabel,
}: InvoiceReviewWorkspaceProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [workspaceTab, setWorkspaceTab] = useState<ReviewWorkspaceTab>('review-queue');
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('pending_approval');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [queueResponse, setQueueResponse] = useState<WeeklyInvoiceReviewQueueResponse | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<WeeklyInvoice | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [warningOverrideReason, setWarningOverrideReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());
  const resolvedShortLabel = shortLabel || (role === 'salesRep' ? 'Sales Rep' : 'Photographer');
  const resolvedPluralLabel = pluralLabel || (role === 'salesRep' ? 'Sales Reps' : 'Photographers');
  const resolvedTitle = title || `${resolvedPluralLabel} Review`;

  const queue = queueResponse?.data || [];
  const summary = queueResponse?.summary || {
    invoice_count: 0,
    total_amount: 0,
    needs_review_count: 0,
    approved_count: 0,
    returned_count: 0,
  };

  const selectedStatusLabel = useMemo(
    () => STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label || 'Review',
    [statusFilter],
  );

  const summaryCards = useMemo(
    () => [
      {
        label: 'Filtered invoices',
        value: summary.invoice_count,
        icon: FileText,
      },
      {
        label: 'Filtered payout',
        value: formatCurrency(summary.total_amount),
        icon: DollarSign,
      },
      {
        label: 'Needs review',
        value: summary.needs_review_count,
        icon: Clock3,
      },
      {
        label: 'Returned',
        value: summary.returned_count,
        icon: MessageSquareMore,
      },
    ],
    [summary.invoice_count, summary.needs_review_count, summary.returned_count, summary.total_amount],
  );

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);

    try {
      const response = await fetchAdminInvoiceReviewQueue({
        role,
        approval_status: statusFilter,
        search: deferredSearch || undefined,
        start: startDate || undefined,
        end: endDate || undefined,
        page,
        per_page: 10,
      });

      setQueueResponse(response);
      setSelectedInvoiceId((current) => {
        if (!response.data.length) {
          return null;
        }

        const currentStillVisible = current != null && response.data.some((invoice) => invoice.id === current);
        return currentStillVisible ? current : response.data[0].id;
      });

      if (!response.data.length) {
        setSelectedInvoice(null);
        setMobileDetailOpen(false);
      }

      return response;
    } catch (error) {
      toast({
        title: `Failed to load ${resolvedShortLabel.toLowerCase()} review queue`,
        description: error instanceof Error ? error.message : 'Unable to load the review queue.',
        variant: 'destructive',
      });
      setQueueResponse(null);
      setSelectedInvoiceId(null);
      setSelectedInvoice(null);
      return null;
    } finally {
      setQueueLoading(false);
    }
  }, [deferredSearch, endDate, page, resolvedShortLabel, role, startDate, statusFilter, toast]);

  useEffect(() => {
    if (workspaceTab !== 'review-queue') {
      return;
    }

    void loadQueue();
  }, [loadQueue, workspaceTab]);

  useEffect(() => {
    if (workspaceTab !== 'review-queue' || selectedInvoiceId == null) {
      return;
    }

    let active = true;
    setDetailLoading(true);

    void fetchAdminInvoiceReviewDetail(selectedInvoiceId)
      .then((invoice) => {
        if (!active) return;
        setSelectedInvoice(invoice);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: 'Failed to load invoice detail',
          description: error instanceof Error ? error.message : 'Unable to load the invoice detail.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedInvoiceId, toast, workspaceTab]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, endDate, startDate, statusFilter]);

  const handleSelectInvoice = (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId);

    if (isMobile) {
      setMobileDetailOpen(true);
    }
  };

  const handleRefresh = async () => {
    const response = await loadQueue();
    if (response && selectedInvoiceId != null && response.data.some((invoice) => invoice.id === selectedInvoiceId)) {
      setDetailLoading(true);
      try {
        const detail = await fetchAdminInvoiceReviewDetail(selectedInvoiceId);
        setSelectedInvoice(detail);
      } catch (error) {
        toast({
          title: 'Failed to refresh invoice detail',
          description: error instanceof Error ? error.message : 'Unable to refresh the selected invoice.',
          variant: 'destructive',
        });
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const rows = queue.map((invoice) => ({
      payee: role === 'salesRep' ? invoice.salesRep?.name || 'Sales Rep' : invoice.photographer?.name || 'Photographer',
      email: role === 'salesRep' ? invoice.salesRep?.email || '' : invoice.photographer?.email || '',
      period: formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end),
      status: getStatusLabel(invoice.approval_status),
      shoots: invoice.shoot_count || 0,
      expenses: invoice.expense_count || 0,
      total: formatCurrency(invoice.total_amount),
      updated: formatRelativeTimestamp(invoice.last_activity_at),
    }));

    const columns = [
      { key: 'payee', label: resolvedShortLabel },
      { key: 'email', label: 'Email' },
      { key: 'period', label: 'Billing Period' },
      { key: 'status', label: 'Status' },
      { key: 'shoots', label: 'Shoots' },
      { key: 'expenses', label: 'Expenses' },
      { key: 'total', label: 'Total' },
      { key: 'updated', label: 'Last Updated' },
    ] as const;

    const fileName = `${resolvedShortLabel.toLowerCase().replace(/\s+/g, '-')}-review-queue`;

    if (format === 'csv') {
      exportRowsAsCsv(fileName, columns, rows);
      return;
    }

    if (format === 'excel') {
      exportRowsAsExcel(fileName, `${resolvedShortLabel} Queue`, columns, rows);
      return;
    }

    exportRowsAsPdf(fileName, `${resolvedTitle} Export`, columns, rows);
  };

  const handleApprove = async (overrideReasonOverride?: string) => {
    if (!selectedInvoice) return;

    const warnings = getInvoiceWarnings(selectedInvoice);
    const overrideReason = (overrideReasonOverride ?? warningOverrideReason).trim();
    if (warnings.length > 0 && !overrideReason) {
      toast({
        title: 'Override reason required',
        description: 'Unresolved warnings block approval unless accounts records an override reason.',
        variant: 'destructive',
      });
      return;
    }

    setActionLoading(true);

    try {
      await approveWeeklyInvoice(selectedInvoice.id, warnings.length > 0 ? overrideReason : undefined);
      toast({
        title: 'Invoice approved',
        description: 'The amount was approved. Payment can be marked separately after it is sent.',
      });
      setApproveDialogOpen(false);
      setWarningOverrideReason('');
      await handleRefresh();
    } catch (error) {
      toast({
        title: 'Approval failed',
        description: error instanceof Error ? error.message : 'Unable to approve this invoice.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnForChanges = async (reasonOverride?: string) => {
    if (!selectedInvoice) return;
    const reason = (reasonOverride ?? returnReason).trim();
    if (!reason) return;

    setActionLoading(true);

    try {
      await adminRejectWeeklyInvoice(selectedInvoice.id, reason);
      toast({
        title: 'Invoice returned',
        description: `The ${resolvedShortLabel.toLowerCase()} has been asked to make changes before payout.`,
      });
      setReturnDialogOpen(false);
      setReturnReason('');
      await handleRefresh();
    } catch (error) {
      toast({
        title: 'Return failed',
        description: error instanceof Error ? error.message : 'Unable to return this invoice.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Tabs
      value={workspaceTab}
      onValueChange={(value) => setWorkspaceTab(value as ReviewWorkspaceTab)}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <TabsList className="grid w-full grid-cols-2 xl:max-w-[26rem]">
          <TabsTrigger value="review-queue">Review Queue</TabsTrigger>
          <TabsTrigger value="payout-report">Payout Report</TabsTrigger>
        </TabsList>

        {workspaceTab === 'review-queue' ? (
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={queueLoading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', queueLoading && 'animate-spin')} />
              Refresh Queue
            </Button>
          </div>
        ) : null}
      </div>

      <TabsContent value="review-queue" className="mt-0 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.label} className="border-border/70 bg-card/80 shadow-sm">
                <CardContent className="flex items-start justify-between gap-3 px-4 py-4">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {card.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{card.value}</div>
                  </div>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/25">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="overflow-hidden border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="gap-3 border-b border-border/70 pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">{resolvedTitle}</CardTitle>
                <CardDescription>
                  Filter {resolvedPluralLabel.toLowerCase()} weekly invoices by review state, week, or {resolvedShortLabel.toLowerCase()}.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full border-border/70 bg-background/70 px-3 py-1 text-xs font-medium">
                  {summary.invoice_count} filtered
                </Badge>
                <Badge variant="outline" className="rounded-full border-border/70 bg-background/70 px-3 py-1 text-xs font-medium">
                  {selectedStatusLabel}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-5">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(15rem,0.85fr)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${resolvedShortLabel.toLowerCase()} name or email`}
                  className="h-11 rounded-xl border-border/70 bg-background pl-9"
                />
              </div>

              <DateRangePicker
                value={{ startDate, endDate }}
                onChange={({ startDate: nextStartDate, endDate: nextEndDate }) => {
                  setStartDate(nextStartDate);
                  setEndDate(nextEndDate);
                }}
                triggerClassName="h-11 rounded-xl border-border/70 bg-background"
              />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-muted/20 p-1.5">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    aria-pressed={statusFilter === option.value}
                    className={cn(
                      'rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-all',
                      statusFilter === option.value
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                        : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="text-sm text-muted-foreground">
                Reviewing <span className="font-medium text-foreground">{resolvedPluralLabel.toLowerCase()}</span> with{' '}
                <span className="font-medium text-foreground">{selectedStatusLabel.toLowerCase()}</span> status.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)]">
          <Card className="border-border/70 bg-card/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">{selectedStatusLabel}</CardTitle>
                  <CardDescription>
                    {queueResponse?.total || 0} invoice{(queueResponse?.total || 0) === 1 ? '' : 's'} in this view
                  </CardDescription>
                </div>
                {queueLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {queue.length === 0 && !queueLoading ? (
                <EmptyQueueState statusLabel={selectedStatusLabel} payeePlural={resolvedPluralLabel.toLowerCase()} />
              ) : (
                queue.map((invoice) => {
                  const isSelected = invoice.id === selectedInvoiceId;
                  const isNeedsReview = ['pending', 'pending_approval'].includes(invoice.approval_status);
                  const payee = role === 'salesRep' ? invoice.salesRep : invoice.photographer;

                  return (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => handleSelectInvoice(invoice.id)}
                      className={cn(
                        'flex w-full flex-col gap-3 rounded-xl border px-4 py-4 text-left transition-colors',
                        isSelected
                          ? 'border-primary/35 bg-primary/5'
                          : isNeedsReview
                            ? 'border-primary/20 bg-card hover:border-primary/30'
                            : 'border-border/70 bg-card hover:border-border',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold">{payee?.name || resolvedShortLabel}</span>
                            <Badge
                              variant="outline"
                              className={cn('font-medium', getStatusBadgeClassName(invoice.approval_status))}
                            >
                              {getStatusLabel(invoice.approval_status)}
                            </Badge>
                          </div>
                          <span className="truncate text-sm text-muted-foreground">
                            {payee?.email || 'No email available'}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total</div>
                          <div className="mt-1 font-semibold">{formatCurrency(invoice.total_amount)}</div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Shoots</div>
                          <div className="mt-1 font-semibold">{invoice.shoot_count || 0}</div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Expenses</div>
                          <div className="mt-1 font-semibold">{invoice.expense_count || 0}</div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <span>{formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end)}</span>
                        <span>Updated {formatRelativeTimestamp(invoice.last_activity_at)}</span>
                      </div>
                    </button>
                  );
                })
              )}

              {queueResponse && queueResponse.last_page > 1 ? (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span>
                      Page {queueResponse.current_page} of {queueResponse.last_page}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={queueLoading || queueResponse.current_page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((current) => Math.min(queueResponse.last_page, current + 1))}
                        disabled={queueLoading || queueResponse.current_page >= queueResponse.last_page}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {isMobile ? (
            <>
              <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
                <SheetContent side="right" className="w-full sm:max-w-2xl">
                  <SheetHeader className="flex flex-col gap-2 border-b border-border/70 pb-4">
                    <SheetTitle>Invoice Review Detail</SheetTitle>
                    <SheetDescription>
                      Review {resolvedShortLabel.toLowerCase()} payout lines, notes, and approval history.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 flex flex-col gap-4 overflow-y-auto pb-6">
                    <DetailShell
                      invoice={selectedInvoice}
                      detailLoading={detailLoading}
                      onApprove={() => setApproveDialogOpen(true)}
                      onReturn={() => setReturnDialogOpen(true)}
                      onOpenInvoice={() => setInvoiceModalOpen(true)}
                      role={role}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <Card className="border-border/70 bg-card/80">
                <CardContent className="flex min-h-[14rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-background">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold">Open invoice detail</p>
                    <p className="text-sm text-muted-foreground">
                      Tap any queue item to open the full review detail in a side sheet.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <DetailShell
              invoice={selectedInvoice}
              detailLoading={detailLoading}
              onApprove={() => setApproveDialogOpen(true)}
              onReturn={() => setReturnDialogOpen(true)}
              onOpenInvoice={() => setInvoiceModalOpen(true)}
              role={role}
            />
          )}
        </div>
      </TabsContent>

      <TabsContent value="payout-report" className="flex flex-col gap-4">
        <PayoutReportPanel
          role={role}
          title={`${resolvedPluralLabel} Report`}
          description={`Export payout totals and weekly summaries for ${resolvedPluralLabel.toLowerCase()}.`}
        />
      </TabsContent>

      <Dialog
        open={approveDialogOpen}
        onOpenChange={(open) => {
          setApproveDialogOpen(open);
          if (!open) setWarningOverrideReason('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {resolvedShortLabel} Invoice</DialogTitle>
            <DialogDescription>
              This approves the payout amount and freezes the totals. Payment is marked separately after it is sent.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
            {selectedInvoice ? (
              <>
                <div className="font-medium text-foreground">
                  {role === 'salesRep' ? selectedInvoice.salesRep?.name : selectedInvoice.photographer?.name}
                </div>
                <div className="mt-1">{formatBillingPeriod(selectedInvoice.billing_period_start, selectedInvoice.billing_period_end)}</div>
                <div className="mt-1 font-medium text-foreground">{formatCurrency(selectedInvoice.total_amount)}</div>
              </>
            ) : null}
            </div>
            {getInvoiceWarnings(selectedInvoice).length > 0 ? (
              <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                <div className="flex items-start gap-2 font-semibold">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Approval requires an accounts override reason
                </div>
                <div className="space-y-1">
                  {getInvoiceWarnings(selectedInvoice).map((warning, index) => (
                    <div key={`${warning.code || 'warning'}-${index}`}>
                      {warning.message || 'This invoice has an unresolved payout warning.'}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="warning-override-reason">Required override reason</Label>
                  <Textarea
                    id="warning-override-reason"
                    value={warningOverrideReason}
                    onChange={(event) => setWarningOverrideReason(event.target.value)}
                    placeholder="Explain why accounts is approving despite unresolved warnings."
                    rows={4}
                    className="bg-background"
                  />
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleApprove()} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Approve Amount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Invoice for Changes</DialogTitle>
            <DialogDescription>
              Add a clear reason so the {resolvedShortLabel.toLowerCase()} knows exactly what needs to be updated before resubmitting.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-return-reason">Required reason</Label>
              <Textarea
                id="admin-return-reason"
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
                placeholder="Explain the correction needed before payout can be approved."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleReturnForChanges()}
              disabled={actionLoading || !returnReason.trim()}
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Return for Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {role === 'photographer' && selectedInvoice ? (
        <InvoiceApprovalDialog
          isOpen={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          invoice={selectedInvoice}
          mode="admin"
          onAdminApprove={async (overrideReason) => {
            await handleApprove(overrideReason);
            setInvoiceModalOpen(false);
          }}
          onAdminReject={async (reason) => {
            await handleReturnForChanges(reason);
            setInvoiceModalOpen(false);
          }}
        />
      ) : null}
    </Tabs>
  );
}
