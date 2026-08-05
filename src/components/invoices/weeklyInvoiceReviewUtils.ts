import { createElement, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export const ITEMS_PER_PAGE = 4;
export const FETCH_PAGE_SIZE = 100;

export const approvalStatusConfig: Record<
  string,
  { label: string; className: string; icon: ReactNode }
> = {
  pending: {
    label: 'Pending Review',
    className: 'border-primary/20 bg-primary/10 text-primary',
    icon: createElement(Clock, { className: 'h-3 w-3' }),
  },
  pending_approval: {
    label: 'Accepted',
    className: 'border-border bg-secondary text-secondary-foreground',
    icon: createElement(CheckCircle, { className: 'h-3 w-3' }),
  },
  approved: {
    label: 'Approved',
    className: 'border-border bg-secondary text-secondary-foreground',
    icon: createElement(CheckCircle, { className: 'h-3 w-3' }),
  },
  accounts_approved: {
    label: 'Accounts Approved',
    className: 'border-border bg-secondary text-secondary-foreground',
    icon: createElement(CheckCircle, { className: 'h-3 w-3' }),
  },
  rejected: {
    label: 'Requested for Modification',
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
    icon: createElement(AlertTriangle, { className: 'h-3 w-3' }),
  },
};

export const formatWeeklyInvoiceCurrency = (amount: number | string) => {
  const number = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number || 0);
};

export const formatWeeklyInvoiceDate = (date: string) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatWeeklyBillingPeriod = (start: string, end: string): string => {
  if (!start && !end) return 'N/A';
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const sameDay = startDate && endDate
    && Math.abs(endDate.getTime() - startDate.getTime()) < 1000 * 60 * 60 * 24;
  let weekStart: Date | null = startDate;
  let weekEnd: Date | null = endDate;
  if (sameDay && startDate) {
    weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() - startDate.getDay());
    weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
  }
  if (!weekStart) return formatWeeklyInvoiceDate(end);
  if (!weekEnd) return formatWeeklyInvoiceDate(start);
  if (weekStart.getFullYear() === weekEnd.getFullYear()) {
    const startShort = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startShort} – ${formatWeeklyInvoiceDate(weekEnd.toISOString())}`;
  }
  return `${formatWeeklyInvoiceDate(weekStart.toISOString())} – ${formatWeeklyInvoiceDate(weekEnd.toISOString())}`;
};

export const getWeeklyInvoiceReviewCopy = (role: 'photographer' | 'salesRep') => role === 'salesRep'
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
