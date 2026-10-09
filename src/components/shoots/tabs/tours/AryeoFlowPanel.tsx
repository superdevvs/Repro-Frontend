import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { AryeoJobActivity, type AryeoJob } from './AryeoJobActivity';

type Counts = Record<'photos' | 'floorplans' | 'videos' | 'tours', number>;
type Asset = { id: string; type: keyof Counts; filename?: string; delivered: boolean };
type Order = {
  id: number; connection_id: number; request_id: string | null; listing_id: string | null;
  discovery: { address: string; requester_email: string; required: Record<keyof Counts, number | null> | null };
  inventory: { complete: boolean; assets: Asset[] } | null; inventory_checked_at: string | null;
  readiness: { eligible: boolean; blockers: string[]; dashboard?: { paid: boolean; delivered: boolean; summary_required: boolean }; available: Counts; media_version: string; assets: { id: number; filename: string; type: string }[] };
  jobs: AryeoJob[];
};
type Panel = {
  configured: boolean;
  connections: { id: number; name: string; online: boolean; last_seen_at: string | null; processing_enabled: boolean; executor_ready: boolean; shoot_enabled: boolean }[];
  orders: Order[];
  unmatched: { id: number; source_id: string; address: string; requester_email: string; unit_label: string | null }[];
};
const kinds: (keyof Counts)[] = ['photos', 'floorplans', 'videos', 'tours'];
const labels = { photos: 'Photos', floorplans: 'Floor plans', videos: 'Video', tours: 'Tours' };
const readable = (value: string) => value.replaceAll('_', ' ');
const date = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Never';

