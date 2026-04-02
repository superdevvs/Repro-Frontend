import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { InvoiceData } from '@/utils/invoiceUtils';
import { ArrowUpRight, ChevronDown, ChevronUp, CreditCard, Clock, TrendingUp, Calendar, Users, DollarSign, CheckCircle2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountingMode } from '@/config/accountingConfig';
import { useAuth } from '@/components/auth/AuthProvider';
import { formatPaymentMethod, getPaymentMethodLabel } from '@/utils/paymentUtils';
import {
  EarningsTimeFilter,
  getEarningsDateRange,
  getEarningsPeriodLabel,
  getPhotographerPayForShoot,
  getPhotographerPayoutStatus,
  getShootCompletedDate,
  getShootScheduledDate,
  isDateInRange,
  isCompletedShoot,
  isShootAssignedToPhotographer,
} from './photographerEarningsUtils';

interface RoleBasedSidePanelProps {
  invoices: InvoiceData[];
  mode: AccountingMode;
  shoots?: any[];
  editingJobs?: any[];
  timeFilter?: EarningsTimeFilter;
}

const getInvoicePaymentInfo = (invoice: InvoiceData) => {
  const legacyInvoice = invoice as InvoiceData & Record<string, unknown>;
  const method =
    invoice.paymentMethod ||
    (typeof legacyInvoice.payment_method === 'string' ? legacyInvoice.payment_method : undefined) ||
    (typeof legacyInvoice.paymentType === 'string' ? legacyInvoice.paymentType : undefined) ||
    (typeof legacyInvoice.payment_type === 'string' ? legacyInvoice.payment_type : undefined) ||
    undefined;
  const details =
    invoice.paymentDetails ||
    (legacyInvoice.payment_details as Record<string, unknown> | undefined) ||
    undefined;
  const paidAt =
    invoice.paidAt ||
    (typeof legacyInvoice.paid_at === 'string' ? legacyInvoice.paid_at : undefined) ||
    invoice.date ||
    undefined;

  return { method, details, paidAt };
};

const formatTransactionDate = (value?: string) => {
  if (!value) return 'Unknown date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
};

const formatTransactionTime = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
};

const getInvoiceMetaValue = (invoice: InvoiceData, keys: string[]) => {
  const legacyInvoice = invoice as InvoiceData & Record<string, unknown>;

  for (const key of keys) {
    const rootValue = legacyInvoice[key];
    if (rootValue != null && rootValue !== '') {
      return String(rootValue);
    }

    const details = getInvoicePaymentInfo(invoice).details;
    if (details && typeof details === 'object' && key in details) {
      const detailValue = details[key];
      if (detailValue != null && detailValue !== '') {
        return String(detailValue);
      }
    }
  }

  return null;
};

const getTransactionDetailRows = (invoice: InvoiceData) => {
  const { method, details, paidAt } = getInvoicePaymentInfo(invoice);
  const methodLabel = formatPaymentMethod(method, details);
  const property = invoice.property || getInvoiceMetaValue(invoice, ['property_address', 'address']);
  const invoiceNumber = invoice.number || invoice.invoiceNumber || String(invoice.id);
  const transactionId = getInvoiceMetaValue(invoice, ['transaction_id', 'transactionId', 'payment_intent', 'paymentIntent']);
  const ipAddress = getInvoiceMetaValue(invoice, ['ip', 'ip_address', 'customer_ip', 'customerIp']);
  const checkNumber = getInvoiceMetaValue(invoice, ['check_number']);
  const paidTime = formatTransactionTime(paidAt);

  return [
    { label: 'Invoice', value: invoiceNumber ? `#${invoiceNumber}` : null },
    { label: 'Property', value: property || null },
    { label: 'Paid on', value: formatTransactionDate(paidAt) },
    { label: 'Time', value: paidTime },
    { label: 'Method', value: methodLabel !== 'N/A' ? methodLabel : 'Unavailable' },
    { label: 'Transaction ID', value: transactionId },
    { label: 'IP', value: ipAddress },
    { label: 'Check #', value: checkNumber },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));
};

