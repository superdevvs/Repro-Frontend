import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { InvoiceData } from '@/utils/invoiceUtils';
import { ArrowUpRight, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentsSummaryProps {
  invoices: InvoiceData[];
}

export function PaymentsSummary({ invoices }: PaymentsSummaryProps) {
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const paymentPercentage = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  // const totalPaidd = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);

  const paymentMethods = invoices
    .filter(i => i.status === 'paid' && i.paymentMethod)
    .reduce((acc, i) => {
      const method = i.paymentMethod || 'Unknown';
      acc[method] = (acc[method] || 0) + i.amount;
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

  const latestTransactions = invoices
    .filter(i => i.status === 'paid')
    .slice(0, 15);

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
          {latestTransactions.map((invoice) => (
            <div
              key={invoice.id}
              className="flex justify-between items-center p-2 rounded-md bg-muted/50"
            >
              <div>
                <p className="text-sm font-medium">{invoice.client}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{invoice.date}</p>
              </div>
              <p className="text-sm font-medium">
                ${invoice.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">No recent payments</p>
      )}
    </CardContent>
  </Card>
</div>

  );
}
