import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { CreditCard, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ClientBillingItem, ClientBillingSummary } from '@/types/clientBilling';
import { formatPaymentMethod, getPaymentBreakdown, getPaymentMethodLabel } from '@/utils/paymentUtils';
import { clientBillingCurrency, clientBillingDate, clientBillingPaidValue } from './clientBillingPresentation';

interface ClientBillingSidePanelProps {
  items: ClientBillingItem[];
  summary: ClientBillingSummary;
  onView?: (item: ClientBillingItem) => void;
}

export function ClientBillingSidePanel({ items, onView }: ClientBillingSidePanelProps) {
  const paymentMethods = useMemo(() => {
    const counts = items.filter((item) => item.bucket === 'paid' && item.paymentMethod).reduce((acc, item) => {
      const breakdown = getPaymentBreakdown(item.paymentMethod, item.paymentDetails, clientBillingPaidValue(item));
      const methods = breakdown.length ? breakdown.map((entry) => entry.method) : [item.paymentMethod];
      methods.forEach((method) => {
        const label = getPaymentMethodLabel(method);
        const name = label === 'N/A' ? 'Unknown' : label;
        acc[name] = (acc[name] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).sort((left, right) => right[1] - left[1]).slice(0, 4);
  }, [items]);
  const recentPayments = useMemo(() => items.filter((item) => item.bucket === 'paid')
    .sort((left, right) => (clientBillingDate(right)?.getTime() || 0) - (clientBillingDate(left)?.getTime() || 0)).slice(0, 5), [items]);
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">Payment activity</h2><p className="mt-0.5 text-xs text-muted-foreground">Your latest completed payments</p></div>
      <Tabs defaultValue="recent" className="min-w-0">
        <TabsList className="mx-3 mt-3 h-auto max-w-[calc(100%-1.5rem)] flex-wrap">
          <TabsTrigger className="text-xs" value="recent">Recent payments</TabsTrigger>
          <TabsTrigger className="text-xs" value="methods">Payment methods</TabsTrigger>
        </TabsList>
        <TabsContent value="recent" className="m-0 max-h-[265px] overflow-y-auto overscroll-auto p-3">
          {recentPayments.length ? recentPayments.map((item) => {
            const date = clientBillingDate(item);
            const method = formatPaymentMethod(item.paymentMethod, item.paymentDetails);
            const content = <><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.property || item.client || item.number || 'Payment'}</p><p className="mt-1 text-xs text-muted-foreground">{date ? format(date, 'MMM d, yyyy') : 'Date unavailable'}{method !== 'N/A' ? ` · ${method}` : ''}</p></div><span className="shrink-0 text-sm font-semibold tabular-nums">{clientBillingCurrency.format(clientBillingPaidValue(item))}</span>{onView && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}</>;
            const className = 'flex w-full items-center gap-2 border-b p-2 text-left last:border-0';
            return onView ? <button key={item.id} onClick={() => onView(item)} className={`${className} rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} aria-label={`View payment ${item.number || item.id}`}>{content}</button> : <div key={item.id} className={className}>{content}</div>;
          }) : <p className="py-12 text-center text-sm text-muted-foreground">No recent payments</p>}
        </TabsContent>
        <TabsContent value="methods" className="m-0 max-h-[265px] overflow-y-auto overscroll-auto p-4">
          {paymentMethods.length ? <>{paymentMethods.map(([method, count]) => <div key={method} className="flex items-center justify-between gap-2 border-b py-3 text-sm last:border-0"><span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" />{method}</span><span className="text-xs text-muted-foreground">{count} payment{count === 1 ? '' : 's'}</span></div>)}<p className="mt-3 text-xs text-muted-foreground">Recorded methods. Split payments can include more than one method.</p></> : <p className="py-12 text-center text-sm text-muted-foreground">No payment methods recorded yet</p>}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
