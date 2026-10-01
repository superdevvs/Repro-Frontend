import React from 'react';
import { ArrowUpRight, CheckCircle2, ChevronRight, CreditCard, FileText } from 'lucide-react';

import { Card } from '@/components/dashboard/v2/SharedComponents';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { currencyFormatter } from '@/utils/dashboardDerivedUtils';
import { DASHBOARD_MOBILE_PANEL_CLASS } from '../utils/dashboardMobilePanel';
import type { ClientInvoicesCardProps } from '../types';

export const ClientInvoicesCard: React.FC<ClientInvoicesCardProps> = ({ summary, items = [], loading = false, onViewInvoice, onViewAll, onPay }) => (
  <Card className={cn(DASHBOARD_MOBILE_PANEL_CLASS, 'flex h-full min-h-0 flex-col gap-3 sm:gap-4')}>
    <div className="shrink-0">
      <h2 className="text-base font-bold text-foreground sm:text-lg">Invoices & payments</h2>
      <p className="hidden text-xs text-muted-foreground sm:block">Your balances and recent invoices.</p>
    </div>
    <div className="hidden-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Due now</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{currencyFormatter.format(summary.dueNow.amount)}</p>
          </div>
          <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
            {summary.dueNow.amount > 0 ? <CreditCard className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
        </div>
        <p className="mt-2 hidden text-xs text-muted-foreground sm:block">
          {summary.dueNow.amount > 0 ? `${summary.dueNow.count} item${summary.dueNow.count === 1 ? '' : 's'} awaiting payment` : 'No payments due right now'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Upcoming', data: summary.upcoming, icon: <FileText className="h-3.5 w-3.5" /> },
          { label: 'Paid', data: summary.paid, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
        ].map(({ label, data, icon }) => (
          <div key={label} className="min-w-0 rounded-xl border border-border/70 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}<span className="ml-auto text-[10px]">{data.count}</span></p>
            <p className="mt-1 truncate text-lg font-semibold tabular-nums">{currencyFormatter.format(data.amount)}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent invoices</p>
        {loading ? <p className="py-4 text-center text-xs text-muted-foreground" role="status">Loading invoices…</p> : items.length ? (
          <div className="divide-y divide-border/60">
            {items.slice(0, 3).map((item) => (
              <button key={item.id} type="button" disabled={!onViewInvoice} onClick={() => onViewInvoice?.(item)} aria-label={`View invoice ${item.number || item.id}`} className="flex w-full items-center gap-2 rounded-lg py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="rounded-lg bg-muted p-2 text-muted-foreground"><FileText className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{item.property || item.number || 'Invoice'}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{item.number || item.sourceLabel} · {item.paymentRequired === false || item.status === 'no_payment_required' ? 'No payment required' : item.bucket === 'paid' ? 'Paid' : item.bucket === 'due_now' ? 'Due now' : 'Upcoming'}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums">{currencyFormatter.format(item.balance > 0.01 ? item.balance : item.amount)}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : <p className="rounded-xl border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">Your invoices will appear here.</p>}
      </div>
    </div>
    <div className="mt-auto grid shrink-0 grid-cols-2 gap-2 border-t border-border/60 pt-3 sm:grid-cols-1">
      <Button size="sm" className="h-9 gap-2 text-xs sm:text-sm" onClick={onViewAll}>View all invoices<ArrowUpRight className="h-3.5 w-3.5" /></Button>
      <Button size="sm" variant="outline" className="h-9 gap-2 text-xs sm:text-sm" onClick={onPay}><CreditCard className="h-3.5 w-3.5" />Make a payment</Button>
    </div>
  </Card>
);
