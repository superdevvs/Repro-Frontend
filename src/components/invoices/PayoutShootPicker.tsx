import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { WeeklyInvoice } from '@/services/invoiceService';
import { fetchPayoutShootCandidates, type PayoutEditInput, type PayoutEditorRole, type PayoutShootCandidate } from '@/services/payoutInvoiceEditorService';

export function PayoutShootPicker({ invoice, role, busy, adminReason, onAdd, onCancel }: {
  invoice: WeeklyInvoice; role: PayoutEditorRole; busy: boolean; adminReason: string;
  onAdd: (data: PayoutEditInput) => Promise<void>; onCancel: () => void;
}) {
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState<PayoutShootCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      fetchPayoutShootCandidates(role, invoice.id, search, date, controller.signal).then((result) => setRows(result.data)).catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to search shoots');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [role, invoice.id, invoice.payout_review?.revision, search, date]);
  return <section className="space-y-3 rounded-lg border bg-muted/20 p-3" aria-label="Add shoot to invoice">
    <h3 className="text-sm font-semibold">Choose a shoot service</h3>
    <p className="text-xs text-muted-foreground">Invoice weeks use shoot dates. Only completed / verified work is eligible. Work shot in another week needs an explanation and can only be allocated once.</p>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="payout-shoot-search">Address or shoot ID</Label><Input id="payout-shoot-search" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div><Label htmlFor="payout-shoot-date">Shoot date (optional)</Label><Input id="payout-shoot-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div></div>
    <div><Label htmlFor="payout-week-reason">Reason for adding / moving work</Label><Textarea id="payout-week-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for work shot outside this invoice week." /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="max-h-64 space-y-2 overflow-y-auto" aria-busy={loading}>{loading ? <p className="text-sm">Searching shoots…</p> : rows.map((row) => <div key={row.shoot_service_id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-background p-3 text-sm"><div className="min-w-0 flex-1"><p className="font-medium">#{row.shoot_id} · {row.address}</p><p>{row.service_name} · ${Number(row.amount).toFixed(2)} payout</p><p className="mt-1 text-xs text-muted-foreground">Shot {row.scheduled_date || 'unknown'} · Completed {row.completed_date || 'not yet'} · Invoice week {row.earning_week || 'not ready'}</p>{row.outside_period && <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">Shot outside this invoice week</p>}{row.unavailable_reason && <p className="mt-1 text-xs text-muted-foreground">{row.unavailable_reason}</p>}</div><Button size="sm" disabled={busy || !row.eligible || (row.outside_period && !(reason || adminReason).trim())} onClick={() => onAdd({ action: 'add_shoot', shoot_id: row.shoot_id, shoot_service_id: row.shoot_service_id, reason: reason || adminReason })}>Add service</Button></div>)}{!loading && !rows.length && !error && <p className="text-sm text-muted-foreground">No matching shoot services. For a job missing from the dashboard, use external / legacy work.</p>}</div>
    <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel shoot selection</Button>
  </section>;
}
