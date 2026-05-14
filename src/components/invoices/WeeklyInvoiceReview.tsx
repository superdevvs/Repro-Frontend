import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useShoots } from '@/context/ShootsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  AlertTriangle,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
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
  rejectWeeklyInvoice,
  submitWeeklyInvoiceForApproval,
} from '@/services/invoiceService';
import { InvoiceApprovalDialog } from '@/components/invoices/InvoiceApprovalDialog';
import {
  getMatchingShootServiceForInvoiceItem,
  getPhotographerPayForService,
  getPhotographerPayForShoot,
} from '@/components/accounting/photographerEarningsUtils';
import { cn } from '@/lib/utils';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';

const approvalStatusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending Review',
    className: 'border-primary/20 bg-primary/10 text-primary',
    icon: <Clock className="h-3 w-3" />,
  },
  pending_approval: {
    label: 'Accepted',
    className: 'border-border bg-secondary text-secondary-foreground',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  approved: {
    label: 'Approved',
    className: 'border-border bg-secondary text-secondary-foreground',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  accounts_approved: {
    label: 'Accounts Approved',
    className: 'border-border bg-secondary text-secondary-foreground',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  rejected: {
    label: 'Requested for Modification',
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

const ITEMS_PER_PAGE = 4;
const FETCH_PAGE_SIZE = 100; // Pull a large batch so aggregate stats reflect all invoices, then paginate the list client-side.

const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Format the billing period range as "Week <Sun start> – <Sat end>, <year>".
 * Backend invoices for client/photographer often store billing_period_start
 * and billing_period_end as the same date (the issued/closed date). When that
 * happens we still want to show the user the actual Sun→Sat week the invoice
 * covers, so we derive the surrounding week from the available date.
 */
const formatBillingPeriod = (start: string, end: string): string => {
  if (!start && !end) return 'N/A';

  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;

  const sameDay =
    startDate && endDate &&
    Math.abs(endDate.getTime() - startDate.getTime()) < 1000 * 60 * 60 * 24;

  // When start and end collapse to the same date, derive the Sun→Sat week
  // window that contains it so the user sees a real range (e.g. "Week May 17 – May 23, 2026").
  let weekStart: Date | null = startDate;
  let weekEnd: Date | null = endDate;
  if (sameDay && startDate) {
    const dayOfWeek = startDate.getDay(); // 0 = Sun … 6 = Sat
    weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() - dayOfWeek);
    weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
  }

  if (!weekStart) return formatDate(end);
  if (!weekEnd) return formatDate(start);

  // Render as "May 17 – May 23, 2026" when the year matches, else full dates.
  if (weekStart.getFullYear() === weekEnd.getFullYear()) {
    const startShort = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startShort} – ${formatDate(weekEnd.toISOString())}`;
  }

  return `${formatDate(weekStart.toISOString())} – ${formatDate(weekEnd.toISOString())}`;
};

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
  const [lastPage, setLastPage] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);

  const invoiceRole: 'photographer' | 'salesRep' = role === 'salesRep' ? 'salesRep' : 'photographer';
  const reviewCopy = invoiceRole === 'salesRep'
    ? {
        loading: 'Loading commission reviews...',
        emptyTitle: 'No Weekly Reviews Yet',
        emptyDescription: 'Weekly commission reviews are generated every Monday morning for the previous completed week.',
        sectionTitle: 'Weekly Commission Reviews',
        sectionDescription: 'Commission review packets are auto-generated every Monday for the previous completed week (Sun-Sat).',
        cardDescription: 'Compact weekly commission summary with line items and review actions tucked into details.',
        totalLabel: 'Weekly Total',
        chargeLabel: 'Commission',
        expenseLabel: 'Adjustments',
        chargeCountLabel: 'Commission Lines',
        expenseCountLabel: 'Adjustment Items',
        breakdownTitle: 'Commission Breakdown',
        breakdownItemDescription: 'Commission line item',
        breakdownEmpty: 'No commission line items for this week.',
        expensesTitle: 'Adjustments & Notes',
        expensesEmpty: 'No adjustments added for this review.',
        footerSummary: (charges: number, expenses: number) =>
          `${charges} commission line${charges !== 1 ? 's' : ''} and ${expenses} adjustment${expenses !== 1 ? 's' : ''} in this review.`,
        addExpenseLabel: 'Add Adjustment',
        reviewDialogTitle: 'Review Commission Summary',
        reviewDialogDescription: 'Choose how you want to review this commission summary. You can accept it or request a modification with notes. The review status will update immediately.',
        reviewNotesPlaceholder: 'Add an optional note for this commission review...',
        addExpenseDialogTitle: 'Add Adjustment',
        addExpenseDialogDescription: 'Add a manual adjustment or reimbursable expense to this commission review.',
        fileName: 'sales-rep-weekly-commission-reviews',
        pdfTitle: 'Weekly Commission Review Report',
      }
    : {
        loading: 'Loading invoices...',
        emptyTitle: 'No Invoices Yet',
        emptyDescription: 'Weekly invoices are generated every Monday morning for the previous completed week.',
        sectionTitle: 'Weekly Invoices',
        sectionDescription: 'Invoices are auto-generated every Monday for the previous completed week (Sun-Sat)',
        cardDescription: 'Compact weekly payout summary with line items and review actions tucked into details.',
        totalLabel: 'Invoice Total',
        chargeLabel: 'Shoot Pay',
        expenseLabel: 'Expenses',
        chargeCountLabel: 'Shoots',
        expenseCountLabel: 'Expense Items',
        breakdownTitle: 'Service Breakdown',
        breakdownItemDescription: 'Shoot payout item',
        breakdownEmpty: 'No payout line items for this week.',
        expensesTitle: 'Expenses & Notes',
        expensesEmpty: 'No expenses added for this invoice.',
        footerSummary: (charges: number, expenses: number) =>
          `${charges} shoot${charges !== 1 ? 's' : ''} and ${expenses} expense${expenses !== 1 ? 's' : ''} in this invoice.`,
        addExpenseLabel: 'Add Expense',
        reviewDialogTitle: 'Review Invoice',
        reviewDialogDescription: 'Choose how you want to review this invoice. You can accept it or request a modification with notes. The invoice status will update immediately.',
        reviewNotesPlaceholder: 'Add an optional note for this review...',
        addExpenseDialogTitle: 'Add Expense',
        addExpenseDialogDescription: 'Add an expense item to this invoice (e.g., mileage, equipment rental).',
        fileName: 'photographer-weekly-invoices',
        pdfTitle: 'Weekly Invoice Report',
      };

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
      // Fetch a large batch so the new design's aggregate stats and the left
      // list both have the full dataset to work with. The list itself is
      // paginated client-side via {currentPage}.
      const response = await fetchFn({ page: 1, per_page: FETCH_PAGE_SIZE });
      setInvoices(response.data || []);
      setTotalInvoices(response.total || (response.data || []).length);
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

  const canModify = (invoice: WeeklyInvoice) =>
    ['pending', 'rejected'].includes(invoice.approval_status) && invoice.status === 'draft';

  // Show review actions whenever the invoice is still awaiting the photographer's
  // decision (approval_status pending/rejected). Backend `canBeModifiedByPhotographer`
  // additionally enforces invoice.status === 'draft' and returns 422 if that fails;
  // any such error is surfaced via the existing toast handlers below.
  const canReview = (invoice: WeeklyInvoice) =>
    ['pending', 'rejected'].includes(invoice.approval_status);

  const handleRequestModification = async (reasonOverride?: string) => {
    if (!selectedInvoice) return;
    const reason = (reasonOverride ?? reviewNotes).trim();
    try {
      setActionLoading(true);
      await rejectWeeklyInvoice(selectedInvoice.id, invoiceRole, reason || undefined);
      toast({
        title: 'Modification requested',
        description: 'Invoice status has been updated to requested modification.',
      });
      setReviewOpen(false);
      setApprovalDialogOpen(false);
      setReviewNotes('');
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to request modification',
        description: error instanceof Error ? error.message : 'Unable to update invoice status',
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
      toast({
        title: 'Invoice accepted',
        description: 'Invoice status has been updated to accepted.',
      });
      setReviewOpen(false);
      setApprovalDialogOpen(false);
      setReviewNotes('');
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to accept invoice',
        description: error instanceof Error ? error.message : 'Unable to update invoice status',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async (invoice: WeeklyInvoice) => {
    try {
      setActionLoading(true);
      await submitWeeklyInvoiceForApproval(invoice.id, invoiceRole, invoice.modification_notes || undefined);
      toast({
        title: 'Invoice resubmitted',
        description: 'Invoice status has been updated to accepted.',
      });
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to resubmit invoice',
        description: error instanceof Error ? error.message : 'Unable to update invoice status',
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

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const rows = invoices.map((invoice) => ({
      week: `${formatDate(invoice.billing_period_start)} - ${formatDate(invoice.billing_period_end)}`,
      status: approvalStatusConfig[invoice.approval_status || 'pending']?.label || invoice.approval_status,
      total: formatCurrency(invoice.total_amount),
      charges: (invoice.charge_count || 0).toString(),
      expenses: (invoice.expense_count || 0).toString(),
      notes: invoice.modification_notes || invoice.rejection_reason || '',
    }));

    const columns = [
      { key: 'week', label: 'Week' },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total' },
      { key: 'charges', label: 'Charges' },
      { key: 'expenses', label: 'Expenses' },
      { key: 'notes', label: 'Notes' },
    ] as const;

    const fileName = reviewCopy.fileName;

    if (format === 'csv') {
      exportRowsAsCsv(fileName, columns, rows);
      return;
    }

    if (format === 'excel') {
      exportRowsAsExcel(fileName, 'Weekly Invoices', columns, rows);
      return;
    }

    exportRowsAsPdf(fileName, reviewCopy.pdfTitle, columns, rows);
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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">{reviewCopy.loading}</span>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">{reviewCopy.emptyTitle}</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {reviewCopy.emptyDescription}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Compute the photographer's payout for an invoice. Charges may not always
  // map cleanly to a single service (mismatched description / multiple charges
  // per shoot), so we compute the payout at the SHOOT level: for each unique
  // shoot referenced by a charge item we add the photographer's pay for that
  // shoot once. Charge items that have no shoot_id fall back to their raw
  // amount so manual / off-shoot lines are still counted.
  const computeInvoicePhotographerPay = (invoice: WeeklyInvoice): number => {
    if (invoiceRole !== 'photographer') {
      return (invoice.items || [])
        .filter((i) => i.type === 'charge')
        .reduce((sum, item) => sum + getChargeDisplayAmount(invoice, item), 0);
    }

    const charges = (invoice.items || []).filter((i) => i.type === 'charge');
    const seenShootIds = new Set<string>();
    let payout = 0;
    charges.forEach((item) => {
      if (item.shoot_id != null) {
        const key = String(item.shoot_id);
        if (seenShootIds.has(key)) return;
        seenShootIds.add(key);
        const shoot = shootLookup.get(key);
        if (shoot) {
          payout += getPhotographerPayForShoot(shoot, user);
          return;
        }
      }
      // Fallback: no shoot mapping → use the raw line amount.
      payout += parseFloat(String(item.total_amount || 0));
    });
    return payout;
  };

  // -------- Aggregate stats across all loaded invoices --------
  const aggregateStats = invoices.reduce(
    (acc, invoice) => {
      const invoiceCharges = (invoice.items || []).filter((i) => i.type === 'charge');
      const invoiceExpenses = (invoice.items || []).filter((i) => i.type === 'expense');
      const chargesTotal = computeInvoicePhotographerPay(invoice);
      const expensesTotal = invoiceExpenses.reduce(
        (sum, item) => sum + parseFloat(String(item.total_amount || 0)),
        0,
      );
      acc.totalAmount += chargesTotal + expensesTotal;
      acc.totalShoots += invoiceCharges.length;
      acc.totalExpensesAmount += expensesTotal;
      if (invoice.approval_status === 'pending') {
        acc.pendingReviewCount += 1;
      }
      return acc;
    },
    { totalAmount: 0, totalShoots: 0, totalExpensesAmount: 0, pendingReviewCount: 0 },
  );

  // Client-side pagination of the left list.
  const clientLastPage = Math.max(1, Math.ceil(invoices.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, clientLastPage);
  const pagedInvoices = invoices.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  // Auto-select first invoice when none is selected (or selection no longer present).
  if (!selectedInvoice || !invoices.find((inv) => inv.id === selectedInvoice.id)) {
    if (invoices.length > 0) {
      // Avoid setting state during render: defer.
      Promise.resolve().then(() => setSelectedInvoice(invoices[0]));
    }
  }

  // Detail computations for the right pane.
  const detailInvoice = selectedInvoice && invoices.find((i) => i.id === selectedInvoice.id)
    ? selectedInvoice
    : invoices[0] ?? null;
  const detailCharges = detailInvoice
    ? (detailInvoice.items || []).filter((i) => i.type === 'charge')
    : [];
  const detailExpenses = detailInvoice
    ? (detailInvoice.items || []).filter((i) => i.type === 'expense')
    : [];
  const detailShootPay = detailInvoice ? computeInvoicePhotographerPay(detailInvoice) : 0;
  const detailExpensesTotal = detailExpenses.reduce(
    (sum, item) => sum + parseFloat(String(item.total_amount || 0)),
    0,
  );
  const detailTotal = detailShootPay + detailExpensesTotal;
  const detailStatusCfg = detailInvoice
    ? approvalStatusConfig[detailInvoice.approval_status] || approvalStatusConfig.pending
    : null;
  const shootPayPct = detailTotal > 0 ? Math.round((detailShootPay / detailTotal) * 100) : 0;
  const expensePct = detailTotal > 0 ? Math.round((detailExpensesTotal / detailTotal) * 100) : 0;

  return (
    // Outer wrapper for the redesigned Weekly Invoices section.
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{reviewCopy.sectionTitle}</h2>
            <p className="text-sm text-muted-foreground">{reviewCopy.sectionDescription}.</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="self-start">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>Excel</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-card/50 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            icon: <FileText className="h-5 w-5" />,
            value: invoices.length.toString(),
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
              const chargesTotal = computeInvoicePhotographerPay(invoice);
              const expensesTotal = expenses.reduce(
                (sum, item) => sum + parseFloat(String(item.total_amount || 0)),
                0,
              );
              const itemTotal = chargesTotal + expensesTotal;
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
                <button
                  type="button"
                  key={invoice.id}
                  onClick={() => setSelectedInvoice(invoice)}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60 hover:border-border hover:bg-muted/40',
                  )}
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
              );
            })}
          </div>

          {/* Left-pane pagination */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {pagedInvoices.length} of {invoices.length} invoice{invoices.length === 1 ? '' : 's'}
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
                    {detailInvoice.approval_status === 'pending' && 'This invoice is currently pending review.'}
                    {detailInvoice.approval_status === 'rejected' && 'This invoice needs your attention — modification was requested.'}
                    {detailInvoice.approval_status === 'pending_approval' && 'Accepted — awaiting accounting approval.'}
                    {(detailInvoice.approval_status === 'approved' || detailInvoice.approval_status === 'accounts_approved')
                      && 'Approved — payment is being processed.'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {detailInvoice.approval_status === 'pending'
                      ? 'You can review the line items, verify the details, and approve or request changes.'
                      : detailInvoice.approval_status === 'rejected'
                        ? detailInvoice.rejection_reason || 'Open the review dialog to update the invoice.'
                        : 'No further action required from you on this invoice.'}
                  </p>
                </div>
              </div>
              {canReview(detailInvoice) && (
                <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => openReviewDialog(detailInvoice)}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                    Reject with Changes
                  </Button>
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={() => openReviewDialog(detailInvoice)}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Approve
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
                          {formatCurrency(getChargeDisplayAmount(detailInvoice, item))}
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
          onPhotographerReject={(reason) => handleRequestModification(reason)}
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
            <Button variant="outline" onClick={() => handleRequestModification()} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Request Modification
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
