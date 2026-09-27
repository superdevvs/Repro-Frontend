import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useShoots } from '@/context/shootsContextState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import {
  WeeklyInvoice,
  WeeklyInvoiceItem,
  fetchPhotographerInvoices,
  fetchSalesRepInvoices,
  addWeeklyInvoiceExpense,
  removeWeeklyInvoiceExpense,
  submitWeeklyInvoiceChangesForApproval,
  submitWeeklyInvoiceForApproval,
} from '@/services/invoiceService';
import { InvoiceApprovalDialog } from '@/components/invoices/InvoiceApprovalDialog';
import {
  InvoiceDateFilterToolbar,
  type InvoiceExportFormat,
} from '@/components/accounting/InvoiceDateFilterToolbar';
import { cn } from '@/lib/utils';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';
import { downloadInvoicesPdf } from '@/utils/invoiceDownloads';
import {
  DEFAULT_INVOICE_DATE_FILTER,
  type InvoiceDateFilter,
} from '@/utils/invoiceDateFilters';

import {
  WEEKLY_INVOICE_EXPORT_COLUMNS,
  approvalStatusConfig,
  buildWeeklyInvoiceExportRows,
  fetchAllWeeklyInvoicePages,
  filterWeeklyInvoicesByDate,
  formatWeeklyBillingPeriod as formatBillingPeriod,
  formatWeeklyInvoiceCurrency as formatCurrency,
  getWeeklyInvoiceAggregateStats,
  getWeeklyInvoiceChargeTotal,
  getWeeklyInvoiceExportScope,
  getWeeklyInvoiceReviewCopy,
  getWeeklyInvoiceTotal,
  normalizeWeeklyInvoiceRole,
} from './weeklyInvoiceReviewUtils';
import { WeeklyInvoiceEmptyState, WeeklyInvoiceLoadingState } from './WeeklyInvoiceReviewStates';

