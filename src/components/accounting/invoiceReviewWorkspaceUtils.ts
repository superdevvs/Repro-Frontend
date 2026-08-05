import { formatDistanceToNowStrict } from 'date-fns';

import type { WeeklyInvoice } from '@/services/invoiceService';

export type ReviewWorkspaceTab = 'review-queue' | 'payout-report';
export type ReviewStatusFilter = 'pending_approval' | 'approved' | 'accounts_approved' | 'rejected';
export type ReviewWorkspaceRole = 'photographer' | 'salesRep';

export interface InvoiceReviewWorkspaceProps {
  role?: ReviewWorkspaceRole;
  title?: string;
  shortLabel?: string;
  pluralLabel?: string;
}

export const STATUS_OPTIONS: Array<{ value: ReviewStatusFilter; label: string }> = [
  { value: 'pending_approval', label: 'Needs review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Returned' },
];

export const formatCurrency = (amount: number | string | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount || 0));

export const formatBillingPeriod = (start?: string, end?: string) => {
  if (!start || !end) return 'Billing period unavailable';
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
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

export const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending':
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

export const getInvoiceWarnings = (invoice: WeeklyInvoice | null) => invoice?.unresolved_warnings || [];
