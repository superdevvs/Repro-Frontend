import React, { useMemo } from 'react';
import { Calendar, CheckCircle, CreditCard, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ClientBillingItem, ClientBillingSummary } from '@/types/clientBilling';

interface ClientBillingOverviewCardsProps {
  summary: ClientBillingSummary;
  items: ClientBillingItem[];
  daysWindow?: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value || 0);

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sumPaidValue = (item: ClientBillingItem) =>
  item.amountPaid > 0 ? item.amountPaid : item.amount;

export function ClientBillingOverviewCards({
  summary,
  items,
  daysWindow = 30,
}: ClientBillingOverviewCardsProps) {
  const metrics = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - daysWindow);

    const paidItems = items.filter((item) => item.bucket === 'paid');

    const paidLastWindow = paidItems
      .filter((item) => {
        const paidDate = parseDate(item.paidAt || item.issueDate || item.dueDate);
        return paidDate ? paidDate >= recentCutoff : false;
      })
      .reduce((sum, item) => sum + sumPaidValue(item), 0);

    const totalSpend = paidItems
      .filter((item) => {
        const paidDate = parseDate(item.paidAt || item.issueDate || item.dueDate);
        return paidDate ? paidDate.getFullYear() === currentYear : false;
      })
      .reduce((sum, item) => sum + sumPaidValue(item), 0);

    return {
      outstanding: summary.dueNow.amount,
      upcoming: summary.upcoming.amount,
      paidLastWindow,
      totalSpend,
    };
  }, [daysWindow, items, summary]);

  const cards = [
    {
      title: 'Outstanding Balance',
      value: formatCurrency(metrics.outstanding),
      description: `${summary.dueNow.count} due now`,
      icon: <CreditCard className="h-4 w-4 text-amber-500" />,
    },
    {
      title: `Paid (Last ${daysWindow} Days)`,
      value: formatCurrency(metrics.paidLastWindow),
      description: `${summary.paid.count} paid item${summary.paid.count === 1 ? '' : 's'}`,
      icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
    },
    {
      title: 'Total Spend (This Year)',
      value: formatCurrency(metrics.totalSpend),
      description: 'Completed payments',
      icon: <DollarSign className="h-4 w-4 text-blue-500" />,
    },
    {
      title: 'Upcoming Charges',
      value: formatCurrency(metrics.upcoming),
      description: `${summary.upcoming.count} upcoming`,
      icon: <Calendar className="h-4 w-4 text-rose-500" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="border">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight">{card.value}</h3>
                <p className="mt-2 text-xs text-muted-foreground">{card.description}</p>
              </div>
              <div className="rounded-md bg-muted/60 p-2">{card.icon}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
