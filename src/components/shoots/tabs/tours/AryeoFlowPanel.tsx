import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { AryeoJobActivity, type AryeoJob } from './AryeoJobActivity';

type Counts = Record<'photos' | 'floorplans' | 'videos' | 'tours', number>;
type Asset = { id: string; type: keyof Counts; filename?: string; delivered: boolean; dashboard_asset_id?: number | null };
type ProviderStatus = {
  origin: 'aryeo_provider'; request_id: string; requester_email: string; listing_id: string | null;
  checked_at: string; delivery_status: 'pending' | 'uploaded' | 'delivered';
  counts: Record<keyof Counts, number | null>; delivered_counts?: Record<keyof Counts, number | null> | null;
};
type ManualReceipt = {
  mode: 'supervised'; operation_id: string; listing_id: string; media_version: string;
  asset_ids: number[]; tour_ids: string[]; verified_at: string;
};
type Order = {
  id: number; connection_id: number; request_id: string | null; listing_id: string | null;
  discovery: { address: string; requester_email: string | null; requester_name?: string | null; required: Record<keyof Counts, number | null> | null; source_kind?: string };
  inventory: { complete?: boolean; assets?: Asset[]; manual_delivery_receipt?: ManualReceipt; provider_status?: ProviderStatus } | null; inventory_checked_at: string | null;
  readiness: { eligible: boolean; blockers: string[]; dashboard?: { paid: boolean; delivered: boolean; summary_required: boolean }; available: Counts; media_version: string; assets: { id: number; filename: string; type: string }[]; tours?: { id: string }[] };
  jobs: AryeoJob[];
};
type Panel = {
  configured: boolean;
  connections: { id: number; name: string; online: boolean; last_seen_at: string | null; processing_enabled: boolean; executor_ready: boolean; shoot_enabled: boolean; discovery_only?: boolean }[];
  orders: Order[];
  unmatched: { id: number; source_id: string; address: string; requester_email: string | null; requester_name?: string | null; unit_label: string | null }[];
};
const kinds: (keyof Counts)[] = ['photos', 'floorplans', 'videos', 'tours'];
const labels = { photos: 'Photos', floorplans: 'Floor plans', videos: 'Video', tours: 'Tours' };
const readable = (value: string) => value.replaceAll('_', ' ');
const date = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Never';

function hasVerifiedManualDelivery(order: Order): boolean {
  const receipt = order.inventory?.manual_delivery_receipt;
  const inventoryAssets = order.inventory?.assets;
  if (!receipt || receipt.mode !== 'supervised' || !receipt.operation_id || !order.listing_id
    || receipt.listing_id !== order.listing_id || receipt.media_version !== order.readiness.media_version
    || !Number.isFinite(Date.parse(receipt.verified_at)) || Date.parse(receipt.verified_at) > Date.now() + 60000
    || !order.inventory_checked_at || !Number.isFinite(Date.parse(order.inventory_checked_at))
    || !order.inventory?.complete || !Array.isArray(inventoryAssets) || !Array.isArray(receipt.asset_ids) || !Array.isArray(receipt.tour_ids)) return false;
  const expected = new Map(order.readiness.assets.map(asset => [asset.id, asset.type]));
  const expectedTours = new Set((order.readiness.tours ?? []).map(tour => tour.id));
  const actual = new Set(receipt.asset_ids);
  const actualTours = new Set(receipt.tour_ids);
  if (actual.size !== receipt.asset_ids.length || actual.size !== expected.size
    || actualTours.size !== receipt.tour_ids.length || actualTours.size !== expectedTours.size
    || expected.size + expectedTours.size === 0 || [...actual].some(id => !expected.has(id))
    || [...actualTours].some(id => !expectedTours.has(id))) return false;
  const remoteFiles = inventoryAssets.filter(asset => asset.type !== 'tours');
  const mapped = new Set(remoteFiles.map(asset => asset.dashboard_asset_id));
  return inventoryAssets.every(asset => asset.delivered)
    && new Set(inventoryAssets.map(asset => asset.id)).size === inventoryAssets.length
    && remoteFiles.length === expected.size && mapped.size === expected.size
    && remoteFiles.every(asset => asset.dashboard_asset_id != null && expected.get(asset.dashboard_asset_id) === asset.type)
    && inventoryAssets.filter(asset => asset.type === 'tours').length === expectedTours.size;
}

