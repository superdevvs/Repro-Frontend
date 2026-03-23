import React, { useMemo, useState } from 'react';
import { AlertTriangle, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ClientBillingItem } from '@/types/clientBilling';

interface ClientBillingListProps {
  items: ClientBillingItem[];
  loading?: boolean;
  onView: (item: ClientBillingItem) => void;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return format(parsed, 'MMM d, yyyy');
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  }
};

const getBucketLabel = (bucket: ClientBillingItem['bucket']) => {
  switch (bucket) {
    case 'due_now':
      return 'Due now';
    case 'upcoming':
      return 'Upcoming';
    default:
      return 'Paid';
  }
};

export function ClientBillingList({
  items,
  loading = false,
  onView,
}: ClientBillingListProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'all' | 'due_now' | 'upcoming' | 'paid'>('all');

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return items;
    return items.filter((item) => item.bucket === activeTab);
  }, [activeTab, items]);

  return (
    <div className="w-full">
      <Card className="mb-6">
        <div className="border-b p-3">
          <Tabs
            value={activeTab}
            className="w-full"
            onValueChange={(value) => setActiveTab(value as 'all' | 'due_now' | 'upcoming' | 'paid')}
          >
            <div className="overflow-x-auto pb-1 sm:pb-0">
              <TabsList className="inline-flex min-w-max">
                <TabsTrigger value="all" className="py-1 text-sm">All billing</TabsTrigger>
                <TabsTrigger value="due_now" className="py-1 text-sm">Due now</TabsTrigger>
                <TabsTrigger value="upcoming" className="py-1 text-sm">Upcoming</TabsTrigger>
                <TabsTrigger value="paid" className="py-1 text-sm">Paid</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading billing data…</div>
        ) : isMobile ? (
          <div className="space-y-3 p-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {item.sourceLabel}
                    </p>
                    <p className="text-base font-semibold">
                      {item.number ? `#${item.number}` : `Shoot #${item.shootId}`}
                    </p>
                  </div>
                  <Badge className={`${getStatusColor(item.status)} capitalize`}>{item.status}</Badge>
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Property</p>
                    <p className="font-medium">{item.property || '—'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="font-semibold">{currencyFormatter.format(item.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Open balance</p>
                      <p className="font-semibold">{currencyFormatter.format(item.balance)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{getBucketLabel(item.bucket)}</Badge>
                    {item.paymentRequiredToRelease && (
                      <Badge variant="destructive">Release blocked</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => onView(item)}>
                    View
                  </Button>
                </div>
              </div>
            ))}

            {!filteredItems.length && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No billing items found
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-left">Property</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Balance</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b transition hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-semibold">{item.sourceLabel}</p>
                          <p className="text-[11px] text-muted-foreground">{getBucketLabel(item.bucket)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-medium">
                      {item.number ? `#${item.number}` : `Shoot #${item.shootId}`}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        {item.paymentRequiredToRelease && (
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-500" />
                        )}
                        <div>
                          <p className="text-xs font-medium">{item.property || '—'}</p>
                          {item.paymentRequiredToRelease && (
                            <p className="text-[11px] text-rose-500">Payment required to release delivery</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(item.dueDate || item.issueDate)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold">
                      <div>{currencyFormatter.format(item.balance)}</div>
                      <div className="text-[11px] font-normal text-muted-foreground">
                        Total {currencyFormatter.format(item.amount)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={`${getStatusColor(item.status)} capitalize`}>{item.status}</Badge>
                        {item.paymentRequiredToRelease && (
                          <Badge variant="destructive">Release blocked</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Button variant="outline" size="sm" onClick={() => onView(item)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
                {!filteredItems.length && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      No billing items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
