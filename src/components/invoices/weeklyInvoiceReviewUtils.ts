import { createElement, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

import type { WeeklyInvoice } from '@/services/invoiceService';
import {
  filterInvoiceItemsByDate,
  parseInvoiceDateInput,
  type InvoiceDateFilter,
} from '@/utils/invoiceDateFilters';

export const ITEMS_PER_PAGE = 4;
export const FETCH_PAGE_SIZE = 100;

export type WeeklyInvoiceRole = 'photographer' | 'salesRep';

export interface WeeklyInvoicePage {
  data: WeeklyInvoice[];
  current_page: number;
  last_page: number;
  total: number;
}

export type WeeklyInvoicePageFetcher = (params: {
  page?: number;
  per_page?: number;
}) => Promise<WeeklyInvoicePage>;

export type WeeklyInvoiceExportRow = {
  week: string;
  status: string;
  total: string;
  charges: string;
  expenses: string;
  notes: string;
};

export const WEEKLY_INVOICE_EXPORT_COLUMNS = [
  { key: 'week', label: 'Week' },
  { key: 'status', label: 'Status' },
  { key: 'total', label: 'Total' },
  { key: 'charges', label: 'Charges' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'notes', label: 'Notes' },
] as const;

/** Accept every role spelling used by auth payloads and older API records. */
export const normalizeWeeklyInvoiceRole = (role: unknown): WeeklyInvoiceRole => {
  const normalized = String(role ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  return ['rep', 'representative', 'salesrep', 'salesrepresentative'].includes(normalized)
    ? 'salesRep'
    : 'photographer';
};

/** Load the complete server result even when the endpoint caps each response. */
export const fetchAllWeeklyInvoicePages = async (
  fetchPage: WeeklyInvoicePageFetcher,
  pageSize = FETCH_PAGE_SIZE,
): Promise<WeeklyInvoice[]> => {
  const invoices: WeeklyInvoice[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await fetchPage({ page, per_page: pageSize });
    invoices.push(...(response.data || []));

    const declaredLastPage = Number(response.last_page) || 1;
    const totalBasedLastPage = response.total > 0
      ? Math.ceil(response.total / pageSize)
      : 1;
    lastPage = Math.max(lastPage, declaredLastPage, totalBasedLastPage);
    page += 1;
  } while (page <= lastPage);

  const seen = new Set<number>();
  return invoices.filter((invoice) => {
    if (seen.has(invoice.id)) return false;
    seen.add(invoice.id);
    return true;
  });
};

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
    label: 'Awaiting Admin Review',
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
    label: 'Returned by Admin',
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
  const parsed = parseInvoiceDateInput(date);
  if (!parsed) return 'N/A';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatWeeklyBillingPeriod = (start: string, end: string): string => {
  if (!start && !end) return 'N/A';
  const startDate = parseInvoiceDateInput(start);
  const endDate = parseInvoiceDateInput(end);
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

export const getWeeklyInvoiceChargeTotal = (invoice: WeeklyInvoice): number =>
  (invoice.items || [])
    .filter((item) => item.type === 'charge')
    .reduce((sum, item) => sum + Number.parseFloat(String(item.total_amount ?? 0)), 0);

/** Prefer the immutable server total, with a line-item fallback for old payloads. */
export const getWeeklyInvoiceTotal = (invoice: WeeklyInvoice): number => {
  const recorded = Number.parseFloat(String(invoice.total_amount ?? ''));
  if (Number.isFinite(recorded) && recorded !== 0) return recorded;

  return (invoice.items || []).reduce(
    (sum, item) => sum + Number.parseFloat(String(item.total_amount ?? 0)),
    0,
  );
};

export const getWeeklyInvoiceAggregateStats = (invoices: readonly WeeklyInvoice[]) =>
  invoices.reduce(
    (stats, invoice) => {
      const charges = (invoice.items || []).filter((item) => item.type === 'charge');
      const expenses = (invoice.items || []).filter((item) => item.type === 'expense');

      stats.totalAmount += getWeeklyInvoiceTotal(invoice);
      stats.totalShoots += charges.length;
      stats.totalExpensesAmount += expenses.reduce(
        (sum, item) => sum + Number.parseFloat(String(item.total_amount || 0)),
        0,
      );
      if (invoice.approval_status === 'pending') stats.pendingReviewCount += 1;
      return stats;
    },
    { totalAmount: 0, totalShoots: 0, totalExpensesAmount: 0, pendingReviewCount: 0 },
  );

export const filterWeeklyInvoicesByDate = (
  invoices: readonly WeeklyInvoice[],
  filter: InvoiceDateFilter,
  now: Date = new Date(),
): WeeklyInvoice[] => filterInvoiceItemsByDate(
  invoices,
  filter,
  (invoice) => ({
    startDate: invoice.billing_period_start,
    endDate: invoice.billing_period_end,
  }),
  now,
);

/** Selected filtered invoices take precedence; otherwise export every result. */
export const getWeeklyInvoiceExportScope = (
  filteredInvoices: readonly WeeklyInvoice[],
  selectedIds: ReadonlySet<number>,
): WeeklyInvoice[] => {
  const selected = filteredInvoices.filter((invoice) => selectedIds.has(invoice.id));
  return selected.length > 0 ? selected : [...filteredInvoices];
};

export const buildWeeklyInvoiceExportRows = (
  invoices: readonly WeeklyInvoice[],
): WeeklyInvoiceExportRow[] => invoices.map((invoice) => ({
  week: `${formatWeeklyInvoiceDate(invoice.billing_period_start)} - ${formatWeeklyInvoiceDate(invoice.billing_period_end)}`,
  status: approvalStatusConfig[invoice.approval_status || 'pending']?.label || invoice.approval_status,
  total: formatWeeklyInvoiceCurrency(getWeeklyInvoiceTotal(invoice)),
  charges: String(invoice.charge_count ?? (invoice.items || []).filter((item) => item.type === 'charge').length),
  expenses: String(invoice.expense_count ?? (invoice.items || []).filter((item) => item.type === 'expense').length),
  notes: invoice.modification_notes || invoice.rejection_reason || '',
}));

export const getWeeklyInvoiceReviewCopy = (role: WeeklyInvoiceRole) => role === 'salesRep'
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
      reviewDialogDescription: 'Approve the commission summary as-is, or edit it and submit a short change summary. Either action sends it to the admin review queue.',
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
      reviewDialogDescription: 'Approve the invoice as-is, or edit it and submit a short change summary. Either action sends it to the admin review queue.',
      reviewNotesPlaceholder: 'Add an optional note for this review...',
      addExpenseDialogTitle: 'Add Expense',
      addExpenseDialogDescription: 'Add an expense item to this invoice (e.g., mileage, equipment rental).',
      fileName: 'photographer-weekly-invoices',
      pdfTitle: 'Weekly Invoice Report',
    };
