import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, LayoutGrid, List, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { fetchSelfEditorEarnings, sendSelfEditorReport, type EditorEarningsDetail } from '@/services/invoiceService';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';
import { cn } from '@/lib/utils';
import { EditorShootEarningsDialog } from './EditorShootEarningsDialog';
import { filterEditorLedger, groupEditorPayouts, isEditorDateInRange, resolveEditorEarning, summarizeEditorRecordedEarnings, type EditorPayoutGroup } from './editorBillingWorkspaceUtils';
import { formatEditorCurrency as money, formatEditorShortDate as shortDate, formatEditorTimestamp as timestamp } from './editorEarningsUtils';

export interface EditorSelfBillingWorkspaceProps { startDate?: string; endDate?: string }

export function EditorSelfBillingWorkspace({ startDate = '', endDate = '' }: EditorSelfBillingWorkspaceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [detail, setDetail] = useState<EditorEarningsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'earnings' | 'history'>('earnings');
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'grid'>(() => window.matchMedia('(max-width: 640px)').matches ? 'grid' : 'list');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [shootId, setShootId] = useState<number | null>(null);
  const [payout, setPayout] = useState<EditorPayoutGroup | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [chartMetric, setChartMetric] = useState<'earnings' | 'count'>('earnings');
  const requestRef = useRef(0);
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true); setError('');
    try { const next = await fetchSelfEditorEarnings(); if (request === requestRef.current) setDetail(next); }
    catch (reason) { if (request === requestRef.current) setError(reason instanceof Error ? reason.message : 'Unable to load your earnings.'); }
    finally { if (request === requestRef.current) setLoading(false); }
  }, []);
  // Rate saves update the authenticated user's metadata; refresh estimates only.
  useEffect(() => { void load(); }, [load, user?.id, user?.metadata]);
  useEffect(() => { setPage(1); }, [startDate, endDate, status, service, search, tab, pageSize]);

  const items = useMemo(() => detail?.line_items || [], [detail]);
  const rates = detail?.current_rates.service_rates || [];
  const periodItems = useMemo(() => items.filter((item) => isEditorDateInRange(item.completed_at, startDate, endDate)), [items, startDate, endDate]);
  const summary = summarizeEditorRecordedEarnings(periodItems);
  const estimate = periodItems.reduce((sum, item) => { const value = resolveEditorEarning(item, rates); return sum + (value.isFallback ? value.payout : 0); }, 0);
  const ledger = filterEditorLedger(items, { start: startDate, end: endDate, status, service, search });
  const history = groupEditorPayouts(items, startDate, endDate);
  const historyRows = history.filter((group) => `${group.id} ${group.items.map((item) => `${item.client?.name || ''} ${item.shoot?.address || ''}`).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  const count = tab === 'earnings' ? ledger.length : historyRows.length;
  const pages = Math.max(1, Math.ceil(count / pageSize)), safePage = Math.min(page, pages);
  const visibleLedger = ledger.slice((safePage - 1) * pageSize, safePage * pageSize);
  const visibleHistory = historyRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const periodLabel = startDate || endDate ? `${shortDate(startDate, true) || 'Start'} – ${shortDate(endDate, true) || 'Today'}` : 'All completed work';
  const serviceOptions = [...new Set(items.map((item) => item.service_name))].sort();

  const exportData = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      if (tab === 'history') {
        const columns = [{ key: 'batch', label: 'Payout record' }, { key: 'paid', label: 'Recorded paid' }, { key: 'amount', label: 'Saved amount' }, { key: 'services', label: 'Services' }] as const;
        const rows = historyRows.map((group) => ({ batch: group.id, paid: timestamp(group.paidAt), amount: money(group.amount), services: group.items.length }));
        if (format === 'csv') exportRowsAsCsv('my-editor-payout-history', columns, rows);
        else if (format === 'excel') await exportRowsAsExcel('my-editor-payout-history', 'Payout History', columns, rows);
        else await exportRowsAsPdf('my-editor-payout-history', 'Editor Payout History', columns, rows);
      } else {
        const columns = [{ key: 'shoot', label: 'Shoot' }, { key: 'client', label: 'Client' }, { key: 'service', label: 'Service' }, { key: 'quantity', label: 'Qty' }, { key: 'rate', label: 'Rate' }, { key: 'payout', label: 'Payout' }, { key: 'basis', label: 'Basis' }, { key: 'status', label: 'Status' }, { key: 'completed', label: 'Completed' }] as const;
        const rows = ledger.map((item) => { const value = resolveEditorEarning(item, rates); return { shoot: item.shoot_id, client: item.client?.name || '', service: item.service_name, quantity: item.quantity_snapshot, rate: money(value.rate), payout: money(value.payout), basis: value.isFallback ? 'Current-rate estimate' : 'Saved snapshot', status: item.is_paid ? 'Paid' : 'Unpaid', completed: timestamp(item.completed_at) }; });
        if (format === 'csv') exportRowsAsCsv('my-editor-earnings', columns, rows);
        else if (format === 'excel') await exportRowsAsExcel('my-editor-earnings', 'Editor Earnings', columns, rows);
        else await exportRowsAsPdf('my-editor-earnings', 'Editor Earnings Report', columns, rows);
      }
    } catch (reason) { toast({ title: 'Export failed', description: reason instanceof Error ? reason.message : 'Unable to export these rows.', variant: 'destructive' }); }
  };
  const sendReport = async () => {
    setSending(true);
    try { await sendSelfEditorReport({ start: startDate || undefined, end: endDate || undefined }); setReportOpen(false); toast({ title: 'Report sent', description: 'Your earnings report was emailed.' }); }
    catch (reason) { toast({ title: 'Report failed', description: reason instanceof Error ? reason.message : 'Unable to email the report.', variant: 'destructive' }); }
    finally { setSending(false); }
  };
  const paymentBadge = (paid: boolean) => <Badge variant="outline" className={cn('text-[10px]', paid ? 'border-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'border-amber-500/20 text-amber-600 dark:text-amber-300')}>{paid ? 'Paid' : 'Unpaid'}</Badge>;
  const pagination = <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground"><span>Showing {count ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, count)} of {count}</span><div className="flex items-center gap-2"><label className="flex items-center gap-2">Rows<select aria-label="Earnings rows per page" className="h-8 rounded-md border bg-background px-2 text-foreground" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option></select></label><Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous earnings page" aria-disabled={safePage === 1} onClick={() => { if (safePage > 1) setPage(safePage - 1); }}><ChevronLeft className="h-3.5 w-3.5" /></Button><span>{safePage} / {pages}</span><Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next earnings page" aria-disabled={safePage >= pages} onClick={() => { if (safePage < pages) setPage(safePage + 1); }}><ChevronRight className="h-3.5 w-3.5" /></Button></div></div>;
  const chartData = useMemo(() => {
    const groups = new Map<string, { earned: number; shoots: Set<number> }>();
    periodItems.forEach((item) => { const key = (item.completed_at || '').slice(0, 10); if (!key) return; const value = groups.get(key) || { earned: 0, shoots: new Set<number>() }; value.earned += Number(item.payout_amount || 0); value.shoots.add(item.shoot_id); groups.set(key, value); });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [periodItems]);
  const chartMax = Math.max(1, ...chartData.map(([, value]) => chartMetric === 'earnings' ? value.earned : value.shoots.size));

  return <div className="min-w-0 space-y-4">
    <section className="grid grid-cols-2 overflow-hidden rounded-xl border border-border/70 bg-card sm:grid-cols-4" aria-label="Recorded editor earnings summary">
      {[['Recorded earnings', money(summary.recorded), 'Saved payout amounts'], ['Pending payouts', money(summary.unpaid), 'Recorded unpaid work'], ['Shoots completed', summary.shoots, 'Distinct shoots in this period'], ['Average pay per shoot', money(summary.average), 'Recorded earnings per shoot']].map(([label, value, note], index) => <div key={label} className={cn('min-w-0 border-b border-r border-border/60 p-4 last:border-r-0 sm:border-b-0 sm:p-5', index === 0 && 'bg-primary/5')}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{loading && !detail ? '—' : value}</p><p className="mt-2 text-[10px] text-muted-foreground">{note}</p></div>)}
    </section>
    {estimate > 0 && <p className="text-xs text-muted-foreground">{money(estimate)} in current-rate estimates is shown separately in the ledger and excluded from recorded totals.</p>}
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm"><span>{error}</span><Button variant="outline" size="sm" onClick={load}>Retry</Button></div>}
    <Card className="min-w-0 overflow-hidden border-border/70">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-1" role="tablist" aria-label="Editor earnings views"><Button role="tab" aria-selected={tab === 'earnings'} variant={tab === 'earnings' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('earnings')}>Earnings</Button><Button role="tab" aria-selected={tab === 'history'} variant={tab === 'history' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('history')}>Payout history</Button></div>
        <div className="flex flex-wrap gap-2"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={!count}><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => void exportData('csv')}>CSV</DropdownMenuItem><DropdownMenuItem onSelect={() => void exportData('excel')}>Excel</DropdownMenuItem><DropdownMenuItem onSelect={() => void exportData('pdf')}>PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button variant="outline" size="sm" onClick={() => setReportOpen(true)}><Send className="mr-1.5 h-3.5 w-3.5" />Send report</Button><Button variant="ghost" size="icon" className="h-9 w-9" onClick={load} disabled={loading} aria-label="Refresh editor earnings"><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /></Button></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 pb-3 sm:px-5">
        <Input type="search" aria-label="Search editor earnings" placeholder="Search property, client or shoot" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 min-w-0 flex-1 text-xs sm:max-w-64" />
        {tab === 'earnings' && <><select aria-label="Editor payout status" className="h-9 max-w-full rounded-md border bg-background px-2 text-xs" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select><select aria-label="Editor service" className="h-9 max-w-full rounded-md border bg-background px-2 text-xs" value={service} onChange={(event) => setService(event.target.value)}><option value="">All services</option>{serviceOptions.map((name) => <option key={name}>{name}</option>)}</select></>}
        {(search || status || service) && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatus(''); setService(''); }}>Reset</Button>}
        {tab === 'earnings' && <div className="ml-auto flex rounded-md border"><Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2" onClick={() => setView('list')} aria-label="Earnings list view" aria-pressed={view === 'list'}><List className="h-3.5 w-3.5" /></Button><Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2" onClick={() => setView('grid')} aria-label="Earnings grid view" aria-pressed={view === 'grid'}><LayoutGrid className="h-3.5 w-3.5" /></Button></div>}
      </div>
      <p className="border-b px-4 py-2 text-[11px] text-muted-foreground sm:px-5">{periodLabel} · {tab === 'earnings' ? 'Completion dates; filters narrow the ledger and export.' : 'Recorded payment dates; payout batches do not confirm bank settlement.'}</p>
      <div className="h-[27rem] overflow-auto overscroll-contain [scrollbar-gutter:stable]" tabIndex={0} aria-label={tab === 'earnings' ? 'Editor work ledger' : 'Editor payout history'}>
        {!count ? <p className="p-8 text-center text-sm text-muted-foreground">{loading ? 'Loading earnings…' : 'No records match this period and filters.'}</p> : tab === 'history' ? <div className="divide-y">{visibleHistory.map((group) => <button key={group.id} type="button" className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted/30 sm:px-5" onClick={() => setPayout(group)}><div><p className="text-sm font-medium">{group.id}</p><p className="mt-1 text-xs text-muted-foreground">{shortDate(group.paidAt)} · {group.items.length} services</p></div><strong className="text-sm tabular-nums">{money(group.amount)}</strong></button>)}</div> : view === 'grid' ? <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">{visibleLedger.map((item) => { const value = resolveEditorEarning(item, rates); return <button key={item.id} type="button" onClick={() => setShootId(item.shoot_id)} className="rounded-lg border p-4 text-left hover:bg-muted/30"><div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">#{item.shoot_id}</span>{paymentBadge(item.is_paid)}</div><p className="text-sm font-medium">{item.shoot?.address || `Shoot #${item.shoot_id}`}</p><p className="mt-1 text-xs text-muted-foreground">{item.client?.name || 'Unknown client'}</p><p className="mt-3 text-xs">{item.service_name} · {item.quantity_snapshot} × {money(value.rate)}</p><div className="mt-3 flex items-center justify-between border-t pt-3"><span className="text-[11px] text-muted-foreground">{shortDate(item.completed_at)}</span><strong>{money(value.payout)}</strong></div>{value.isFallback && <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-300">Current-rate estimate</p>}</button>; })}</div> : <table className="w-full min-w-[42rem] text-left text-xs"><thead className="sticky top-0 z-10 bg-card text-[11px] text-muted-foreground"><tr>{['Shoot / client', 'Service', 'Qty / rate', 'Earnings', 'Payout', 'Completed', ''].map((label) => <th key={label} className="border-b px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{visibleLedger.map((item) => { const value = resolveEditorEarning(item, rates); return <tr key={item.id} className="border-b border-border/60"><td className="px-4 py-3"><p className="font-medium">{item.shoot?.address || `Shoot #${item.shoot_id}`}</p><p className="mt-1 text-[11px] text-muted-foreground">#{item.shoot_id} · {item.client?.name || 'Unknown client'}</p></td><td className="px-4 py-3">{item.service_name}</td><td className="whitespace-nowrap px-4 py-3">{item.quantity_snapshot} × {money(value.rate)}</td><td className="px-4 py-3"><strong className="tabular-nums">{money(value.payout)}</strong>{value.isFallback && <p className="mt-1 whitespace-nowrap text-[10px] text-amber-600 dark:text-amber-300">Current-rate estimate</p>}</td><td className="px-4 py-3">{paymentBadge(item.is_paid)}</td><td className="whitespace-nowrap px-4 py-3">{shortDate(item.completed_at) || 'Not available'}</td><td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => setShootId(item.shoot_id)} aria-label={`View editor shoot ${item.shoot_id}`}>View</Button></td></tr>; })}</tbody></table>}
      </div>{pagination}
    </Card>
    <Card className="overflow-hidden border-border/70"><div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5"><h2 className="text-base font-semibold">Earnings over time</h2><select aria-label="Editor chart metric" className="h-8 rounded-md border bg-background px-2 text-xs" value={chartMetric} onChange={(event) => setChartMetric(event.target.value as 'earnings' | 'count')}><option value="earnings">Recorded earnings</option><option value="count">Completed shoots</option></select></div><div className="h-48 px-4"><svg viewBox="0 0 740 170" className="h-full w-full" role="img" aria-label={`${chartMetric === 'earnings' ? 'Recorded earnings' : 'Completed shoots'} over selected completion dates`}><line x1="35" x2="725" y1="135" y2="135" stroke="currentColor" opacity=".15" />{chartData.map(([date, value], index) => { const count = chartMetric === 'earnings' ? value.earned : value.shoots.size, cell = 680 / Math.max(1, chartData.length), x = 45 + index * cell, height = count / chartMax * 108; return <g key={date}><rect x={x} y={135 - height} width={Math.min(35, cell * .6)} height={height} rx="3" fill="hsl(var(--primary))"><title>{date}: {chartMetric === 'earnings' ? money(count) : `${count} shoots`}</title></rect>{index % Math.max(1, Math.ceil(chartData.length / 8)) === 0 && <text x={x + 8} y="157" fontSize="10" fill="currentColor" opacity=".6" textAnchor="middle">{date.slice(5)}</text>}</g>; })}{!chartData.length && <text x="370" y="80" fontSize="13" fill="currentColor" opacity=".6" textAnchor="middle">No recorded work in this period</text>}</svg></div><p className="px-4 pb-4 text-[11px] text-muted-foreground sm:px-5">{periodLabel} · Current-rate estimates are excluded.</p></Card>
    <EditorShootEarningsDialog open={shootId !== null} onOpenChange={(open) => { if (!open) setShootId(null); }} items={items.filter((item) => item.shoot_id === shootId)} rates={rates} />
    <Dialog open={!!payout} onOpenChange={(open) => { if (!open) setPayout(null); }}><DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Payout record</DialogTitle><DialogDescription>{payout?.id} · {timestamp(payout?.paidAt)}</DialogDescription></DialogHeader><p className="text-2xl font-semibold">{money(payout?.amount)}</p><div className="divide-y">{payout?.items.map((item) => <div key={item.id} className="flex justify-between gap-3 py-3 text-xs"><span>{item.service_name} · #{item.shoot_id}</span><strong>{money(item.payout_amount)}</strong></div>)}</div><p className="text-xs text-muted-foreground">Recorded payout amounts are saved snapshots. This record does not verify bank settlement.</p></DialogContent></Dialog>
    <Dialog open={reportOpen} onOpenChange={setReportOpen}><DialogContent><DialogHeader><DialogTitle>Email earnings report</DialogTitle><DialogDescription>Send your report for {periodLabel.toLowerCase()} to your account email.</DialogDescription></DialogHeader><p className="text-sm text-muted-foreground">The report uses the selected completion dates. Search, payout-status and service filters do not narrow the emailed report.</p><DialogFooter><Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button><Button onClick={sendReport} disabled={sending}>{sending ? 'Sending…' : 'Send report'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
