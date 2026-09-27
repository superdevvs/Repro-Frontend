import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import type { ClientBillingItem, ClientBillingSummary } from '@/types/clientBilling';
import { clientBillingCurrency, getClientBillingPaidMetrics } from './clientBillingPresentation';

interface ClientBillingOverviewCardsProps {
  summary: ClientBillingSummary;
  items: ClientBillingItem[];
  daysWindow?: number;
  paidDateRange?: { startDate: string; endDate: string };
}

export function ClientBillingOverviewCards({ summary, items, daysWindow = 30, paidDateRange }: ClientBillingOverviewCardsProps) {
  const metrics = useMemo(() => getClientBillingPaidMetrics(items, paidDateRange, daysWindow), [items, paidDateRange, daysWindow]);
  const cards = [
    { title: 'Outstanding balance', value: summary.dueNow.amount, note: `${summary.dueNow.count} due now · current balance` },
    { title: paidDateRange ? 'Paid in selected period' : `Paid in last ${daysWindow} days`, value: metrics.paidInRange, note: `${metrics.paidCount} completed payment${metrics.paidCount === 1 ? '' : 's'}` },
    { title: `Total spend · ${new Date().getFullYear()}`, value: metrics.annualSpend, note: 'Completed payments this calendar year' },
    { title: 'Upcoming charges', value: summary.upcoming.amount, note: `${summary.upcoming.count} upcoming · current balance` },
  ];
  return (
    <Card className="grid min-w-0 grid-cols-2 overflow-hidden xl:grid-cols-4">
      {cards.map((card, index) => (
        <section key={card.title} aria-label={card.title} className={`min-w-0 p-3 sm:p-5 ${index === 0 ? 'bg-primary/10' : 'xl:border-l'} ${index % 2 ? 'border-l' : ''} ${index > 1 ? 'border-t xl:border-t-0' : ''}`}>
          <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
          <p className="mt-2 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{clientBillingCurrency.format(card.value)}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{card.note}</p>
        </section>
      ))}
    </Card>
  );
}
