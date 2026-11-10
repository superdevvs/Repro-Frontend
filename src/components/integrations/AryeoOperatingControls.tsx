import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/services/api';
import { aryeoApi, readable } from '@/services/aryeoApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Run = (task: () => Promise<unknown>) => Promise<void>;
type Case = { id: string; kind: string; status: string };

export function AryeoAlerts() {
  const [alerts, setAlerts] = useState<{ key: string; owner: string; message: string; created_at: string }[]>([]);
  const load = useCallback(async () => { const r = await apiClient.get<{ alerts: typeof alerts }>(`${aryeoApi}/alerts`); setAlerts(r.data.alerts); }, []);
  useEffect(() => { void load().catch(() => undefined); const timer = window.setInterval(() => void load().catch(() => undefined), 30000); return () => clearInterval(timer); }, [load]);
  return alerts.length > 0 ? <aside aria-label="Aryeo operating alerts" className="space-y-2 rounded border border-amber-500 p-3"><h3 className="font-medium">Operating alerts</h3>{alerts.map(a => <p className="text-sm" key={a.key}>{a.owner}: {a.message} <Button size="sm" variant="outline" onClick={() => void apiClient.post(`${aryeoApi}/alerts/acknowledge`, { key: a.key }).then(load).catch(() => undefined)}>Acknowledge</Button></p>)}</aside> : null;
}

export function AryeoCaseResolution({ value: c, busy, run }: { value: Case; busy: boolean; run: Run }) {
  const [proof, setProof] = useState({ evidence_url: '', fix_url: '', regression_test_url: '', run1: '', run2: '' });
  const [ack, setAck] = useState(false);
  const critical = ['wrong_destination', 'unauthorized_release', 'duplicate_delivery'].includes(c.kind);
  if (c.status !== 'open' || c.kind === 'unknown_operation') return null;
  return <details><summary className="cursor-pointer text-xs">Resolve {readable(c.kind)} after verification</summary><form className="mt-2 space-y-2" onSubmit={e => { e.preventDefault(); void run(() => apiClient.post(`${aryeoApi}/cases/${c.id}/resolve`, { evidence_url: proof.evidence_url, provider_objects_accounted_for: ack, downstream_verified: ack, ...(critical ? { fix_url: proof.fix_url, regression_test_url: proof.regression_test_url, supervised_runs: [proof.run1, proof.run2] } : {}) })); }}>
    {(['evidence_url', ...(critical ? ['fix_url', 'regression_test_url', 'run1', 'run2'] : [])] as (keyof typeof proof)[]).map(k => <label className="block text-xs" key={k}>{readable(k)}<Input required type="url" value={proof[k]} onChange={e => setProof({ ...proof, [k]: e.target.value })} /></label>)}
    <label className="flex gap-2 text-xs"><input required type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />All provider objects are accounted for and the downstream correction/removal is independently verified.</label>
    <Button size="sm" type="submit" disabled={busy || !ack}>Record resolution; retain hold</Button>
  </form></details>;
}

export function AryeoPilotMetrics({ exportId, busy, run }: { exportId: string; busy: boolean; run: Run }) {
  const [data, setData] = useState({ operator_minutes: '0', recovery_actions: '', expected_notifications: '2', observed_notifications: '0', evidence_url: '', listing_live_at: '', benefits_verified_at: '' });
  return <details><summary className="cursor-pointer text-xs">Record pilot effort and observed results</summary><form className="mt-2 grid gap-2 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void run(() => apiClient.patch(`${aryeoApi}/exports/${exportId}/metrics`, { ...data, operator_minutes: Number(data.operator_minutes), expected_notifications: Number(data.expected_notifications), observed_notifications: Number(data.observed_notifications), listing_live_at: data.listing_live_at ? new Date(data.listing_live_at).toISOString() : null, benefits_verified_at: data.benefits_verified_at ? new Date(data.benefits_verified_at).toISOString() : null })); }}>
    {(Object.keys(data) as (keyof typeof data)[]).map(k => <label className="text-xs" key={k}>{readable(k)}<Input required={!k.endsWith('_at')} type={k.endsWith('_at') ? 'datetime-local' : k === 'evidence_url' ? 'url' : k === 'recovery_actions' ? 'text' : 'number'} min={0} value={data[k]} onChange={e => setData({ ...data, [k]: e.target.value })} /></label>)}<Button type="submit" size="sm" disabled={busy}>Save pilot observation</Button>
  </form></details>;
}

export function AryeoExecutorControls({ exportId, destinationId, revision, busy, run }: { exportId?: string; destinationId?: string; revision?: string; busy: boolean; run: Run }) {
  const [ack, setAck] = useState(false);
  const [evidence, setEvidence] = useState('');
  return <details><summary className="cursor-pointer text-xs">Executor recovery and handoff</summary><div className="mt-2 space-y-2"><Input aria-label="Executor evidence URL" placeholder="https://… stop and reconciliation evidence" type="url" value={evidence} onChange={e => setEvidence(e.target.value)} /><label className="flex gap-2 text-xs"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />The prior executor is stopped, uncertain operations are reconciled, and I reviewed this destination again.</label><div className="flex flex-wrap gap-2">
    {exportId && <Button size="sm" variant="outline" disabled={busy || !ack || !evidence} onClick={() => void run(() => apiClient.post(`${aryeoApi}/exports/${exportId}/actions/release-executor`, { previous_executor_stopped: ack, evidence_url: evidence }))}>Release stopped executor</Button>}
    {exportId && revision && <Button size="sm" variant="outline" disabled={busy || !ack} onClick={() => void run(() => apiClient.post(`${aryeoApi}/exports/${exportId}/actions/renew-approval`, { revision, no_external_editing_acknowledged: ack, editing_window_until: new Date(Date.now() + 2 * 3600000).toISOString() }))}>Renew supervised window for two hours</Button>}
    {destinationId && ['api', 'bridge'].map(executor => <Button key={executor} size="sm" variant="outline" disabled={busy || !ack || !evidence} onClick={() => void run(() => apiClient.post(`${aryeoApi}/destinations/${destinationId}/handoff`, { executor, old_executor_stopped: ack, evidence_url: evidence }))}>Reconcile handoff to {executor}</Button>)}
  </div></div></details>;
}
