import {triggerInvoicesRefresh} from '@/realtime/realtimeRefreshBus';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Clock3, DollarSign, Download, FileText, MessageSquareMore, RefreshCw, Search } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';

import { PayoutReportPanel } from '@/components/accounting/PayoutReportPanel';
import type { AccountingDateRange } from './accountingDateRange';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  adminRejectWeeklyInvoice,
  approveWeeklyInvoice,
  downloadInvoiceCsv,
  fetchAdminInvoiceReviewDetail,
  fetchAdminInvoiceReviewQueue,
  type WeeklyInvoice,
  type WeeklyInvoiceReviewQueueResponse,
} from '@/services/invoiceService';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';
import { downloadInvoicePdf, downloadInvoicesPdf } from '@/utils/invoiceDownloads';
import { PayoutInvoiceEditor } from '@/components/invoices/PayoutInvoiceEditor';
import { InvoiceDateFilterToolbar, type InvoiceExportFormat } from './InvoiceDateFilterToolbar';
import {
  DEFAULT_INVOICE_DATE_FILTER,
  resolveInvoiceDateFilterRange,
  type InvoiceDateFilter,
} from '@/utils/invoiceDateFilters';

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
  reportingRange,
}: InvoiceReviewWorkspaceProps & { reportingRange?: AccountingDateRange }) {
  const { toast } = useToast();
  const [workspaceTab, setWorkspaceTab] = useState<ReviewWorkspaceTab>('review-queue');
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('pending_approval');
  const [search, setSearch] = useState('');
  const [localDateFilter, setDateFilter] = useState<InvoiceDateFilter>(DEFAULT_INVOICE_DATE_FILTER);
  const reportingStart = reportingRange?.startDate;
  const reportingEnd = reportingRange?.endDate;
  const dateFilter = useMemo<InvoiceDateFilter>(() => reportingStart !== undefined && reportingEnd !== undefined
    ? { preset: 'custom', customRange: { startDate: reportingStart, endDate: reportingEnd } }
    : localDateFilter, [localDateFilter, reportingStart, reportingEnd]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [queueResponse, setQueueResponse] = useState<WeeklyInvoiceReviewQueueResponse | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<WeeklyInvoice | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [editorStartsOpen, setEditorStartsOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [warningOverrideReason, setWarningOverrideReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedDownloadInvoices, setSelectedDownloadInvoices] = useState<Map<number, WeeklyInvoice>>(
    () => new Map(),
  );
  const queueRequestId = useRef(0);
  const selectedIdRef = useRef(selectedInvoiceId);
  selectedIdRef.current = selectedInvoiceId;
  const deferredSearch = useDeferredValue(search.trim());
  const resolvedShortLabel = shortLabel || (role === 'salesRep' ? 'Sales Rep' : 'Photographer');
  const resolvedPluralLabel = pluralLabel || (role === 'salesRep' ? 'Sales Reps' : 'Photographers');
  const resolvedTitle = title || `${resolvedPluralLabel} Review`;
  const { startDate, endDate } = useMemo(() => {
    const range = resolveInvoiceDateFilterRange(dateFilter);
    return {
      startDate: range.start ? format(range.start, 'yyyy-MM-dd') : '',
      endDate: range.end ? format(range.end, 'yyyy-MM-dd') : '',
    };
  }, [dateFilter]);

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
    const requestId = ++queueRequestId.current;
    setQueueLoading(true);

    try {
      const response = await fetchAdminInvoiceReviewQueue({
        role,
        approval_status: statusFilter === 'all' ? undefined : statusFilter,
        search: deferredSearch || undefined,
        start: startDate || undefined,
        end: endDate || undefined,
        page,
        per_page: pageSize,
      });

      if (requestId !== queueRequestId.current) return null;

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
      }

      return response;
    } catch (error) {
      if (requestId !== queueRequestId.current) return null;
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
      if (requestId === queueRequestId.current) {
        setQueueLoading(false);
      }
    }
  }, [deferredSearch, endDate, page, pageSize, resolvedShortLabel, role, startDate, statusFilter, toast]);

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
    setSelectedInvoice(null);

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

  useEffect(() => {
    setSelectedDownloadInvoices(new Map());
  }, [deferredSearch, endDate, role, startDate, statusFilter]);

  const handleSelectInvoice = (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId);

  };

  const handleRefresh = async () => {
    const response = await loadQueue();
    if (response && selectedInvoiceId != null && response.data.some((invoice) => invoice.id === selectedInvoiceId)) {
      setDetailLoading(true);
      try {
        const detail = await fetchAdminInvoiceReviewDetail(selectedInvoiceId);
        if (selectedIdRef.current === detail.id) setSelectedInvoice(detail);
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

  const handleExport = async (exportFormat: InvoiceExportFormat) => {
    setExporting(true);
    try {
      let exportQueue = [...selectedDownloadInvoices.values()];
      if (exportQueue.length === 0) {
        const baseParams = {
          role,
          approval_status: statusFilter === 'all' ? undefined : statusFilter,
          search: deferredSearch || undefined,
          start: startDate || undefined,
          end: endDate || undefined,
          per_page: 100,
        } as const;
        const firstPage = await fetchAdminInvoiceReviewQueue({ ...baseParams, page: 1 });
        exportQueue = [...(firstPage.data || [])];
        for (let exportPage = 2; exportPage <= firstPage.last_page; exportPage += 1) {
          const response = await fetchAdminInvoiceReviewQueue({ ...baseParams, page: exportPage });
          exportQueue.push(...(response.data || []));
        }

        const seen = new Set<number>();
        exportQueue = exportQueue.filter((invoice) => {
          if (seen.has(invoice.id)) return false;
          seen.add(invoice.id);
          return true;
        });
      }
      const rows = exportQueue.map((invoice) => ({
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

      if (exportFormat === 'csv') exportRowsAsCsv(fileName, columns, rows);
      else if (exportFormat === 'excel') await exportRowsAsExcel(fileName, `${resolvedShortLabel} Queue`, columns, rows);
      else await exportRowsAsPdf(fileName, `${resolvedTitle} Export`, columns, rows);
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unable to export the filtered review queue.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const toDownloadableInvoice = (invoice: WeeklyInvoice) => {
    const payee = role === 'salesRep'
      ? invoice.salesRep ?? invoice.payee
      : invoice.photographer ?? invoice.payee;
    const total = Number(invoice.total_amount || 0);
    const amountPaid = Number(invoice.amount_paid || 0);

    return {
      ...invoice,
      number: `W-${invoice.id}`,
      client: payee,
      payee,
      date: invoice.billing_period_start,
      dueDate: invoice.billing_period_end,
      amount: total,
      amountPaid,
      balance: Math.max(total - amountPaid, 0),
    };
  };

  const handleInvoiceDownload = async (invoice: WeeklyInvoice, downloadFormat: 'pdf' | 'csv') => {
    try {
      if (downloadFormat === 'csv') await downloadInvoiceCsv(invoice.id);
      else await downloadInvoicePdf(toDownloadableInvoice(invoice));
      toast({
        title: 'Invoice downloaded',
        description: `Invoice W-${invoice.id} was downloaded as ${downloadFormat.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Unable to download this invoice.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkInvoiceDownload = async () => {
    const selected = [...selectedDownloadInvoices.values()];
    if (selected.length === 0) return;

    setExporting(true);
    try {
      await downloadInvoicesPdf(selected.map(toDownloadableInvoice), {
        fileName: `${resolvedShortLabel.toLowerCase().replace(/\s+/g, '-')}-selected-invoices.pdf`,
      });
      toast({
        title: 'Invoices downloaded',
        description: `${selected.length} invoices were combined into one PDF.`,
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Unable to download the selected invoices.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const toggleDownloadSelection = (invoice: WeeklyInvoice, checked: boolean) => {
    setSelectedDownloadInvoices((current) => {
      const next = new Map(current);
      if (checked) next.set(invoice.id, invoice);
      else next.delete(invoice.id);
      return next;
    });
  };

  const handleApprove = async (overrideReasonOverride?: string) => {
    if (!selectedInvoice || selectedInvoice.id !== selectedInvoiceId) return;

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
      await approveWeeklyInvoice(selectedInvoice.id, warnings.length > 0 ? overrideReason : undefined, selectedInvoice.payout_review?.revision);
      toast({
        title: 'Invoice approved',
        description: 'The amount was approved. Payment can be marked separately after it is sent.',
      });
      setApproveDialogOpen(false);
      setWarningOverrideReason('');
      await handleRefresh();
      triggerInvoicesRefresh();
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
    if (!selectedInvoice || selectedInvoice.id !== selectedInvoiceId) return;
    const reason = (reasonOverride ?? returnReason).trim();
    if (!reason) return;

    setActionLoading(true);

    try {
      await adminRejectWeeklyInvoice(selectedInvoice.id, reason, selectedInvoice.payout_review?.revision);
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
      className="ar-workspace flex min-w-0 flex-col gap-4"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <TabsList className="grid w-full grid-cols-2 xl:max-w-[26rem]">
          <TabsTrigger value="review-queue">Review Queue</TabsTrigger>
          <TabsTrigger value="payout-report">Payout Report</TabsTrigger>
        </TabsList>

        {workspaceTab === 'review-queue' ? (
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={queueLoading}>
              {queueLoading ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh Queue
            </Button>
          </div>
        ) : null}
      </div>

      <TabsContent value="review-queue" className="mt-0 flex min-w-0 flex-col gap-4">
        <div className="ar-summary">
          {summaryCards.map((card) => <div key={card.label}><span>{card.label}</span><strong>{card.value}</strong></div>)}
        </div>
        <div className="ar-period-toolbar">
          <p className="text-xs font-medium text-muted-foreground">Billing period · invoices overlapping your dates</p>
          <InvoiceDateFilterToolbar filter={dateFilter} onFilterChange={setDateFilter} hideDateFilter={Boolean(reportingRange)}
            resultCount={queueResponse?.total || 0} selectedCount={selectedDownloadInvoices.size}
            onClearSelection={() => setSelectedDownloadInvoices(new Map())} onExport={handleExport}
            onBulkPdf={handleBulkInvoiceDownload} exporting={exporting} exportDisabled={queueLoading} resultNoun="invoice" />
        </div>
        <div className="ar-review-grid">
          <section className="ar-queue" aria-label={resolvedTitle}>
            <div className="ar-queue-controls">
              <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{resolvedTitle}</h2><span className="text-xs text-muted-foreground">{queueResponse?.total || 0} invoices</span></div>
              <div className="relative">
                <Label htmlFor={`invoice-review-search-${role}`} className="sr-only">Search {resolvedPluralLabel.toLowerCase()} by name or email</Label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id={`invoice-review-search-${role}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className="h-9 pl-9" />
              </div>
              <select aria-label="Review status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReviewStatusFilter)} className="ar-select">
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="ar-queue-list" aria-busy={queueLoading}>
              {queueLoading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4" /> Loading invoices…</div> : queue.length === 0 ? <EmptyQueueState statusLabel={selectedStatusLabel} payeePlural={resolvedPluralLabel.toLowerCase()} /> : queue.map((invoice) => {
                const payee = (role === 'salesRep' ? invoice.salesRep : invoice.photographer) ?? invoice.payee;
                return <div key={invoice.id} className={cn('ar-queue-row', invoice.id === selectedInvoiceId && 'ar-selected')}>
                  <Checkbox checked={selectedDownloadInvoices.has(invoice.id)} onCheckedChange={(checked) => toggleDownloadSelection(invoice, checked === true)} aria-label={`Select invoice W-${invoice.id} for export`} className="mt-1" />
                  <button type="button" className="min-w-0 flex-1 text-left" aria-pressed={invoice.id === selectedInvoiceId} onClick={() => handleSelectInvoice(invoice.id)}>
                    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1"><span className="truncate text-sm font-semibold">{payee?.name || resolvedShortLabel}</span><span className="text-sm font-semibold tabular-nums">{formatCurrency(invoice.total_amount)}</span></div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end)}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">W-{invoice.id} · {invoice.shoot_count || 0} shoots · {invoice.expense_count || 0} expenses</span><Badge variant="outline" className={cn('text-[10px]', getStatusBadgeClassName(invoice.approval_status))}>{invoice.payout_review?.label || getStatusLabel(invoice.approval_status)}</Badge></div>
                  </button>
                  <ReviewInvoiceDownloadMenu invoice={invoice} onDownload={handleInvoiceDownload} />
                </div>;
              })}
            </div>
            <footer className="ar-pagination">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">Rows<select aria-label="Invoices per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="ar-select w-auto">{[6, 12, 24].map((size) => <option key={size}>{size}</option>)}</select></label>
              <span className="text-xs text-muted-foreground">{queueResponse?.current_page || 1} / {queueResponse?.last_page || 1}</span>
              <div className="flex gap-1"><Button variant="outline" size="sm" aria-label="Previous invoice page" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={queueLoading || page <= 1}>‹</Button><Button variant="outline" size="sm" aria-label="Next invoice page" onClick={() => setPage((current) => current + 1)} disabled={queueLoading || page >= (queueResponse?.last_page || 1)}>›</Button></div>
            </footer>
          </section>
          <DetailShell invoice={selectedInvoice?.id === selectedInvoiceId ? selectedInvoice : null} detailLoading={detailLoading || queueLoading} onApprove={() => setApproveDialogOpen(true)} onReturn={() => setReturnDialogOpen(true)} onOpenInvoice={() => { setEditorStartsOpen(false); setInvoiceModalOpen(true); }} onEditInvoice={() => { setEditorStartsOpen(true); setInvoiceModalOpen(true); }} role={role} />
        </div>
      </TabsContent>

      <TabsContent value="payout-report" className="flex flex-col gap-4">
        <PayoutReportPanel
          reportingRange={reportingRange}
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
              {actionLoading ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> : null}
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
              {actionLoading ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> : null}
              Return for Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedInvoice ? (
        <PayoutInvoiceEditor
          open={invoiceModalOpen}
          onClose={() => { setInvoiceModalOpen(false); void handleRefresh(); }}
          invoice={selectedInvoice}
          role="admin"
          initialEdit={editorStartsOpen}
          onInvoiceChange={setSelectedInvoice}
          onComplete={handleRefresh}
        />
      ) : null}
    </Tabs>
  );
}

function ReviewInvoiceDownloadMenu({
  invoice,
  onDownload,
}: {
  invoice: WeeklyInvoice;
  onDownload: (invoice: WeeklyInvoice, format: 'pdf' | 'csv') => void | Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={`Download invoice W-${invoice.id}`}
        >
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Download invoice</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void onDownload(invoice, 'pdf')}>
          PDF invoice
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onDownload(invoice, 'csv')}>
          CSV detail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