function verifiedProviderStatus(order: Order): ProviderStatus | null {
  const status = order.inventory?.provider_status;
  if (!status || status.origin !== 'aryeo_provider' || !order.request_id || status.request_id !== order.request_id
    || status.listing_id !== order.listing_id || (status.delivery_status === 'delivered' && !status.listing_id)
    || !order.discovery.requester_email || typeof status.requester_email !== 'string' || status.requester_email.toLowerCase() !== order.discovery.requester_email.toLowerCase()
    || !['pending', 'uploaded', 'delivered'].includes(status.delivery_status)
    || !Number.isFinite(Date.parse(status.checked_at)) || Date.parse(status.checked_at) > Date.now() + 60000
    || !status.counts || !kinds.every(kind => status.counts[kind] === null || (Number.isInteger(status.counts[kind]) && Number(status.counts[kind]) >= 0))) return null;
  return status;
}

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
    {panel?.connections.map(c => <p key={c.id} className="text-xs text-muted-foreground">{c.name}: {c.online ? 'Online' : 'Offline'} · Last seen {date(c.last_seen_at)}{c.discovery_only ? ' · Request sync enabled · Delivery not enabled' : !c.processing_enabled || !c.shoot_enabled ? ' · Read-only' : !c.executor_ready ? ' · Worker setup required' : ''}</p>)}
    {panel?.configured && panel.orders.length === 0 && <p className="text-sm text-muted-foreground">{panel.unmatched.length > 0 ? 'Aryeo request received. Confirm the client match below.' : panel.connections.every(c => !c.last_seen_at) ? 'Waiting for the Mac to sync Aryeo requests.' : 'No Aryeo request matched to this shoot yet.'}</p>}
    {panel?.orders.map(order => {
      const c = panel.connections.find(c => c.id === order.connection_id);
      const job = order.jobs[0];
      const active = job && ['queued', 'running', 'reconciling'].includes(job.status);
      const retry = job && ['failed', 'followup_pending'].includes(job.status);
      const supervised = order.discovery.source_kind === 'supervised_existing_listing' && order.request_id === null;
      const manualDelivered = supervised && hasVerifiedManualDelivery(order);
      const providerStatus = verifiedProviderStatus(order);
      const providerOnlyDelivered = providerStatus?.delivery_status === 'delivered' && !job?.receipt && !manualDelivered;
      const remoteAssets = order.inventory?.assets ?? [];
      const sameDelivered = manualDelivered || (job?.status === 'completed' && job.media_version === order.readiness.media_version);
      const deliveryReceipt = manualDelivered ? order.inventory?.manual_delivery_receipt : job?.receipt;
      const inventoryKnown = Boolean(order.inventory?.complete && order.inventory_checked_at && Number.isFinite(Date.parse(order.inventory_checked_at)));
      const inventoryFresh = inventoryKnown && Date.now() - Date.parse(order.inventory_checked_at!) < 120000;
      const canProcess = Boolean(c?.online && c.processing_enabled && c.shoot_enabled && c.executor_ready && order.request_id && order.discovery.requester_email && !error);
      return <div key={order.id} className="space-y-3 border-t pt-3">
        <p className="text-sm font-medium">Aryeo request received</p>
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="min-w-0 break-all font-medium">{supervised ? `Listing ${order.listing_id}` : `Order ${order.request_id ?? 'awaiting Aryeo verification'}`}</span><span>{providerOnlyDelivered ? 'Delivered in Aryeo' : supervised ? (manualDelivered ? 'Delivered manually' : 'Manual delivery needs verification') : job?.receipt ? (job.status === 'completed' ? (sameDelivered ? 'Delivered' : 'Update available') : 'Delivered · follow-up pending') : job ? readable(job.status) : order.readiness.eligible ? 'Ready to process' : 'Waiting'}</span></div>
        <p className="break-words text-xs text-muted-foreground">{order.discovery.address} · {order.discovery.requester_email || order.discovery.requester_name || 'Requester email pending'}{order.listing_id ? ` · Listing ${order.listing_id}` : ''}</p>
        {!order.discovery.requester_email && <p className="text-xs text-amber-700 dark:text-amber-400">Requester email needs verification before delivery.</p>}
        {supervised && <p className="text-xs text-muted-foreground">Original Aryeo request ID unavailable. {manualDelivered ? 'Delivery verified from the listing and supervised record.' : 'Supervised delivery evidence must be verified.'}</p>}
        {order.readiness.dashboard && <p className="text-xs text-muted-foreground">Dashboard: {order.readiness.dashboard.paid ? 'Paid' : 'Awaiting payment'} · {order.readiness.dashboard.delivered ? 'Delivered' : 'Awaiting delivery'} · Summary email not required</p>}
        <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr className="text-muted-foreground"><th className="py-2 pr-3">Media</th><th className="px-2">Requested</th><th className="px-2">Ready</th><th className="px-2">In Aryeo</th><th className="pl-2">Delivered</th></tr></thead><tbody>
          {kinds.map(kind => <tr key={kind} className="border-t"><th className="py-2 pr-3 font-medium">{labels[kind]}</th><td className="px-2">{order.discovery.required ? (order.discovery.required[kind] ?? 'Requested') : 'Unknown'}</td><td className="px-2">{order.readiness.available[kind]}</td><td className="px-2">{inventoryKnown ? remoteAssets.filter(a => a.type === kind).length : providerStatus?.counts[kind] ?? 'Unknown'}</td><td className="pl-2">{inventoryKnown ? remoteAssets.filter(a => a.type === kind && a.delivered).length : providerStatus?.delivered_counts?.[kind] ?? 'Unknown'}</td></tr>)}
        </tbody></table></div>
        {(!providerOnlyDelivered || inventoryKnown) && <p className="text-xs text-muted-foreground">Inventory checked: {date(order.inventory_checked_at)}{!inventoryFresh ? (inventoryKnown ? ' · Showing last verified counts; refresh required before delivery' : ' · Fresh inventory required') : ''}{deliveryReceipt ? ` · Delivery verified: ${date(deliveryReceipt.verified_at)}` : ''}</p>}
        {providerStatus && <p className="text-xs text-muted-foreground">Provider status checked: {date(providerStatus.checked_at)}{Date.now() - Date.parse(providerStatus.checked_at) >= 120000 ? ' · Showing last verified provider status' : ''}</p>}
        {providerOnlyDelivered && <p className="text-xs text-muted-foreground">Delivery verified in Aryeo. Reconcile any Dashboard changes before sending an update.</p>}
        {order.readiness.blockers.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{order.readiness.blockers.map(readable).join(' · ')}</p>}
        <details className="text-xs"><summary className="cursor-pointer">Media and delivery details</summary><div className="mt-2 max-h-48 overflow-y-auto space-y-1">
          {order.readiness.assets.map(a => <p key={`ready-${a.id}`}>Dashboard · {a.filename} · {labels[a.type as keyof Counts]}</p>)}
          {remoteAssets.map(a => <p key={`remote-${a.id}`}>Aryeo · {a.filename || a.id} · {a.delivered ? 'Delivered' : 'Uploaded'}</p>)}
          {job && Object.entries(job.steps).map(([step, state]) => <p key={step}>{readable(step)}: {readable(state)}</p>)}
          {manualDelivered && <p>Supervised operation: {order.inventory?.manual_delivery_receipt?.operation_id}</p>}
        </div></details>
        <div className="flex flex-col items-start gap-3 sm:flex-row">
        <Button size="sm" className="shrink-0" disabled={busy || supervised || providerOnlyDelivered || !canProcess || Boolean(active) || Boolean(sameDelivered) || (!retry && !order.readiness.eligible)} onClick={() => void action(retry ? `jobs/${job.id}/retry` : `requests/${order.id}/process`)}>
          {providerOnlyDelivered ? 'Delivered in Aryeo' : supervised ? (manualDelivered ? 'Delivered manually' : 'Manual delivery') : busy ? 'Working…' : active ? 'Processing…' : retry ? 'Resume unfinished steps' : sameDelivered ? 'Delivered' : order.jobs.some(j => j.receipt) ? 'Deliver update' : 'Process & deliver'}
        </Button>
        {job && <AryeoJobActivity job={job} online={Boolean(c?.online)} now={now} />}
        </div>
      </div>;
    })}
    {panel && panel.unmatched.length > 0 && <details open={panel.orders.length === 0} className="text-xs border-t pt-3"><summary className="cursor-pointer">Match an existing request</summary><div className="mt-2 space-y-2">
      {panel.unmatched.map(o => <p key={o.id} className="break-words">{o.requester_name ? `${o.requester_name} — ` : ''}{o.address}{o.requester_email ? ` · ${o.requester_email}` : ' · Requester email pending'}</p>)}
      <select className="w-full min-w-0 rounded border bg-background p-2" aria-label="Unmatched Aryeo request" value={selected} onChange={e => { setSelected(e.target.value); setConfirmed(false); }}><option value="">Select a request</option>{panel.unmatched.map(o => <option key={o.id} value={o.id}>{o.address}{o.unit_label ? ` / ${o.unit_label}` : ''} — {o.requester_email || o.requester_name || 'Requester email pending'}</option>)}</select>
      <label className="flex gap-2 items-start"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I verified this request belongs to this shoot and selected unit.</label>
      <Button size="sm" variant="outline" disabled={busy || !selected || !confirmed} onClick={() => void action(`requests/${selected}/match`, { unit_id: unitId ?? null, confirm_identity: true })}>Match request</Button>
    </div></details>}
  </section>;
}