export const WeeklyInvoiceReview: React.FC = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const { shoots } = useShoots();
  const [invoices, setInvoices] = useState<WeeklyInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<WeeklyInvoice | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(3);
  const [dateFilter, setDateFilter] = useState<InvoiceDateFilter>(DEFAULT_INVOICE_DATE_FILTER);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(() => new Set());
  const [exporting, setExporting] = useState(false);

  const invoiceRole = normalizeWeeklyInvoiceRole(role);
  const reviewCopy = getWeeklyInvoiceReviewCopy(invoiceRole);

  const shootLookup = React.useMemo(() => {
    const map = new Map<string, (typeof shoots)[number]>();
    shoots.forEach((shoot) => {
      map.set(String(shoot.id), shoot);
    });
    return map;
  }, [shoots]);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const fetchFn = invoiceRole === 'photographer' ? fetchPhotographerInvoices : fetchSalesRepInvoices;
      setInvoices(await fetchAllWeeklyInvoicePages(fetchFn));
    } catch (error) {
      console.error('Failed to load weekly invoices:', error);
      toast({ title: 'Failed to load invoices', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [invoiceRole, toast]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const filteredInvoices = React.useMemo(
    () => filterWeeklyInvoicesByDate(invoices, dateFilter),
    [dateFilter, invoices],
  );

  const selectedCount = React.useMemo(
    () => filteredInvoices.filter((invoice) => selectedInvoiceIds.has(invoice.id)).length,
    [filteredInvoices, selectedInvoiceIds],
  );

  useEffect(() => {
    const filteredIds = new Set(filteredInvoices.map((invoice) => invoice.id));
    setSelectedInvoiceIds((current) => {
      const next = new Set([...current].filter((id) => filteredIds.has(id)));
      return next.size === current.size ? current : next;
    });
    setSelectedInvoice((current) => {
      const matchingInvoice = current
        ? filteredInvoices.find((invoice) => invoice.id === current.id)
        : null;
      return matchingInvoice ?? filteredInvoices[0] ?? null;
    });
    setCurrentPage((page) => Math.min(
      page,
      Math.max(1, Math.ceil(filteredInvoices.length / pageSize)),
    ));
  }, [filteredInvoices, pageSize]);

  const canModify = (invoice: WeeklyInvoice) =>
    invoice.can_edit !== false && ['pending', 'rejected'].includes(invoice.approval_status) &&
    invoice.status !== 'paid' &&
    !invoice.is_paid &&
    !invoice.paid_at;

  // A new or admin-returned invoice remains with the payee until they submit it.
  // Once submitted, pending_approval locks editing while the admin reviews it.
  const canReview = canModify;

  const handleSubmitChangesForReview = async (reasonOverride?: string) => {
    if (!selectedInvoice) return;
    const reason = (reasonOverride ?? reviewNotes).trim();
    try {
      setActionLoading(true);
      await submitWeeklyInvoiceChangesForApproval(selectedInvoice.id, invoiceRole, reason);
      toast({
        title: 'Changes submitted',
        description: 'The changed invoice is now in the super admin review queue.',
      });
      setReviewOpen(false);
      setApprovalDialogOpen(false);
      setReviewNotes('');
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to submit changes',
        description: error instanceof Error ? error.message : 'Unable to send the invoice for review',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptReview = async (notesOverride?: string) => {
    if (!selectedInvoice) return;
    const notes = (notesOverride ?? reviewNotes).trim();
    try {
      setActionLoading(true);
      await submitWeeklyInvoiceForApproval(selectedInvoice.id, invoiceRole, notes || undefined);
      toast({ title: 'Invoice submitted', description: 'The invoice is now awaiting super admin review.' });
      setReviewOpen(false);
      setApprovalDialogOpen(false);
      setReviewNotes('');
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to submit invoice',
        description: error instanceof Error ? error.message : 'Unable to send the invoice for review',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!selectedInvoice || !expenseDesc || !expenseAmount) return;
    try {
      setActionLoading(true);
      await addWeeklyInvoiceExpense(selectedInvoice.id, invoiceRole, {
        description: expenseDesc,
        amount: parseFloat(expenseAmount),
      });
      toast({ title: 'Expense added' });
      setExpenseOpen(false);
      setExpenseDesc('');
      setExpenseAmount('');
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to add expense',
        description: error instanceof Error ? error.message : 'Unable to add expense',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveExpense = async (invoice: WeeklyInvoice, item: WeeklyInvoiceItem) => {
    try {
      setActionLoading(true);
      await removeWeeklyInvoiceExpense(invoice.id, item.id, invoiceRole);
      toast({ title: 'Expense removed' });
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to remove expense',
        description: error instanceof Error ? error.message : 'Unable to remove expense',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const exportInvoices = async (
    format: InvoiceExportFormat,
    scopedInvoices: WeeklyInvoice[],
    fileName: string,
    pdfTitle = reviewCopy.pdfTitle,
  ) => {
    const rows = buildWeeklyInvoiceExportRows(scopedInvoices);
    if (format === 'csv') {
      exportRowsAsCsv(fileName, WEEKLY_INVOICE_EXPORT_COLUMNS, rows);
    } else if (format === 'excel') {
      await exportRowsAsExcel(fileName, 'Weekly Invoices', WEEKLY_INVOICE_EXPORT_COLUMNS, rows);
    } else {
      await exportRowsAsPdf(fileName, pdfTitle, WEEKLY_INVOICE_EXPORT_COLUMNS, rows);
    }
  };

  const handleExport = async (format: InvoiceExportFormat) => {
    const scopedInvoices = getWeeklyInvoiceExportScope(filteredInvoices, selectedInvoiceIds);
    const selectionSuffix = selectedCount > 0 ? `-selected-${selectedCount}` : '';
    setExporting(true);
    try {
      await exportInvoices(format, scopedInvoices, `${reviewCopy.fileName}${selectionSuffix}`);
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unable to export these invoices.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleBulkPdf = async () => {
    const selectedInvoices = filteredInvoices.filter((invoice) => selectedInvoiceIds.has(invoice.id));
    if (selectedInvoices.length === 0) return;

    setExporting(true);
    try {
      await downloadInvoicesPdf(
        selectedInvoices.map((invoice) => {
          const payee = invoiceRole === 'salesRep'
            ? invoice.salesRep ?? invoice.payee
            : invoice.photographer ?? invoice.payee;
          const total = getWeeklyInvoiceTotal(invoice);
          const amountPaid = Number(invoice.amount_paid || 0);

          return {
            ...invoice,
            number: `W-${invoice.id}`,
            client: payee,
            date: invoice.billing_period_start,
            dueDate: invoice.billing_period_end,
            amount: total,
            amountPaid,
            balance: Math.max(total - amountPaid, 0),
          };
        }),
        {
          fileName: `${reviewCopy.fileName}-selected-invoices-combined-${selectedInvoices.length}.pdf`,
        },
      );
      toast({
        title: 'Invoices downloaded',
        description: `${selectedInvoices.length} invoices were combined into one PDF.`,
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

  const handleDateFilterChange = (filter: InvoiceDateFilter) => {
    setDateFilter(filter);
    setSelectedInvoiceIds(new Set());
    setCurrentPage(1);
  };

  const toggleInvoiceSelection = (invoiceId: number, checked: boolean) => {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
      if (checked) next.add(invoiceId);
      else next.delete(invoiceId);
      return next;
    });
  };

  const openReviewDialog = (invoice: WeeklyInvoice) => {
    setSelectedInvoice(invoice);
    setReviewNotes(invoice.modification_notes || '');
    if (invoiceRole === 'photographer') {
      setApprovalDialogOpen(true);
    } else {
      setReviewOpen(true);
    }
  };

  const resolveShootForItem = useCallback(
    (item: WeeklyInvoiceItem) => {
      if (!item.shoot_id) return null;
      const shoot = shootLookup.get(String(item.shoot_id));
      if (!shoot) return null;
      const loc = shoot.location;
      return {
        id: shoot.id,
        address: loc?.address,
        city: loc?.city,
        state: loc?.state,
        zip: loc?.zip,
        scheduled_date: shoot.scheduledDate,
        completed_at: (shoot as { completedAt?: string }).completedAt,
      };
    },
    [shootLookup],
  );

  const handleApprovalDialogChange = useCallback(
    (next: WeeklyInvoice) => {
      setSelectedInvoice(next);
      setInvoices((prev) => prev.map((inv) => (inv.id === next.id ? { ...inv, ...next } : inv)));
    },
    [],
  );

  if (loading) {
    return <WeeklyInvoiceLoadingState message={reviewCopy.loading} />;
  }

  if (invoices.length === 0) {
    return <WeeklyInvoiceEmptyState title={reviewCopy.emptyTitle} description={reviewCopy.emptyDescription} />;
  }

  const aggregateStats = getWeeklyInvoiceAggregateStats(filteredInvoices);

  // Client-side pagination of the left list.
  const clientLastPage = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const safePage = Math.min(currentPage, clientLastPage);
  const pagedInvoices = filteredInvoices.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  // Detail computations for the right pane.
  const detailInvoice = selectedInvoice
    ? filteredInvoices.find((invoice) => invoice.id === selectedInvoice.id) ?? filteredInvoices[0] ?? null
    : filteredInvoices[0] ?? null;
  const detailCharges = detailInvoice
    ? (detailInvoice.items || []).filter((i) => i.type === 'charge')
    : [];
  const detailExpenses = detailInvoice
    ? (detailInvoice.items || []).filter((i) => i.type === 'expense')
    : [];
  const detailShootPay = detailInvoice ? getWeeklyInvoiceChargeTotal(detailInvoice) : 0;
  const detailChargeCount = invoiceRole === 'photographer' && detailInvoice
    ? getWeeklyInvoiceAggregateStats([detailInvoice]).totalShoots
    : detailCharges.length;
  const detailExpensesTotal = detailExpenses.reduce(
    (sum, item) => sum + parseFloat(String(item.total_amount || 0)),
    0,
  );
  const detailTotal = detailInvoice ? getWeeklyInvoiceTotal(detailInvoice) : 0;
  const detailStatusCfg = detailInvoice
    ? approvalStatusConfig[detailInvoice.approval_status] || approvalStatusConfig.pending
    : null;
  const shootPayPct = detailTotal > 0 ? Math.round((detailShootPay / detailTotal) * 100) : 0;
  const expensePct = detailTotal > 0 ? Math.round((detailExpensesTotal / detailTotal) * 100) : 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card" aria-label={reviewCopy.sectionTitle}>
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <h2 className="text-base font-semibold">{invoiceRole === 'salesRep' ? 'Commission reviews' : 'Weekly invoices'}</h2>
        <span className="text-xs text-muted-foreground">Sun–Sat</span>
      </div>
      <div className="px-3 py-3 sm:px-4">
        <InvoiceDateFilterToolbar
          filter={dateFilter} onFilterChange={handleDateFilterChange}
          resultCount={filteredInvoices.length} selectedCount={selectedCount}
          onClearSelection={() => setSelectedInvoiceIds(new Set())}
          onExport={handleExport} onBulkPdf={handleBulkPdf}
          exportDisabled={filteredInvoices.length === 0} exporting={loading || exporting}
          className="border-0 bg-transparent p-0"
        />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-y border-border/60 px-4 py-3 text-xs text-muted-foreground sm:px-5" aria-label="Weekly review totals">
        <span><strong className="text-foreground">{filteredInvoices.length}</strong> invoices</span>
        <span><strong className="text-foreground">{aggregateStats.pendingReviewCount}</strong> pending review</span>
        <span><strong className="text-foreground">{formatCurrency(aggregateStats.totalAmount)}</strong> total</span>
        <span><strong className="text-foreground">{aggregateStats.totalShoots}</strong> {reviewCopy.chargeCountLabel.toLowerCase()}</span>
        <span><strong className="text-foreground">{formatCurrency(aggregateStats.totalExpensesAmount)}</strong> {reviewCopy.expenseLabel.toLowerCase()}</span>
      </div>
      <div className="grid min-w-0 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.7fr)]">
        <div className="flex h-[24rem] min-w-0 flex-col border-b border-border/60 p-3 lg:h-[32.5rem] lg:border-b-0 lg:border-r sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Review history</h3>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">Rows
              <select aria-label="Weekly reviews per page" className="h-8 rounded-md border bg-background px-2 text-foreground" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }}>
                <option value={3}>3</option><option value={5}>5</option>
              </select>
            </label>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]" tabIndex={0} aria-label="Weekly invoice history">
            {pagedInvoices.map((invoice) => {
              const active = detailInvoice?.id === invoice.id;
              const status = approvalStatusConfig[invoice.approval_status] || approvalStatusConfig.pending;
              return <div key={invoice.id} className={cn('flex items-center gap-2 rounded-lg border p-3', active ? 'border-primary/60 bg-primary/5' : 'border-border/60')}>
                <Checkbox checked={selectedInvoiceIds.has(invoice.id)} onCheckedChange={(checked) => toggleInvoiceSelection(invoice.id, checked === true)} aria-label={`Select invoice for ${formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end)}`} />
                <button type="button" onClick={() => { setSelectedInvoice(invoice); }} aria-pressed={active} className="min-w-0 flex-1 text-left">
                  <span className="block text-xs font-medium">{formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end)}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{invoice.is_paid || invoice.status === 'paid' ? 'Paid' : status.label}</span>
                </button>
                <strong className="shrink-0 text-xs tabular-nums">{formatCurrency(getWeeklyInvoiceTotal(invoice))}</strong>
              </div>;
            })}
            {pagedInvoices.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No invoices in this period.</p>}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            <span>{filteredInvoices.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, filteredInvoices.length)} of {filteredInvoices.length}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Previous weekly review page" aria-disabled={safePage === 1} onClick={() => { if (safePage > 1) setCurrentPage(safePage - 1); }}><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <span className="px-1">{safePage} / {clientLastPage}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Next weekly review page" aria-disabled={safePage >= clientLastPage} onClick={() => { if (safePage < clientLastPage) setCurrentPage(safePage + 1); }}><ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </div>
        {detailInvoice && detailStatusCfg ? <article className="flex h-[32.5rem] min-w-0 flex-col p-4 sm:p-5">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <h3 className="text-sm font-semibold">{formatBillingPeriod(detailInvoice.billing_period_start, detailInvoice.billing_period_end)}</h3>
            <Badge variant="outline" className={cn('text-[10px]', detailStatusCfg.className)}>{detailInvoice.is_paid || detailInvoice.status === 'paid' ? 'Paid' : detailStatusCfg.label}</Badge>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable]" tabIndex={0} aria-label="Weekly invoice detail">
            <div className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
              {[[reviewCopy.totalLabel, formatCurrency(detailTotal)], [reviewCopy.chargeLabel, formatCurrency(detailShootPay)], [reviewCopy.expenseLabel, formatCurrency(detailExpensesTotal)], [reviewCopy.chargeCountLabel, detailChargeCount.toString()]].map(([label, value]) => <div key={label}><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>)}
            </div>
            <h4 className="text-xs font-semibold">Payout breakdown</h4>
            <div className="my-3 h-1.5 overflow-hidden rounded-full bg-emerald-500/20"><div className="h-full bg-primary" style={{ width: `${shootPayPct}%` }} /></div>
            <div className="flex justify-between gap-3 text-[11px] text-muted-foreground"><span>{reviewCopy.chargeLabel} {shootPayPct}%</span><span>{reviewCopy.expenseLabel} {expensePct}%</span></div>
            <h4 className="mb-1 mt-5 text-xs font-semibold">{reviewCopy.breakdownTitle}</h4>
            {detailCharges.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 border-b border-border/50 py-3 text-xs"><div className="min-w-0"><p className="break-words font-medium">{item.description}</p><p className="mt-1 text-[11px] text-muted-foreground">{reviewCopy.breakdownItemDescription}</p></div><strong className="shrink-0 tabular-nums">{formatCurrency(Number(item.total_amount || 0))}</strong></div>)}
            {!detailCharges.length && <p className="py-3 text-xs text-muted-foreground">{reviewCopy.breakdownEmpty}</p>}
            <div className="mt-5 flex items-center justify-between gap-2"><h4 className="text-xs font-semibold">{reviewCopy.expensesTitle}</h4>{canModify(detailInvoice) && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setSelectedInvoice(detailInvoice); setExpenseOpen(true); }}><Plus className="mr-1 h-3 w-3" />{reviewCopy.addExpenseLabel}</Button>}</div>
            {detailExpenses.map((item) => <div key={item.id} className="flex items-center gap-2 border-b border-border/50 py-3 text-xs"><p className="min-w-0 flex-1 break-words">{item.description}</p><strong className="shrink-0 tabular-nums">{formatCurrency(item.total_amount)}</strong>{canModify(detailInvoice) && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Remove ${item.description}`} onClick={() => handleRemoveExpense(detailInvoice, item)} disabled={actionLoading}><Trash2 className="h-3.5 w-3.5" /></Button>}</div>)}
            {!detailExpenses.length && <p className="py-3 text-xs text-muted-foreground">{reviewCopy.expensesEmpty}</p>}
            <div className="my-4 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground">
              {detailInvoice.is_paid || detailInvoice.status === 'paid' ? 'This invoice has been paid and is locked.' : detailInvoice.approval_status === 'pending' ? 'Ready for your review. Check the items before submitting.' : detailInvoice.approval_status === 'rejected' ? detailInvoice.rejection_reason || 'Returned for changes. Update the invoice and resubmit.' : detailInvoice.approval_status === 'pending_approval' ? 'Submitted — awaiting admin review.' : 'Approved — awaiting payment.'}
              {detailInvoice.modification_notes && <p className="mt-2">Notes: {detailInvoice.modification_notes}</p>}
            </div>
          </div>
          <div className="mt-3 flex shrink-0 flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
            {invoiceRole === 'photographer' && <Button variant="outline" size="sm" onClick={() => { setSelectedInvoice(detailInvoice); setApprovalDialogOpen(true); }}>View invoice details</Button>}
            {canReview(detailInvoice) && <><Button variant="outline" size="sm" onClick={() => openReviewDialog(detailInvoice)}>Edit &amp; submit changes</Button><Button size="sm" onClick={() => openReviewDialog(detailInvoice)}>{detailInvoice.approval_status === 'rejected' ? 'Review response' : 'Review & submit'}</Button></>}
          </div>
        </article> : <div className="flex min-h-48 items-center justify-center p-6 text-sm text-muted-foreground">Choose another period to see invoice details.</div>}
      </div>

      {/* Photographer invoice approval dialog (replaces simple review dialog for photographers) */}
      {invoiceRole === 'photographer' && selectedInvoice ? (
        <InvoiceApprovalDialog
          isOpen={approvalDialogOpen}
          onClose={() => setApprovalDialogOpen(false)}
          invoice={selectedInvoice}
          mode="photographer"
          resolveShoot={resolveShootForItem}
          onPhotographerApprove={(notes) => handleAcceptReview(notes)}
          onPhotographerSubmitChanges={(reason) => handleSubmitChangesForReview(reason)}
          onInvoiceChange={handleApprovalDialogChange}
        />
      ) : null}

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewCopy.reviewDialogTitle}</DialogTitle>
            <DialogDescription>
              {reviewCopy.reviewDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder={reviewCopy.reviewNotesPlaceholder}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleSubmitChangesForReview()} disabled={actionLoading}>
              {actionLoading && <Loader2 aria-hidden="true" className="w-4 h-4 mr-2" />}
              Submit with Changes
            </Button>
            <Button onClick={() => handleAcceptReview()} disabled={actionLoading}>
              {actionLoading && <Loader2 aria-hidden="true" className="w-4 h-4 mr-2" />}
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewCopy.addExpenseDialogTitle}</DialogTitle>
            <DialogDescription>
              {reviewCopy.addExpenseDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Description</Label>
              <Input
                placeholder="e.g., Mileage reimbursement"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
              />
            </div>
            <div>
              <Label>Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button>
            <Button onClick={handleAddExpense} disabled={actionLoading || !expenseDesc || !expenseAmount}>
              {actionLoading && <Loader2 aria-hidden="true" className="w-4 h-4 mr-2" />}
              {reviewCopy.addExpenseLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
