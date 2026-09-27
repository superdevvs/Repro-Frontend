import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AccountingMetricStrip } from '../AccountingMetricStrip';
import type { SalesRepSummaryResponse, SalesRepTopClient, SalesRepNewClient } from '@/types/salesSummary';

interface SalesRepSummarySectionProps {
  data: SalesRepSummaryResponse | null; loading: boolean; error: string | null;
  daysWindow: number; onRetry: () => void | Promise<unknown>;
}
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
const date = (value?: string | null) => { if (!value) return 'No activity'; try { return format(parseISO(value), 'MMM d, yyyy'); } catch { return 'No activity'; } };

export function SalesRepSummarySection({ data, loading, error, daysWindow, onRetry }: SalesRepSummarySectionProps) {
  const [filter, setFilter] = useState('top');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [series, setSeries] = useState<'paid_revenue' | 'new_clients'>('paid_revenue');
  const [selected, setSelected] = useState<SalesRepTopClient | SalesRepNewClient | null>(null);
  const clients = useMemo(() => {
    const top = data?.top_clients ?? [], added = data?.new_clients ?? [];
    const list = filter === 'new' ? added : filter === 'balance' ? [...new Map([...top, ...added].map(client => [client.client_id, client])).values()].filter(client => client.outstanding_balance > 0) : top;
    return list.filter(client => client.client_name.toLowerCase().includes(search.toLowerCase().trim()));
  }, [data, filter, search]);
  const pages = Math.max(1, Math.ceil(clients.length / 5)), safePage = Math.min(page, pages);
  const rows = clients.slice((safePage - 1) * 5, safePage * 5);
  if (loading) return <div role="status" aria-label="Loading sales summary" className="h-72 animate-pulse rounded-xl border bg-muted/30" />;
  if (error || !data) return <div role="alert" className="rounded-xl border p-6"><h2 className="font-semibold">Unable to load sales summary</h2><p className="mt-2 text-sm text-muted-foreground">{error || 'Please try again.'}</p><Button variant="outline" className="mt-3" onClick={onRetry}>Try again</Button></div>;
  const { summary } = data;
  return <section id="sales-overview" className="min-w-0 scroll-mt-6 space-y-5">
    <AccountingMetricStrip label="Sales summary" metrics={[
      { label: 'Paid revenue', value: money(summary.paid_revenue), detail: 'Paid invoices in this period' },
      { label: 'Average client value', value: money(summary.average_client_value), detail: 'Per active client' },
      { label: 'New clients', value: summary.new_clients, detail: 'Added in this period' },
      { label: 'Commission', value: summary.commission_earned == null ? 'Not configured' : money(summary.commission_earned), detail: summary.commission_rate == null ? 'Commission rate is not configured' : `At your ${summary.commission_rate}% rate` },
    ]} />
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)]">
      <section id="sales-clients" aria-label="Client portfolio" className="min-w-0 scroll-mt-6 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><h2 className="text-base font-semibold">Clients</h2><span className="text-xs text-muted-foreground">Your accounts</span></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <select aria-label="Client list" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} className="h-9 rounded-md border bg-background px-2 text-xs"><option value="top">Top clients</option><option value="new">New clients</option><option value="balance">With balance</option></select>
          <label className="relative min-w-0 flex-1 sm:max-w-56"><Search className="absolute left-3 top-3 h-3.5 w-3.5 text-muted-foreground" /><Input type="search" aria-label="Search clients" placeholder="Search clients" className="h-9 pl-8" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
        </div>
        <div role="region" aria-label="Client accounts" tabIndex={0} className="max-h-80 overflow-auto overscroll-contain">
          <table className="w-full min-w-[590px] text-left text-sm"><thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground"><tr>{['Client', 'Paid revenue', 'Current balance', filter === 'new' ? 'Added' : 'Last shoot', ''].map((text, index) => <th key={index} className="px-4 py-3 font-medium">{text}</th>)}</tr></thead><tbody>
            {rows.map(client => <tr key={client.client_id} className="border-t"><td className="px-4 py-4 font-medium">{client.client_name}</td><td className="whitespace-nowrap px-4 py-4">{money(client.paid_revenue)}</td><td className="whitespace-nowrap px-4 py-4">{money(client.outstanding_balance)}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">{date(filter === 'new' && 'created_at' in client ? String(client.created_at || '') : client.last_shoot_date)}</td><td className="px-4 py-4"><Button size="sm" variant="ghost" onClick={() => setSelected(client)} aria-label={`View ${client.client_name}`}>View</Button></td></tr>)}
            {!rows.length && <tr><td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">{search ? 'No clients match your search.' : filter === 'new' ? 'No new clients in this period.' : 'No matching clients in this period.'}</td></tr>}
          </tbody></table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground"><span>{filter === 'top' ? 'Top accounts ranked by paid revenue' : filter === 'balance' ? 'Balances from top and new accounts' : `${summary.new_clients} new in this period`} · {clients.length} shown</span><div className="flex items-center gap-2"><Button size="icon" variant="ghost" className="h-8 w-8" disabled={safePage === 1} aria-label="Previous client page" onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-4 w-4" /></Button>{safePage} / {pages}<Button size="icon" variant="ghost" className="h-8 w-8" disabled={safePage === pages} aria-label="Next client page" onClick={() => setPage(safePage + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
        {filter !== 'new' && <div className="border-t px-4 py-3 text-xs text-muted-foreground"><button type="button" className="font-medium text-foreground hover:text-primary" onClick={() => { setFilter('new'); setPage(1); }}>New clients · {summary.new_clients}</button><span className="ml-2">{summary.new_clients ? 'View accounts added in this period.' : 'No accounts added in this period.'}</span></div>}
      </section>
      <section aria-label="Revenue and client growth" className="min-w-0 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Revenue & growth</h2><div className="flex gap-1 rounded-md border p-1">{(['paid_revenue', 'new_clients'] as const).map(value => <button key={value} type="button" aria-pressed={series === value} onClick={() => setSeries(value)} className={`rounded px-2 py-1 text-xs ${series === value ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>{value === 'paid_revenue' ? 'Paid revenue' : 'New clients'}</button>)}</div></div>
        <div className="mt-5 h-[255px] w-full" role="img" aria-label={`${money(summary.paid_revenue)} paid revenue and ${summary.new_clients} new clients in this period`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="bucket" tickFormatter={value => format(parseISO(String(value)), daysWindow >= 365 ? 'MMM' : 'MMM d')} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} minTickGap={22} /><YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={58} tickFormatter={value => series === 'paid_revenue' ? `$${value}` : String(value)} allowDecimals={series === 'paid_revenue'} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => [series === 'paid_revenue' ? money(value) : value, series === 'paid_revenue' ? 'Paid revenue' : 'New clients']} labelFormatter={value => date(String(value))} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />{series === 'paid_revenue' ? <Bar dataKey="paid_revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={38} /> : <Line dataKey="new_clients" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />}</ComposedChart></ResponsiveContainer></div>
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{date(data.period.start_date)} – {date(data.period.end_date)}</p>
      </section>
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.client_name}</DialogTitle><DialogDescription>Account performance for the selected reporting period.</DialogDescription></DialogHeader>{selected && <dl className="grid grid-cols-2 gap-5 py-4">{[['Paid revenue', money(selected.paid_revenue)], ['Current balance', money(selected.outstanding_balance)], ['Last shoot', date(selected.last_shoot_date)], ...('created_at' in selected ? [['Added', date(selected.created_at)]] : [])].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>}</DialogContent></Dialog>
  </section>;
}
export default SalesRepSummarySection;