export function RoleBasedSidePanel({ 
  invoices, 
  mode,
  shoots = [],
  editingJobs = [],
  timeFilter = 'month',
}: RoleBasedSidePanelProps) {
  const { user } = useAuth();

  // For admin mode, use the original PaymentsSummary
  if (mode === 'admin') {
    return <AdminPaymentsSummary invoices={invoices} />;
  }

  // For client mode, show payment methods and recent payments
  if (mode === 'client') {
    return <ClientSidePanel invoices={invoices} user={user} />;
  }

  // For photographer mode, show payout status and upcoming shoots
  if (mode === 'photographer') {
    return <PhotographerSidePanel shoots={shoots} user={user} timeFilter={timeFilter} />;
  }

  // For editor mode, show jobs in progress and turnaround performance
  if (mode === 'editor') {
    return <EditorSidePanel editingJobs={editingJobs} user={user} />;
  }

  // For rep mode, show top clients and pipeline snapshot
  if (mode === 'rep') {
    return <RepSidePanel invoices={invoices} user={user} />;
  }

  return null;
}

// Admin Payments Summary (original component)
function AdminPaymentsSummary({ invoices }: { invoices: InvoiceData[] }) {
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const paymentPercentage = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);

  const paymentMethods = invoices
    .filter(i => i.status === 'paid' && Boolean(getInvoicePaymentInfo(i).method))
    .reduce((acc, i) => {
      const { method } = getInvoicePaymentInfo(i);
      const label = getPaymentMethodLabel(method);
      const methodName = label === 'N/A' ? 'Unknown' : label;
      acc[methodName] = (acc[methodName] || 0) + i.amount;
      return acc;
    }, {} as Record<string, number>);

  const paymentMethodsArray = Object.entries(paymentMethods)
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  const getTrendColor = (percentage: number) => {
    if (percentage >= 70) return 'text-emerald-500';
    if (percentage >= 40) return 'text-amber-500';
    return 'text-rose-500';
  };

  const latestTransactions = useMemo(
    () =>
      invoices
        .filter(i => i.status === 'paid')
        .sort((a, b) => {
          const aDate = getInvoicePaymentInfo(a).paidAt;
          const bDate = getInvoicePaymentInfo(b).paidAt;
          return new Date(String(bDate || '')).getTime() - new Date(String(aDate || '')).getTime();
        })
        .slice(0, 15),
    [invoices],
  );

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card className="overflow-hidden border flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payments Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-sm font-medium">Payment Rate</p>
                  <p className="text-xs text-muted-foreground">
                    {paymentPercentage}% of invoices paid
                  </p>
                </div>
                <div className={cn("flex items-center gap-1 text-sm font-medium", getTrendColor(paymentPercentage))}>
                  {paymentPercentage}%
                  <ArrowUpRight className="h-3 w-3" />
                </div>
              </div>
              <Progress value={paymentPercentage} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Paid</h4>
                <p className="text-xl font-semibold">${totalPaid.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20">
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Overdue</h4>
                <p className="text-xl font-semibold">${totalOverdue.toLocaleString()}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">Payment Methods</h4>
              <div className="space-y-3">
                {paymentMethodsArray.length > 0 ? (
                  paymentMethodsArray.map(({ method, amount }) => (
                    <div key={method} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary"></div>
                        <p className="text-sm">{method}</p>
                      </div>
                      <p className="text-sm font-medium">${amount.toLocaleString()}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No payment data available</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border overflow-hidden flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Latest Transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          {latestTransactions.length > 0 ? (
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {latestTransactions.map((invoice) => {
                const { method, details, paidAt } = getInvoicePaymentInfo(invoice);
                const methodLabel = formatPaymentMethod(method, details);
                const isExpanded = expandedInvoiceId === String(invoice.id);
                const detailRows = getTransactionDetailRows(invoice);
                return (
                  <button
                    key={invoice.id}
                    type="button"
                    onClick={() => setExpandedInvoiceId(isExpanded ? null : String(invoice.id))}
                    className="w-full rounded-md bg-muted/50 p-3 text-left transition-colors hover:bg-muted/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{invoice.client}</p>
                        <p className="text-xs text-muted-foreground">{formatTransactionDate(paidAt)}</p>
                        <p className="text-xs text-muted-foreground">
                          {methodLabel !== 'N/A' ? `Paid via ${methodLabel}` : 'Payment method unavailable'}
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-medium">${invoice.amount.toLocaleString()}</p>
                        {isExpanded ? (
                          <ChevronUp className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:grid-cols-2">
                        {detailRows.map((row) => (
                          <div key={row.label}>
                            <span className="font-medium text-foreground/80">{row.label}: </span>
                            <span>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent payments</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Client Side Panel
function ClientSidePanel({ invoices, user }: { invoices: InvoiceData[]; user: any }) {
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const userId = user?.id != null ? String(user.id) : null;
  const userName = String(user?.name || '').trim().toLowerCase();
  const myInvoices = invoices.filter((i) => {
    const invoiceClientId = i.client_id != null ? String(i.client_id) : null;
    if (userId && invoiceClientId) {
      return invoiceClientId === userId;
    }
    const invoiceClientName = String(i.client || '').trim().toLowerCase();
    return Boolean(userName && invoiceClientName && invoiceClientName === userName);
  });
  const paidInvoices = myInvoices.filter(i => i.status === 'paid');

  const getInvoicePaymentInfo = (invoice: InvoiceData) => {
    const method =
      invoice.paymentMethod ||
      (invoice as any).payment_method ||
      (invoice as any).paymentType ||
      (invoice as any).payment_type ||
      undefined;
    const details =
      invoice.paymentDetails ||
      (invoice as any).payment_details ||
      (invoice as any).paymentDetails ||
      undefined;
    return { method, details };
  };
  
  const paymentMethods = paidInvoices
    .filter(i => Boolean(getInvoicePaymentInfo(i).method))
    .reduce((acc, i) => {
      const { method } = getInvoicePaymentInfo(i);
      const label = getPaymentMethodLabel(method);
      const methodLabel = label === 'N/A' ? 'Unknown' : label;
      acc[methodLabel] = (acc[methodLabel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const paymentMethodsArray = Object.entries(paymentMethods)
    .map(([method, count]) => ({ method, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const recentPayments = paidInvoices
    .sort((a, b) => {
      const aDate = a.paidAt || (a as any).paid_at || a.date;
      const bDate = b.paidAt || (b as any).paid_at || b.date;
      return new Date(String(bDate)).getTime() - new Date(String(aDate)).getTime();
    })
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card className="overflow-hidden border flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {paymentMethodsArray.length > 0 ? (
              paymentMethodsArray.map(({ method, count }) => (
                <div key={method} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary"></div>
                    <p className="text-sm">{method}</p>
                  </div>
                  <p className="text-sm font-medium">{count} payment{count !== 1 ? 's' : ''}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No payment methods on file</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border overflow-hidden flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          {recentPayments.length > 0 ? (
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {recentPayments.map((invoice) => {
                const { method, details } = getInvoicePaymentInfo(invoice);
                const methodLabel = formatPaymentMethod(method, details);
                const paidDate = invoice.paidAt || (invoice as any).paid_at || invoice.date;
                const isExpanded = expandedInvoiceId === String(invoice.id);
                const detailRows = getTransactionDetailRows(invoice);
                return (
                  <button
                    key={invoice.id}
                    type="button"
                    onClick={() => setExpandedInvoiceId(isExpanded ? null : String(invoice.id))}
                    className="w-full rounded-md bg-muted/50 p-3 text-left transition-colors hover:bg-muted/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{invoice.property || invoice.client}</p>
                        <p className="text-xs text-muted-foreground">{formatTransactionDate(String(paidDate || ''))}</p>
                        <p className="text-xs text-muted-foreground">
                          {methodLabel !== 'N/A' ? `Paid via ${methodLabel}` : 'Payment method unavailable'}
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-medium">${invoice.amount.toLocaleString()}</p>
                        {isExpanded ? (
                          <ChevronUp className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:grid-cols-2">
                        {detailRows.map((row) => (
                          <div key={row.label}>
                            <span className="font-medium text-foreground/80">{row.label}: </span>
                            <span>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent payments</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Photographer Side Panel
function PhotographerSidePanel({
  shoots,
  user,
  timeFilter,
}: {
  shoots: any[];
  user: any;
  timeFilter: EarningsTimeFilter;
}) {
  const myShoots = shoots.filter((shoot: any) => isShootAssignedToPhotographer(shoot, user));
  const completedShoots = myShoots.filter(isCompletedShoot);
  const currentRange = getEarningsDateRange(timeFilter);
  const periodLabel = getEarningsPeriodLabel(timeFilter);

  const recentCompletedShoots = completedShoots
    .filter((shoot: any) => isDateInRange(getShootCompletedDate(shoot), currentRange))
    .sort((a: any, b: any) => {
      const dateA = getShootCompletedDate(a)?.getTime() ?? 0;
      const dateB = getShootCompletedDate(b)?.getTime() ?? 0;
      return dateB - dateA;
    })
    .slice(0, 6);

  return (
    <Card className="border overflow-hidden flex-1 flex flex-col min-h-[520px]">
      <CardHeader className="gap-3 border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <TrendingUp className="h-5 w-5 text-primary" />
              Recent Shoot Earnings
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Completed shoots in {periodLabel.toLowerCase()} with photographer pay and payout status.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-right">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/80">
              {periodLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {recentCompletedShoots.length} shoot{recentCompletedShoots.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Visible Here</p>
            <p className="mt-2 text-sm font-semibold">Completed shoots only</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ordering</p>
            <p className="mt-2 text-sm font-semibold">Latest completion first</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Coverage</p>
            <p className="mt-2 text-sm font-semibold">Paid and pending payouts</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <div className="flex h-full flex-col">
          {recentCompletedShoots.length > 0 ? (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
              {recentCompletedShoots.map((shoot: any) => {
                const completedDate = getShootCompletedDate(shoot);
                const scheduledDate = getShootScheduledDate(shoot);
                const payoutStatus = getPhotographerPayoutStatus(shoot);
                const pay = getPhotographerPayForShoot(shoot, user);
                const isPaid = payoutStatus === 'paid';
                const address =
                  shoot.location?.address ||
                  shoot.location?.fullAddress ||
                  'Shoot';

                return (
                  <div
                    key={shoot.id}
                    className={cn(
                      'rounded-2xl border p-4 transition-colors',
                      isPaid
                        ? 'border-emerald-500/15 bg-emerald-500/5'
                        : 'border-amber-500/15 bg-amber-500/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              'mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full',
                              isPaid ? 'bg-emerald-500' : 'bg-amber-500',
                            )}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {address}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {completedDate
                                  ? `Completed ${formatTransactionDate(completedDate.toISOString())}`
                                  : scheduledDate
                                  ? `Scheduled ${formatTransactionDate(scheduledDate.toISOString())}`
                                  : 'Date unavailable'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {(shoot.location?.city && shoot.location?.state)
                                  ? `${shoot.location.city}, ${shoot.location.state}`
                                  : 'Location unavailable'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">${pay.toLocaleString()}</p>
                        <div
                          className={cn(
                            'mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-amber-500/10 text-amber-500',
                          )}
                        >
                          {isPaid ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {isPaid ? 'Paid' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-5">
              <div className="w-full rounded-3xl border border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center">
                <DollarSign className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-semibold">No completed shoots in {periodLabel.toLowerCase()}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Recent earnings will appear here as soon as completed shoots fall into the selected time range.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Editor Side Panel
function EditorSidePanel({ editingJobs, user }: { editingJobs: any[]; user: any }) {
  // Jobs in progress and turnaround time have been removed per user request
  return null;
}

// Rep Side Panel
function RepSidePanel({ invoices, user }: { invoices: InvoiceData[]; user: any }) {
  // Filter invoices for clients assigned to this rep
  const myClientInvoices = invoices; // Placeholder - would filter by rep_id
  
  const clientRevenue = myClientInvoices
    .filter(i => i.status === 'paid')
    .reduce((acc, i) => {
      const client = i.client;
      acc[client] = (acc[client] || 0) + i.amount;
      return acc;
    }, {} as Record<string, number>);

  const topClients = Object.entries(clientRevenue)
    .map(([client, revenue]) => ({ client, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card className="overflow-hidden border flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Top Clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topClients.length > 0 ? (
              topClients.map(({ client, revenue }, index) => (
                <div key={client} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <p className="text-sm">{client}</p>
                  </div>
                  <p className="text-sm font-medium">${revenue.toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No client data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border overflow-hidden flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Pipeline Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
              <h4 className="text-xs font-medium text-muted-foreground mb-1">New Leads</h4>
              <p className="text-2xl font-semibold">0</p>
            </div>
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Opportunities</h4>
              <p className="text-2xl font-semibold">0</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