async function request<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/${path}`, {
    method: body ? 'POST' : 'GET', signal,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token ?? ''}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Could not reach Aryeo Flow.');
  return data as T;
}

export function AryeoFlowPanel({ shootId, unitId }: { shootId: string | number; unitId?: string | number }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [now, setNow] = useState(Date.now);
  const pollMs = panel?.orders.some(order => order.jobs.some(job => ['queued', 'running', 'reconciling'].includes(job.status))) ? 5000 : 15000;
  const base = `shoots/${shootId}/aryeo`;
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await request<Panel>(`${base}${unitId ? `?unit_id=${unitId}` : ''}`, undefined, signal);
      if (!signal?.aborted) { setPanel(result); setError(''); }
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Could not refresh Aryeo Flow.');
    }
  }, [base, unitId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    let refreshing = false;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (!document.hidden && !refreshing) {
        refreshing = true;
        void load(controller.signal).finally(() => { refreshing = false; });
      }
    }, pollMs);
    return () => { controller.abort(); clearInterval(timer); };
  }, [load, pollMs]);
  const action = async (path: string, body: object = {}) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await request(`${base}/${path}`, body); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-lg border bg-card p-4 space-y-3" aria-label="Aryeo Flow">
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="text-sm font-semibold">Aryeo Flow</h3><p className="text-xs text-muted-foreground">Order matching and delivery</p></div>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void load()} aria-label="Refresh Aryeo status"><RefreshCw className="h-4 w-4" /></Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!panel && !error && <p className="text-sm text-muted-foreground">Checking Aryeo Flow…</p>}
    {panel && !panel.configured && <p className="text-sm text-muted-foreground">Aryeo Flow is not connected for this client yet.</p>}
    {panel?.connections.map(c => <p key={c.id} className="text-xs text-muted-foreground">{c.name}: {c.online ? 'Online' : 'Offline'} · Last seen {date(c.last_seen_at)}{!c.processing_enabled || !c.shoot_enabled ? ' · Read-only' : !c.executor_ready ? ' · Worker setup required' : ''}</p>)}
    {panel?.configured && panel.orders.length === 0 && <p className="text-sm text-muted-foreground">{panel.connections.every(c => !c.last_seen_at) ? 'Waiting for the Mac to sync Aryeo requests.' : 'No Aryeo request matched to this shoot yet.'}</p>}
    {panel?.orders.map(order => {
      const c = panel.connections.find(c => c.id === order.connection_id);
      const job = order.jobs[0];
      const active = job && ['queued', 'running', 'reconciling'].includes(job.status);
      const retry = job && ['failed', 'followup_pending'].includes(job.status);
      const sameDelivered = job?.status === 'completed' && job.media_version === order.readiness.media_version;
      const inventoryKnown = Boolean(order.inventory?.complete && order.inventory_checked_at && Number.isFinite(Date.parse(order.inventory_checked_at)));
      const inventoryFresh = inventoryKnown && Date.now() - Date.parse(order.inventory_checked_at!) < 120000;
      const canProcess = Boolean(c?.online && c.processing_enabled && c.shoot_enabled && c.executor_ready && order.request_id && !error);
      return <div key={order.id} className="space-y-3 border-t pt-3">
        <p className="text-sm font-medium">Aryeo request received</p>
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">Order {order.request_id ?? 'awaiting Aryeo verification'}</span><span>{job?.receipt ? (job.status === 'completed' ? (sameDelivered ? 'Delivered' : 'Update available') : 'Delivered · follow-up pending') : job ? readable(job.status) : order.readiness.eligible ? 'Ready to process' : 'Waiting'}</span></div>
        <p className="text-xs text-muted-foreground">{order.discovery.address} · {order.discovery.requester_email}{order.listing_id ? ` · Listing ${order.listing_id}` : ''}</p>
        {order.readiness.dashboard && <p className="text-xs text-muted-foreground">Dashboard: {order.readiness.dashboard.paid ? 'Paid' : 'Awaiting payment'} · {order.readiness.dashboard.delivered ? 'Delivered' : 'Awaiting delivery'} · Summary email not required</p>}
        <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr className="text-muted-foreground"><th className="py-2 pr-3">Media</th><th className="px-2">Requested</th><th className="px-2">Ready</th><th className="px-2">In Aryeo</th><th className="pl-2">Delivered</th></tr></thead><tbody>
          {kinds.map(kind => <tr key={kind} className="border-t"><th className="py-2 pr-3 font-medium">{labels[kind]}</th><td className="px-2">{order.discovery.required ? (order.discovery.required[kind] ?? 'Requested') : 'Unknown'}</td><td className="px-2">{order.readiness.available[kind]}</td><td className="px-2">{inventoryKnown ? order.inventory?.assets.filter(a => a.type === kind).length : 'Unknown'}</td><td className="pl-2">{inventoryKnown ? order.inventory?.assets.filter(a => a.type === kind && a.delivered).length : 'Unknown'}</td></tr>)}
        </tbody></table></div>
        <p className="text-xs text-muted-foreground">Inventory checked: {date(order.inventory_checked_at)}{!inventoryFresh ? (inventoryKnown ? ' · Showing last verified counts; refresh required before delivery' : ' · Fresh inventory required') : ''}{job?.receipt ? ` · Delivery verified: ${date(job.receipt.verified_at)}` : ''}</p>
        {order.readiness.blockers.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{order.readiness.blockers.map(readable).join(' · ')}</p>}
        <details className="text-xs"><summary className="cursor-pointer">Media and delivery details</summary><div className="mt-2 max-h-48 overflow-y-auto space-y-1">
          {order.readiness.assets.map(a => <p key={`ready-${a.id}`}>Dashboard · {a.filename} · {labels[a.type as keyof Counts]}</p>)}
          {order.inventory?.assets.map(a => <p key={`remote-${a.id}`}>Aryeo · {a.filename || a.id} · {a.delivered ? 'Delivered' : 'Uploaded'}</p>)}
          {job && Object.entries(job.steps).map(([step, state]) => <p key={step}>{readable(step)}: {readable(state)}</p>)}
        </div></details>
        <div className="flex flex-col items-start gap-3 sm:flex-row">
        <Button size="sm" className="shrink-0" disabled={busy || !canProcess || Boolean(active) || Boolean(sameDelivered) || (!retry && !order.readiness.eligible)} onClick={() => void action(retry ? `jobs/${job.id}/retry` : `requests/${order.id}/process`)}>
          {busy ? 'Working…' : active ? 'Processing…' : retry ? 'Resume unfinished steps' : sameDelivered ? 'Delivered' : order.jobs.some(j => j.receipt) ? 'Deliver update' : 'Process & deliver'}
        </Button>
        {job && <AryeoJobActivity job={job} online={Boolean(c?.online)} now={now} />}
        </div>
      </div>;
    })}
    {panel && panel.unmatched.length > 0 && <details className="text-xs border-t pt-3"><summary className="cursor-pointer">Match an existing request</summary><div className="mt-2 space-y-2">
      <select className="w-full min-w-0 rounded border bg-background p-2" aria-label="Unmatched Aryeo request" value={selected} onChange={e => { setSelected(e.target.value); setConfirmed(false); }}><option value="">Select a request</option>{panel.unmatched.map(o => <option key={o.id} value={o.id}>{o.address}{o.unit_label ? ` / ${o.unit_label}` : ''} — {o.requester_email}</option>)}</select>
      <label className="flex gap-2 items-start"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I verified this request belongs to this shoot and selected unit.</label>
      <Button size="sm" variant="outline" disabled={busy || !selected || !confirmed} onClick={() => void action(`requests/${selected}/match`, { unit_id: unitId ?? null, confirm_identity: true })}>Match request</Button>
    </div></details>}
  </section>;
}
