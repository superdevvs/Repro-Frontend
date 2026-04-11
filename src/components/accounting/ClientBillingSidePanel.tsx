import React, { useMemo } from 'react';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClientBillingItem, ClientBillingSummary } from '@/types/clientBilling';
import {
  formatPaymentMethod,
  getPaymentBreakdown,
  getPaymentMethodLabel,
} from '@/utils/paymentUtils';

interface ClientBillingSidePanelProps {
  items: ClientBillingItem[];
  summary: ClientBillingSummary;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function ClientBillingSidePanel({
  items,
  summary,
}: ClientBillingSidePanelProps) {
  const paymentMethods = useMemo(() => {
    const methodCounts = items
      .filter((item) => item.bucket === 'paid' && item.paymentMethod)
      .reduce((acc, item) => {
        const breakdown = getPaymentBreakdown(
          item.paymentMethod,
          item.paymentDetails,
          item.amountPaid > 0 ? item.amountPaid : item.amount,
        );
        if (breakdown.length === 0) {
          const label = getPaymentMethodLabel(item.paymentMethod);
          const method = label === 'N/A' ? 'Unknown' : label;
          acc[method] = (acc[method] || 0) + 1;
          return acc;
        }

        breakdown.forEach((entry) => {
          const label = getPaymentMethodLabel(entry.method);
          const method = label === 'N/A' ? 'Unknown' : label;
          acc[method] = (acc[method] || 0) + 1;
        });

        return acc;
      }, {} as Record<string, number>);

    return Object.entries(methodCounts)
      .map(([method, count]) => ({ method, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 4);
  }, [items]);

  const recentPayments = useMemo(
    () =>
      items
        .filter((item) => item.bucket === 'paid')
        .sort((left, right) => {
          const leftDate = new Date(left.paidAt || left.issueDate || left.dueDate || 0).getTime();
          const rightDate = new Date(right.paidAt || right.issueDate || right.dueDate || 0).getTime();
          return rightDate - leftDate;
        })
        .slice(0, 5),
    [items],
  );

  return (
    <div className="flex h-full flex-col gap-6">
      <Card className="overflow-hidden border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Billing Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="text-xs font-medium text-muted-foreground">Due now</p>
              <p className="mt-1 text-lg font-semibold">{currencyFormatter.format(summary.dueNow.amount)}</p>
            </div>
            <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-3">
              <p className="text-xs font-medium text-muted-foreground">Upcoming</p>
              <p className="mt-1 text-lg font-semibold">{currencyFormatter.format(summary.upcoming.amount)}</p>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-medium">Payment Methods</h4>
            <div className="space-y-3">
              {paymentMethods.length > 0 ? (
                paymentMethods.map(({ method, count }) => (
                  <div key={method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <p className="text-sm">{method}</p>
                    </div>
                    <p className="text-sm font-medium">
                      {count} payment{count === 1 ? '' : 's'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No payment methods recorded yet</p>
              )}
            </div>
          </div>

          {summary.paymentRequiredToReleaseCount > 0 && (
            <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-500" />
                <div>
                  <p className="text-sm font-medium">Release-blocked payments</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.paymentRequiredToReleaseCount} item
                    {summary.paymentRequiredToReleaseCount === 1 ? '' : 's'} must be paid to release delivery.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden border">
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent className="flex h-full flex-col">
          {recentPayments.length > 0 ? (
            <div className="flex-1 space-y-2 overflow-y-auto pr-2">
              {recentPayments.map((item) => {
                const paidDate = item.paidAt || item.issueDate || item.dueDate || 'N/A';
                const amount = item.amountPaid > 0 ? item.amountPaid : item.amount;
                const methodLabel = formatPaymentMethod(item.paymentMethod, item.paymentDetails);

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-md bg-muted/50 p-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.property || item.client}</p>
                      <p className="text-xs text-muted-foreground">{paidDate}</p>
                      {methodLabel !== 'N/A' && (
                        <p className="text-xs text-muted-foreground">Paid via {methodLabel}</p>
                      )}
                    </div>
                    <p className="text-sm font-medium">{currencyFormatter.format(amount)}</p>
                  </div>
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
