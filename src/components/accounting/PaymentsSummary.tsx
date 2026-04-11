import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { InvoiceData } from '@/utils/invoiceUtils';
import { ArrowUpRight, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatPaymentBreakdown,
  formatPaymentMethod,
  getPaymentBreakdown,
  getPaymentMethodLabel,
} from '@/utils/paymentUtils';

interface PaymentsSummaryProps {
  invoices: InvoiceData[];
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

const getInvoicePaidAmount = (invoice: InvoiceData) =>
  invoice.amountPaid && invoice.amountPaid > 0 ? invoice.amountPaid : invoice.amount;

const getTransactionDetailRows = (invoice: InvoiceData) => {
  const { method, details, paidAt } = getInvoicePaymentInfo(invoice);
  const methodLabel = formatPaymentMethod(method, details);
  const paymentBreakdown = formatPaymentBreakdown(method, details, getInvoicePaidAmount(invoice));
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
    { label: 'Breakdown', value: paymentBreakdown },
    { label: 'Transaction ID', value: transactionId },
    { label: 'IP', value: ipAddress },
    { label: 'Check #', value: checkNumber },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));
};

export function PaymentsSummary({ invoices }: PaymentsSummaryProps) {
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const paymentPercentage = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  // const totalPaidd = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);

  const paymentMethods = invoices
    .filter(i => i.status === 'paid' && Boolean(getInvoicePaymentInfo(i).method))
    .reduce((acc, i) => {
      const { method, details } = getInvoicePaymentInfo(i);
      const breakdown = getPaymentBreakdown(method, details, getInvoicePaidAmount(i));
      if (breakdown.length === 0) {
        const label = getPaymentMethodLabel(method);
        const methodName = label === 'N/A' ? 'Unknown' : label;
        acc[methodName] = (acc[methodName] || 0) + getInvoicePaidAmount(i);
        return acc;
      }

      breakdown.forEach((entry) => {
        const label = getPaymentMethodLabel(entry.method);
        const methodName = label === 'N/A' ? 'Unknown' : label;
        acc[methodName] = (acc[methodName] || 0) + entry.amount;
      });

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
    <div className="flex flex-col gap-3 h-full">
  {/* 🧾 Payments Summary */}
  <Card className="overflow-hidden border flex-shrink-0 min-h-fit">
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" />
        Payments Summary
      </CardTitle>
    </CardHeader>

    <CardContent>
      <div className="space-y-6">
        {/* Payment Rate */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="text-sm font-medium">Payment Rate</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {paymentPercentage}% of invoices paid
              </p>
            </div>
            <div
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                getTrendColor(paymentPercentage)
              )}
            >
              {paymentPercentage}%
              <ArrowUpRight className="h-3 w-3" />
            </div>
          </div>
          <Progress value={paymentPercentage} className="h-2" />
        </div>

        {/* Paid & Overdue */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
            <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Paid
            </h4>
            <p className="text-xl font-semibold">
              ${totalPaid.toLocaleString()}
            </p>
          </div>

          <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20">
            <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Overdue
            </h4>
            <p className="text-xl font-semibold">
              ${totalOverdue.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Payment Methods */}
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
                  <p className="text-sm font-medium">
                    ${amount.toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No payment data available
              </p>
            )}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* 💳 Latest Transactions */}
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
                    <p className="text-xs text-slate-600 dark:text-slate-400">{formatTransactionDate(paidAt)}</p>
                    <p className="text-xs text-slate-500">
                      {methodLabel !== 'N/A' ? `Paid via ${methodLabel}` : 'Payment method unavailable'}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-medium">
                      ${getInvoicePaidAmount(invoice).toLocaleString()}
                    </p>
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
              <p className="text-sm text-slate-600 dark:text-slate-400">No recent payments</p>
      )}
    </CardContent>
  </Card>
</div>

  );
}
