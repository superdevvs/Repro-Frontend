import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useShoots } from '@/context/shootsContextState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  CheckCircle,
  Clock,
  Plus,
  Trash2,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ReceiptText,
  Camera,
  Info,
  Eye,
} from 'lucide-react';
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
import {
  getMatchingShootServiceForInvoiceItem,
  getPhotographerPayForService,
  getPhotographerPayForShoot,
} from '@/components/accounting/photographerEarningsUtils';
import { cn } from '@/lib/utils';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';
import { downloadInvoicesPdf } from '@/utils/invoiceDownloads';
import {
  DEFAULT_INVOICE_DATE_FILTER,
  type InvoiceDateFilter,
} from '@/utils/invoiceDateFilters';

import {
  ITEMS_PER_PAGE,
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
  const { role, user } = useAuth();
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
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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

  const getChargeDisplayAmount = useCallback(
    (invoice: WeeklyInvoice, item: WeeklyInvoiceItem) => {
      const rawAmount = typeof item.total_amount === 'string' ? parseFloat(item.total_amount) : item.total_amount;
      if (invoiceRole !== 'photographer') {
        return Number(rawAmount || 0);
      }

      const shoot =
        item.shoot_id != null
          ? shootLookup.get(String(item.shoot_id))
          : null;

      if (!shoot) {
        return Number(rawAmount || 0);
      }

      const matchedService = getMatchingShootServiceForInvoiceItem(shoot, item.description);
      if (matchedService) {
        return getPhotographerPayForService(shoot, matchedService);
      }

      const sameShootCharges = (invoice.items || []).filter(
        (invoiceItem) =>
          invoiceItem.type === 'charge' &&
          invoiceItem.shoot_id != null &&
          item.shoot_id != null &&
          String(invoiceItem.shoot_id) === String(item.shoot_id),
      );

      if (sameShootCharges.length === 1) {
        return getPhotographerPayForShoot(shoot, user);
      }

      // Distribute the shoot's photographer pay equally across its charges so
      // line totals reflect photographer payout (and sum to the shoot's pay)
      // rather than the client-billed line amount.
      if (sameShootCharges.length > 1) {
        const shootPay = getPhotographerPayForShoot(shoot, user);
        if (shootPay > 0) {
          return Number((shootPay / sameShootCharges.length).toFixed(2));
        }
      }

      return Number(rawAmount || 0);
    },
    [invoiceRole, shootLookup, user],
  );

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
      Math.max(1, Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE)),
    ));
  }, [filteredInvoices]);

  const canModify = (invoice: WeeklyInvoice) =>
    ['pending', 'rejected'].includes(invoice.approval_status) &&
    invoice.status !== 'paid' &&
    !invoice.is_paid &&
    !invoice.paid_at;

  // A new or admin-returned invoice remains with the payee until they submit it.
  // Once submitted, pending_approval locks editing while the admin reviews it.
  const canReview = (invoice: WeeklyInvoice) =>
    ['pending', 'rejected'].includes(invoice.approval_status);

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
  const clientLastPage = Math.max(1, Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, clientLastPage);
  const pagedInvoices = filteredInvoices.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
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
    // Outer wrapper for the redesigned Weekly Invoices section.
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{reviewCopy.sectionTitle}</h2>
            <p className="text-sm text-muted-foreground">{reviewCopy.sectionDescription}.</p>
          </div>
        </div>
      </div>

      <InvoiceDateFilterToolbar
        filter={dateFilter}
        onFilterChange={handleDateFilterChange}
        resultCount={filteredInvoices.length}
        selectedCount={selectedCount}
        onClearSelection={() => setSelectedInvoiceIds(new Set())}
        onExport={handleExport}
        onBulkPdf={handleBulkPdf}
        exportDisabled={filteredInvoices.length === 0}
        exporting={loading || exporting}
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-card/50 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            icon: <FileText className="h-5 w-5" />,
            value: filteredInvoices.length.toString(),
            label: 'Invoices',
            iconBg: 'bg-blue-500/10 text-blue-500',
          },
          {
            icon: <DollarSign className="h-5 w-5" />,
            value: formatCurrency(aggregateStats.totalAmount),
            label: 'Total Invoice Amount',
            iconBg: 'bg-emerald-500/10 text-emerald-500',
          },
          {
            icon: <Camera className="h-5 w-5" />,
            value: aggregateStats.totalShoots.toString(),
            label: 'Shoots',
            iconBg: 'bg-violet-500/10 text-violet-500',
          },
          {
            icon: <ReceiptText className="h-5 w-5" />,
            value: formatCurrency(aggregateStats.totalExpensesAmount),
            label: 'Expenses',
            iconBg: 'bg-teal-500/10 text-teal-500',
          },
          {
            icon: <Clock className="h-5 w-5" />,
            value: aggregateStats.pendingReviewCount.toString(),
            label: 'Pending Review',
            iconBg: 'bg-amber-500/10 text-amber-500',
          },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', stat.iconBg)}>
              {stat.icon}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{stat.value}</p>
              <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout: invoice list + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT: invoice list */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/50 p-4 lg:col-span-1">
          <div className="flex-1 min-h-0 space-y-2 overflow-y-auto">
            {pagedInvoices.map((invoice) => {
              const isActive = detailInvoice?.id === invoice.id;
              const charges = (invoice.items || []).filter((i) => i.type === 'charge');
              const expenses = (invoice.items || []).filter((i) => i.type === 'expense');
              const itemTotal = getWeeklyInvoiceTotal(invoice);
              const statusCfg = approvalStatusConfig[invoice.approval_status] || approvalStatusConfig.pending;
              const statusDot = invoice.approval_status === 'pending'
                ? 'bg-amber-500'
                : invoice.approval_status === 'rejected'
                  ? 'bg-destructive'
                  : 'bg-emerald-500';
              const subLabel = charges.length === 0 && expenses.length === 0
                ? 'No payout'
                : `${charges.length} shoot${charges.length === 1 ? '' : 's'}`;

              return (
                <div
                  key={invoice.id}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60 hover:border-border hover:bg-muted/40',
                  )}
                >
                  <Checkbox
                    checked={selectedInvoiceIds.has(invoice.id)}
                    onCheckedChange={(checked) => toggleInvoiceSelection(invoice.id, checked === true)}
                    aria-label={`Select invoice for ${formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end)}`}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedInvoice(invoice)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className={cn(
                      'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                      isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                    )}>
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end)}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', statusDot)} />
                        <span className="truncate">{statusCfg.label} · {subLabel}</span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(itemTotal)}</p>
                      <ChevronRight className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Left-pane pagination */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {pagedInvoices.length} of {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 rounded-md p-0"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safePage === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: clientLastPage }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === safePage ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 w-7 rounded-md p-0 text-xs"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 rounded-md p-0"
                onClick={() => setCurrentPage((page) => Math.min(clientLastPage, page + 1))}
                disabled={safePage >= clientLastPage}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT: Selected invoice detail */}
        {detailInvoice && detailStatusCfg ? (
          <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/50 p-4 lg:col-span-2">
            {/* Title + actions */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">
                    {formatBillingPeriod(detailInvoice.billing_period_start, detailInvoice.billing_period_end)}
                  </h3>
                  <Badge variant="outline" className={cn('flex items-center gap-1 font-medium', detailStatusCfg.className)}>
                    {detailStatusCfg.icon}
                    {detailStatusCfg.label}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{reviewCopy.cardDescription}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canReview(detailInvoice) && (
                  <Button size="sm" onClick={() => openReviewDialog(detailInvoice)}>
                    {detailInvoice.approval_status === 'pending' ? 'Review Invoice' : 'Review Response'}
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={expandedInvoiceId === detailInvoice.id ? 'default' : 'outline'}
                  onClick={() => setExpandedInvoiceId(expandedInvoiceId === detailInvoice.id ? null : detailInvoice.id)}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  {expandedInvoiceId === detailInvoice.id ? 'Back to Summary' : 'View Details'}
                </Button>
              </div>
            </div>

            {/* Summary view (shown by default; hidden when View Details is active) */}
            {expandedInvoiceId !== detailInvoice.id && (
            <>
            {/* 4 stat tiles */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  icon: <DollarSign className="h-5 w-5" />,
                  iconBg: 'bg-blue-500/10 text-blue-500',
                  label: 'Invoice Total',
                  value: formatCurrency(detailTotal),
                },
                {
                  icon: <Camera className="h-5 w-5" />,
                  iconBg: 'bg-emerald-500/10 text-emerald-500',
                  label: reviewCopy.chargeLabel,
                  value: formatCurrency(detailShootPay),
                },
                {
                  icon: <ReceiptText className="h-5 w-5" />,
                  iconBg: 'bg-violet-500/10 text-violet-500',
                  label: reviewCopy.expenseLabel,
                  value: formatCurrency(detailExpensesTotal),
                  subtitle: `${detailExpenses.length} expense item${detailExpenses.length === 1 ? '' : 's'}`,
                },
                {
                  icon: <Camera className="h-5 w-5" />,
                  iconBg: 'bg-teal-500/10 text-teal-500',
                  label: reviewCopy.chargeCountLabel,
                  value: detailCharges.length.toString(),
                },
              ].map((tile) => (
                <div key={tile.label} className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', tile.iconBg)}>
                    {tile.icon}
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">{tile.label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{tile.value}</p>
                  {'subtitle' in tile && tile.subtitle && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{tile.subtitle}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Payout Breakdown */}
            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
              <h4 className="text-sm font-semibold">Payout Breakdown</h4>
              <div className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>{reviewCopy.chargeLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{formatCurrency(detailShootPay)}</span>
                    <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-500">
                      {shootPayPct}%
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{reviewCopy.expenseLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{formatCurrency(detailExpensesTotal)}</span>
                    <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                      {expensePct}%
                    </Badge>
                  </div>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between gap-3 text-base font-semibold">
                  <span>Total Invoice Amount</span>
                  <span className="tabular-nums">{formatCurrency(detailTotal)}</span>
                </div>
              </div>
            </div>

            {/* Status banner */}
            <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <Info className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {detailInvoice.approval_status === 'pending' && 'This invoice is ready for your review.'}
                    {detailInvoice.approval_status === 'rejected' && 'The admin returned this invoice for changes.'}
                    {detailInvoice.approval_status === 'pending_approval' && 'Submitted — awaiting super admin review.'}
                    {(detailInvoice.approval_status === 'approved' || detailInvoice.approval_status === 'accounts_approved')
                      && 'Approved — payment is being processed.'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {detailInvoice.approval_status === 'pending'
                      ? 'Review the line items, edit anything needed, then submit the invoice.'
                      : detailInvoice.approval_status === 'rejected'
                        ? detailInvoice.rejection_reason || 'Make the requested changes, then resubmit the invoice.'
                        : 'No further action required from you on this invoice.'}
                  </p>
                </div>
              </div>
              {canReview(detailInvoice) && (
                <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-950/40"
                    onClick={() => openReviewDialog(detailInvoice)}
                  >
                    <ReceiptText className="h-3.5 w-3.5 mr-1.5" />
                    Edit &amp; Submit Changes
                  </Button>
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={() => openReviewDialog(detailInvoice)}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Approve &amp; Submit
                  </Button>
                </div>
              )}
            </div>
            </>
            )}

            {/* Detail view (shown only when View Details is active; replaces the summary) */}
            {expandedInvoiceId === detailInvoice.id && (
              <div className="grid gap-4 rounded-xl border border-border/60 bg-background/40 p-4 lg:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2">
                    <ReceiptText className="h-4 w-4 text-primary" />
                    <h5 className="text-sm font-semibold">{reviewCopy.breakdownTitle}</h5>
                  </div>
                  <div className="mt-3 space-y-2">
                    {detailCharges.length === 0 && (
                      <p className="rounded-lg border border-dashed border-border/50 px-3 py-4 text-center text-xs text-muted-foreground">
                        {reviewCopy.breakdownEmpty}
                      </p>
                    )}
                    {detailCharges.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{reviewCopy.breakdownItemDescription}</p>
                        </div>
                        <p className="font-semibold tabular-nums">
                          {formatCurrency(parseFloat(String(item.total_amount ?? 0)))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <h5 className="text-sm font-semibold">{reviewCopy.expensesTitle}</h5>
                    </div>
                    {canModify(detailInvoice) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSelectedInvoice(detailInvoice);
                          setExpenseOpen(true);
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        {reviewCopy.addExpenseLabel}
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    {detailExpenses.length === 0 && (
                      <p className="rounded-lg border border-dashed border-border/50 px-3 py-4 text-center text-xs text-muted-foreground">
                        {reviewCopy.expensesEmpty}
                      </p>
                    )}
                    {detailExpenses.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">Expense reimbursement</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold tabular-nums">+{formatCurrency(item.total_amount)}</p>
                          {canModify(detailInvoice) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveExpense(detailInvoice, item)}
                              disabled={actionLoading}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-8 lg:col-span-2">
            <p className="text-sm text-muted-foreground">Select an invoice from the left to view details.</p>
          </div>
        )}
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
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit with Changes
            </Button>
            <Button onClick={() => handleAcceptReview()} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {reviewCopy.addExpenseLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
