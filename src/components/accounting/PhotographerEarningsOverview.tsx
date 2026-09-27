import { useMemo, useState } from 'react';
import { eachDayOfInterval, eachMonthOfInterval, eachWeekOfInterval, endOfDay, endOfMonth, endOfWeek, format } from 'date-fns';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import type { ShootData } from '@/types/shoots';
import { AccountingMetricStrip } from './AccountingMetricStrip';
import { accountingRangeDates, accountingRangeDays, previousAccountingRange, type AccountingDateRange } from './accountingDateRange';
import { calculatePercentageTrend, getPhotographerPayForShoot, getPhotographerPayoutStatus, getShootCompletedDate, isCompletedShoot, isDateInRange, isShootAssignedToPhotographer } from './photographerEarningsUtils';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
export function PhotographerEarningsOverview({ shoots, dateRange }: { shoots: ShootData[]; dateRange: AccountingDateRange }) {
  const { user } = useAuth();
  const [metric, setMetric] = useState<'earnings' | 'shoots'>('earnings');
  const [style, setStyle] = useState<'area' | 'bar' | 'line'>('area');
  const [page, setPage] = useState(1);
  const values = useMemo(() => {
    const currentRange = accountingRangeDates(dateRange), previousRange = previousAccountingRange(dateRange);
    const completed = shoots.filter(shoot => isShootAssignedToPhotographer(shoot, user) && isCompletedShoot(shoot));
    const current = completed.filter(shoot => isDateInRange(getShootCompletedDate(shoot), currentRange));
    const previous = completed.filter(shoot => isDateInRange(getShootCompletedDate(shoot), previousRange));
    const sum = (items: ShootData[]) => items.reduce((total, shoot) => total + getPhotographerPayForShoot(shoot, user), 0);
    const unpaid = current.filter(shoot => getPhotographerPayoutStatus(shoot) === 'pending');
    const previousUnpaid = previous.filter(shoot => getPhotographerPayoutStatus(shoot) === 'pending');
    const days = accountingRangeDays(dateRange);
    const starts = days <= 35 ? eachDayOfInterval(currentRange) : days <= 120 ? eachWeekOfInterval(currentRange) : eachMonthOfInterval(currentRange);
    const chart = starts.map(start => {
      const end = days <= 35 ? endOfDay(start) : days <= 120 ? endOfWeek(start) : endOfMonth(start);
      const items = current.filter(shoot => isDateInRange(getShootCompletedDate(shoot), { start, end }));
      return { label: format(start < currentRange.start ? currentRange.start : start, days > 120 ? 'MMM yy' : 'MMM d'), earnings: Math.round(sum(items) * 100) / 100, shoots: items.length };
    });
    const avg = current.length ? sum(current) / current.length : 0, previousAvg = previous.length ? sum(previous) / previous.length : 0;
    const trend = (a: number, b: number) => { const delta = calculatePercentageTrend(a, b); if (!delta) return 'No change vs previous period'; return `${delta.direction === 'up' ? '+' : '−'}${delta.value}% vs previous period`; };
    return { current: [...current].sort((a, b) => (getShootCompletedDate(b)?.getTime() ?? 0) - (getShootCompletedDate(a)?.getTime() ?? 0)), chart,
      metrics: [
        { label: 'Total earnings', value: money(sum(current)), detail: trend(sum(current), sum(previous)) },
        { label: 'Pending payouts', value: money(sum(unpaid)), detail: `${unpaid.length} shoots · ${trend(sum(unpaid), sum(previousUnpaid))}` },
        { label: 'Completed shoots', value: current.length, detail: trend(current.length, previous.length) },
        { label: 'Average shoot value', value: money(avg), detail: trend(avg, previousAvg) },
      ],
    };
  }, [shoots, user, dateRange]);
  const pages = Math.max(1, Math.ceil(values.current.length / 5)), safePage = Math.min(page, pages);
  return <div className="min-w-0 space-y-5">
    <AccountingMetricStrip label="Photographer earnings summary" metrics={values.metrics} />
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(270px,1fr)]">
      <section className="min-w-0 rounded-xl border bg-card p-4" aria-label="Earnings trend">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Earnings trend</h2><div className="flex flex-wrap gap-2">
          <select aria-label="Chart measure" className="h-8 rounded-md border bg-background px-2 text-xs" value={metric} onChange={event => setMetric(event.target.value as typeof metric)}><option value="earnings">Earnings</option><option value="shoots">Completed shoots</option></select>
          <select aria-label="Chart style" className="h-8 rounded-md border bg-background px-2 text-xs" value={style} onChange={event => setStyle(event.target.value as typeof style)}><option value="area">Area</option><option value="bar">Bar</option><option value="line">Line</option></select>
        </div></div>
        <p className="mt-1 text-xs text-muted-foreground">Completed work in the reporting period.</p>
        <div className="mt-4 h-[245px] w-full" role="img" aria-label={`${values.current.length} completed shoots in the reporting period`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={values.chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} minTickGap={28} axisLine={false} tickLine={false} /><YAxis width={60} tickFormatter={value => metric === 'earnings' ? `$${value}` : String(value)} allowDecimals={metric === 'earnings'} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number) => [metric === 'earnings' ? money(value) : value, metric === 'earnings' ? 'Earnings' : 'Completed shoots']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />{style === 'bar' ? <Bar dataKey={metric} fill="hsl(var(--primary))" maxBarSize={32} radius={[3, 3, 0, 0]} /> : style === 'line' ? <Line type="monotone" dataKey={metric} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} /> : <Area type="monotone" dataKey={metric} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.12} strokeWidth={2} />}</ComposedChart></ResponsiveContainer></div>
      </section>
      <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card" aria-label="Recent earnings">
        <div className="border-b px-4 py-3"><h2 className="text-base font-semibold">Recent earnings</h2><p className="mt-1 text-xs text-muted-foreground">Completion dates · selected period</p></div>
        <div role="region" tabIndex={0} aria-label="Recent completed shoot earnings" className="max-h-[265px] min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y">
          {values.current.slice((safePage - 1) * 5, safePage * 5).map(shoot => <div key={shoot.id} className="flex items-start justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{shoot.location?.address || 'Property'}</p><p className="mt-1 text-xs text-muted-foreground">{shoot.location?.city}{shoot.location?.city ? ' · ' : ''}{getShootCompletedDate(shoot) ? format(getShootCompletedDate(shoot)!, 'MMM d, yyyy') : 'Unknown date'}</p></div><div className="text-right"><p className="text-sm font-medium">{money(getPhotographerPayForShoot(shoot, user))}</p><span className="text-[11px] text-muted-foreground">{getPhotographerPayoutStatus(shoot) === 'paid' ? 'Paid' : 'Pending'}</span></div></div>)}
          {!values.current.length && <p className="p-6 text-sm text-muted-foreground">No completed shoots in this period.</p>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground"><span>{values.current.length} shoots</span><div className="flex items-center gap-1"><Button variant="ghost" size="sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria-label="Previous earnings page">Previous</Button><span>{safePage}/{pages}</span><Button variant="ghost" size="sm" disabled={safePage === pages} onClick={() => setPage(safePage + 1)} aria-label="Next earnings page">Next</Button></div></div>
      </section>
    </div>
  </div>;
}
