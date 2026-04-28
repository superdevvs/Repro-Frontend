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
  Download,
  DollarSign,
  ReceiptText,
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

const ITEMS_PER_PAGE = 6;

const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const WeeklyInvoiceReview: React.FC = () => {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const { shoots } = useShoots();
  const [invoices, setInvoices] = useState<WeeklyInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<WeeklyInvoice | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
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

      return Number(rawAmount || 0);
    },
    [invoiceRole, shootLookup, user],
  );

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const fetchFn = invoiceRole === 'photographer' ? fetchPhotographerInvoices : fetchSalesRepInvoices;
      const response = await fetchFn({ page: currentPage, per_page: ITEMS_PER_PAGE });
      setInvoices(response.data || []);
      setCurrentPage(response.current_page || 1);
      setLastPage(response.last_page || 1);
      setTotalInvoices(response.total || 0);
    } catch (error) {
      console.error('Failed to load weekly invoices:', error);
      toast({ title: 'Failed to load invoices', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentPage, invoiceRole, toast]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const canModify = (invoice: WeeklyInvoice) =>
    ['pending', 'rejected'].includes(invoice.approval_status) && invoice.status === 'draft';

  const canReview = (invoice: WeeklyInvoice) =>
    ['pending', 'rejected'].includes(invoice.approval_status);

  const handleRequestModification = async () => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      await rejectWeeklyInvoice(selectedInvoice.id, invoiceRole, reviewNotes.trim() || undefined);
      toast({
        title: 'Modification requested',
        description: 'Invoice status has been updated to requested modification.',
      });
      setReviewOpen(false);
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

  const handleAcceptReview = async () => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      await submitWeeklyInvoiceForApproval(selectedInvoice.id, invoiceRole, reviewNotes.trim() || undefined);
      toast({
        title: 'Invoice accepted',
        description: 'Invoice status has been updated to accepted.',
      });
      setReviewOpen(false);
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
    setReviewOpen(true);
  };

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{reviewCopy.sectionTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {reviewCopy.sectionDescription}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
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

      {invoices.map((invoice) => {
        const statusCfg = approvalStatusConfig[invoice.approval_status] || approvalStatusConfig.pending;
        const charges = (invoice.items || []).filter((i) => i.type === 'charge');
        const expenses = (invoice.items || []).filter((i) => i.type === 'expense');
        const totalCharges = charges.reduce((sum, item) => sum + getChargeDisplayAmount(invoice, item), 0);
        const totalExpenses = expenses.reduce((s, i) => s + parseFloat(String(i.total_amount || 0)), 0);
        const invoiceDisplayTotal = totalCharges + totalExpenses;
        const isExpanded = expandedInvoiceId === invoice.id;
        const reviewActionLabel = invoice.approval_status === 'pending' ? 'Review' : 'Review Response';

        return (
          <Card key={invoice.id} className="overflow-hidden rounded-2xl border border-border/70 bg-card/80">
            <CardHeader className="flex flex-col gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <button
                  type="button"
                  onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)}
                  className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                >
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Calendar className="h-4 w-4 text-primary" />
                        {formatDate(invoice.billing_period_start)} – {formatDate(invoice.billing_period_end)}
                      </CardTitle>
                      <Badge variant="outline" className={cn('flex items-center gap-1 font-medium', statusCfg.className)}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {reviewCopy.cardDescription}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-primary/80">{reviewCopy.totalLabel}</p>
                      <p className="mt-1 text-xl font-semibold">{formatCurrency(invoiceDisplayTotal)}</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {canReview(invoice) ? (
                    <Button size="sm" onClick={() => openReviewDialog(invoice)}>
                      {reviewActionLabel}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)}
                  >
                    {isExpanded ? 'Hide Details' : 'View Details'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{reviewCopy.chargeLabel}</p>
                  <p className="mt-1.5 text-base font-semibold">{formatCurrency(totalCharges)}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{reviewCopy.expenseLabel}</p>
                  <p className="mt-1.5 text-base font-semibold">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{reviewCopy.chargeCountLabel}</p>
                  <p className="mt-1.5 text-base font-semibold">{charges.length}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{reviewCopy.expenseCountLabel}</p>
                  <p className="mt-1.5 text-base font-semibold">{expenses.length}</p>
                </div>
              </div>

              {invoice.rejection_reason && invoice.approval_status === 'rejected' ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Modification Request
                  </div>
                  <p className="mt-2 text-sm text-foreground">{invoice.rejection_reason}</p>
                </div>
              ) : null}
            </CardHeader>

            {isExpanded && (
              <CardContent className="flex flex-col gap-5 p-5">
                <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold">{reviewCopy.breakdownTitle}</h4>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      {charges.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-2xl border border-border/50 bg-background/60 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{item.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {reviewCopy.breakdownItemDescription}
                            </p>
                          </div>
                          <p className="text-sm font-semibold whitespace-nowrap">
                            {formatCurrency(getChargeDisplayAmount(invoice, item))}
                          </p>
                        </div>
                      ))}
                      {charges.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
                          {reviewCopy.breakdownEmpty}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-semibold">{reviewCopy.expensesTitle}</h4>
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        {expenses.length > 0 ? (
                          expenses.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{item.description}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Expense reimbursement</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold whitespace-nowrap">
                                  +{formatCurrency(item.total_amount)}
                                </p>
                                {canModify(invoice) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                    onClick={() => handleRemoveExpense(invoice, item)}
                                    disabled={actionLoading}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
                            {reviewCopy.expensesEmpty}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Summary</p>
                      <div className="mt-3 flex flex-col gap-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Shoot lines</span>
                          <span className="font-medium">{charges.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Expense lines</span>
                          <span className="font-medium">{expenses.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Review state</span>
                          <span className="font-medium">{statusCfg.label}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between text-base font-semibold">
                          <span>Total</span>
                          <span>{formatCurrency(invoiceDisplayTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {reviewCopy.footerSummary(charges.length, expenses.length)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canModify(invoice) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setExpenseOpen(true);
                        }}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        {reviewCopy.addExpenseLabel}
                      </Button>
                    )}
                    {canReview(invoice) && (
                      <Button size="sm" onClick={() => openReviewDialog(invoice)}>
                        {reviewActionLabel}
                      </Button>
                    )}
                    {invoice.approval_status === 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResubmit(invoice)}
                        disabled={actionLoading}
                      >
                        {actionLoading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                        Accept & Resubmit
                      </Button>
                    )}
                    {['approved', 'accounts_approved'].includes(invoice.approval_status) && (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Approved - Payment Processing
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {lastPage > 1 && (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            Page {currentPage} of {lastPage} · {totalInvoices} invoice{totalInvoices === 1 ? '' : 's'}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1 || loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.min(lastPage, page + 1))}
              disabled={currentPage >= lastPage || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

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
            <Button variant="outline" onClick={handleRequestModification} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Request Modification
            </Button>
            <Button onClick={handleAcceptReview} disabled={actionLoading}>
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
