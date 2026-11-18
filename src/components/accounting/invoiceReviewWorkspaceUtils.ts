import { formatDistanceToNowStrict } from 'date-fns';

import type { WeeklyInvoice } from '@/services/invoiceService';
import { parseInvoiceCalendarDate } from '@/utils/invoiceCalendarDate';

export type ReviewWorkspaceTab = 'review-queue' | 'payout-report';
export type ReviewStatusFilter = 'all' | 'pending' | 'pending_approval' | 'approved' | 'accounts_approved' | 'rejected';
export type ReviewWorkspaceRole = 'photographer' | 'salesRep';

export interface InvoiceReviewWorkspaceProps {
  role?: ReviewWorkspaceRole;
  title?: string;
  shortLabel?: string;
  pluralLabel?: string;
}

export const STATUS_OPTIONS: Array<{ value: ReviewStatusFilter; label: string }> = [
  { value: 'all', label: 'All records' },
  { value: 'pending_approval', label: 'Needs review' },
  { value: 'pending', label: 'Awaiting payee' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Returned' },
];

export const formatCurrency = (amount: number | string | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount || 0));

export const formatBillingPeriod = (start?: string, end?: string) => {
  if (!start || !end) return 'Billing period unavailable';
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const startDate = parseInvoiceCalendarDate(start);
  const endDate = parseInvoiceCalendarDate(end);
  if (!startDate || !endDate) {
    return 'Billing period unavailable';
  }
  const startLabel = formatter.format(startDate);
  const endLabel = formatter.format(endDate);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
};

export const formatRelativeTimestamp = (value?: string | null) => {
  if (!value) return 'No recent activity';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No recent activity';
  return formatDistanceToNowStrict(parsed, { addSuffix: true });
};

/** Calendar date an invoice was approved by accounts, e.g. "Nov 12, 2026". Empty when not approved yet. */
export const formatApprovedDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
};

export const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending':
      return 'Awaiting Payee';
    case 'pending_approval': return 'Needs Review';
    case 'approved':
    case 'accounts_approved': return 'Accounts Approved';
    case 'rejected': return 'Returned';
    default: return status;
  }
};

export const getStatusBadgeClassName = (status: string) => {
  switch (status) {
    case 'pending':
    case 'pending_approval': return 'border-primary/20 bg-primary/10 text-primary';
    case 'approved':
    case 'accounts_approved': return 'border-border bg-secondary text-secondary-foreground';
    case 'rejected': return 'border-destructive/20 bg-destructive/10 text-destructive';
    default: return 'border-border bg-muted text-muted-foreground';
  }
};

export const getInvoiceWarnings = (invoice: WeeklyInvoice | null) => [...(invoice?.unresolved_warnings || []), ...(invoice?.payout_review?.reconciliation?.basis_warnings || [])];

const numberFromRecord = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key];
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getSalesRepCommissionSummary = (invoice: WeeklyInvoice) => {
  const snapshot = invoice.approval_snapshot;
  const metadata = (invoice.items || []).map((item) => item.meta || {});
  return {
    commissionableGross: snapshot
      ? numberFromRecord(snapshot, 'commissionable_gross') ?? 0
      : metadata.reduce((total, meta) => total + (numberFromRecord(meta, 'commissionable_gross') ?? 0), 0),
    excludedFeeTotal: snapshot
      ? numberFromRecord(snapshot, 'excluded_fees_total') ?? numberFromRecord(snapshot, 'excluded_fee_total') ?? 0
      : metadata.reduce((total, meta) => total + (numberFromRecord(meta, 'excluded_fees_total') ?? numberFromRecord(meta, 'excluded_fee_total') ?? 0), 0),
    commissionRate: snapshot
      ? numberFromRecord(snapshot, 'commission_rate')
      : numberFromRecord(metadata.find((meta) => meta.commission_rate != null), 'commission_rate'),
    commissionAmount: Number(invoice.total_amount || 0),
    isFrozen: Boolean(snapshot),
  };
};

export const buildReviewQueueExport = (invoices: WeeklyInvoice[], role: 'photographer' | 'salesRep', payeeLabel: string) => {
  const columns = [
    { key: 'payee', label: payeeLabel },
    { key: 'email', label: 'Email' },
    { key: 'period', label: 'Billing Period' },
    { key: 'status', label: 'Status' },
    { key: 'shoots', label: 'Shoots' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'total', label: 'Total' },
    { key: 'approvedOn', label: 'Approved On' },
    { key: 'approvedBy', label: 'Approved By' },
    { key: 'updated', label: 'Last Updated' },
  ] as const;
  const rows = invoices.map((invoice) => ({
    payee: role === 'salesRep' ? invoice.salesRep?.name || 'Sales Rep' : invoice.photographer?.name || 'Photographer',
    email: role === 'salesRep' ? invoice.salesRep?.email || '' : invoice.photographer?.email || '',
    period: formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end),
    status: getStatusLabel(invoice.approval_status),
    shoots: invoice.shoot_count || 0,
    expenses: invoice.expense_count || 0,
    total: formatCurrency(invoice.total_amount),
    approvedOn: formatApprovedDate(invoice.approved_at),
    approvedBy: invoice.approved_at ? invoice.approvedBy?.name || '' : '',
    updated: formatRelativeTimestamp(invoice.last_activity_at),
  }));
  return { columns, rows };
};
