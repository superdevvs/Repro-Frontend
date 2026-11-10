import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type Installation } from '@/components/integrations/AryeoApiIntegration';
import { aryeoApi, readable } from '@/services/aryeoApi';
import { AryeoCaseResolution, AryeoExecutorControls, AryeoPilotMetrics } from '@/components/integrations/AryeoOperatingControls';

type Destination = { id: string; workflow: string; provider_job_id: string | null; listing_url: string | null; association_status: string; on_hold: boolean; client_id: number; recipients: { email: string; provider_customer_id: string }[] };
type Export = { id: string; revision: string; status: string; phase: string; blocker: string | null; submitted_at: string | null; completed_at: string | null;
  outcomes: Record<string, string>; snapshot: { company_id: string; unit_id: number | null; legacy_listing_id: string; listing_url: string; recipients: Destination['recipients']; consent: { intent: string }; release: { paid: boolean; release_override: boolean }; assets: { id: number; filename: string; type: string; content: { sha256: string; bytes: number } }[]; tours: { id: string; url: string }[] };
  operations: { id: string; operation_key: string; status: string; error_code: string | null }[]; cases: { id: string; kind: string; status: string; owner: string; next_action: string; escalate_at: string }[];
  evidence: { id: string; feature: string; status: string; evidence_url: string; observed_at: string }[] };
type Panel = { destinations: { destination: Destination; blockers: string[]; exports: Export[] }[]; installations: Installation[] };
const states: Record<string, string[]> = { association: ['matched', 'ambiguous', 'needs_correction'], media: ['verified', 'incomplete'], branding: ['verified', 'missing', 'unable_to_verify'], hd: ['eligible', 'verified', 'not_eligible'], staging: ['processing', 'available', 'not_eligible'], notification: ['verified', 'unexpected', 'unverified'] };

export function AryeoApiPanel({ shootId, unitId }: { shootId: number | string; unitId?: number | string }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(async (signal?: AbortSignal) => { const r = await apiClient.get<Panel>(`/shoots/${shootId}/aryeo-api`, { params: { unit_id: unitId }, signal }); setPanel(r.data); }, [shootId, unitId]);
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal).catch(() => { if (!controller.signal.aborted) setError('Could not load API delivery.'); });
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(controller.signal).catch(() => undefined); }, 30000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [reload]);
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await task(); } catch { setError('Action was blocked. Review destination, approval, qualification, and recovery requirements.'); }
    finally { await reload().catch(() => undefined); setBusy(false); }
  };
  return <section className="space-y-3 rounded-lg border p-4" aria-label="Aryeo API delivery">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Aryeo API delivery</h3><Button size="sm" variant="outline" disabled={busy} onClick={() => void reload().catch(() => setError('Could not refresh.'))}>Refresh</Button></div>
    <p className="text-xs text-muted-foreground">Review the listing, recipients, and exact media before release. Delivery sends the property’s undelivered media and may email its customers and fulfill Aryeo orders.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {panel && !panel.installations.length && <p className="text-sm">Add a connection in Settings → Integrations → Aryeo delivery.</p>}
    {panel && panel.installations.length > 0 && <BindingForm installations={panel.installations} shootId={shootId} unitId={unitId} busy={busy} run={run} />}
    {panel?.destinations.map(({ destination: d, blockers, exports }) => <article className="space-y-3 rounded border p-3" key={d.id}>
      <p className="text-sm font-medium">{readable(d.workflow)} · {readable(d.association_status)}{d.on_hold && ' · On hold'}</p>
      <p className="text-xs">Recipients: {d.recipients.map(r => r.email).join(', ')}</p>
      {d.listing_url && <a href={d.listing_url} target="_blank" rel="noreferrer" className="text-sm underline">Open approved listing</a>}
      {blockers.length > 0 && <ul className="list-inside list-disc text-xs text-muted-foreground">{blockers.map(b => <li key={b}>{readable(b)}</li>)}</ul>}
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || d.on_hold} onClick={() => void run(() => apiClient.post(`${aryeoApi}/destinations/${d.id}/preview`))}>Preview current media</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => apiClient.patch(`${aryeoApi}/destinations/${d.id}/hold`, { on_hold: !d.on_hold }))}>{d.on_hold ? 'Remove shoot hold' : 'Hold this shoot'}</Button></div>
      {exports.map(e => <ExportCard key={e.id} value={e} busy={busy} run={run} />)}
      <AryeoExecutorControls destinationId={d.id} busy={busy} run={run} />
    </article>)}
  </section>;
}

function BindingForm({ installations, shootId, unitId, busy, run }: { installations: Installation[]; shootId: number | string; unitId?: number | string; busy: boolean; run: (task: () => Promise<unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ installation_id: installations[0]?.id ?? '', workflow: 'ordinary', request_record_id: '', provider_job_id: '', provider_place_id: '', legacy_listing_id: '', listing_url: '', email: '', provider_customer_id: '', evidence: '', distribution: '', intent: 'initial' });
  const [requirements, setRequirements] = useState({ photos: 1, floorplans: 0, videos: 0, tours: 0 });
  const [consent, setConsent] = useState(false);
  const [emails, setEmails] = useState(false);
  const field = (key: keyof typeof form, label: string, required = true, type = 'text') => <label className="text-xs" key={key}>{label}<Input required={required} type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>;
  return <details><summary className="cursor-pointer text-sm font-medium">Bind a verified listing or record one awaiting publication</summary>
    <form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); void run(() => apiClient.post(`/shoots/${shootId}/aryeo-api/destinations`, {
      installation_id: form.installation_id, unit_id: unitId ? Number(unitId) : null, workflow: form.workflow, request_record_id: form.request_record_id ? Number(form.request_record_id) : null,
      provider_job_id: form.provider_job_id || null, provider_place_id: form.provider_place_id || null, legacy_listing_id: form.legacy_listing_id || null, listing_url: form.listing_url || null,
      recipients: [{ email: form.email, provider_customer_id: form.provider_customer_id }], requirements, relationship_evidence_url: form.evidence,
      consent: { distribution_authorized: consent, dual_email_acknowledged: emails, evidence_url: form.distribution, intent: form.intent },
    })); }}>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Connection<select className="block w-full rounded border bg-background p-2" value={form.installation_id} onChange={e => setForm({ ...form, installation_id: e.target.value })}>{installations.map(i => <option key={i.id} value={i.id}>{i.name} ({i.environment})</option>)}</select></label><label className="text-xs">Workflow<select className="block w-full rounded border bg-background p-2" value={form.workflow} onChange={e => setForm({ ...form, workflow: e.target.value })}><option value="ordinary">Ordinary listing</option><option value="showcase">Existing Showcase request</option></select></label>
        {form.workflow === 'showcase' && field('request_record_id', 'Matched RePro request record ID')}
        {field('provider_job_id', 'Verified Aryeo Job ID', false)}{field('provider_place_id', 'Verified Aryeo Place ID', Boolean(form.provider_job_id))}{field('legacy_listing_id', 'Verified Aryeo listing ID', Boolean(form.provider_job_id))}{field('listing_url', 'Public Zillow listing URL', Boolean(form.provider_job_id), 'url')}
        {field('email', 'Verified recipient email', true, 'email')}{field('provider_customer_id', 'Verified provider customer ID')}{field('evidence', 'Customer / property / listing relationship evidence', true, 'url')}{field('distribution', 'Distribution authorization evidence', true, 'url')}
        <label className="text-xs">Delivery purpose<select className="block w-full rounded border bg-background p-2" value={form.intent} onChange={e => setForm({ ...form, intent: e.target.value })}><option value="initial">Initial delivery</option><option value="update">Staff approved update</option></select></label>
      </div>
      <p className="text-xs text-muted-foreground">Leave provider destination IDs empty to await a live listing. Later, bind its verified identities as a new destination. Addresses alone never authorize delivery.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(requirements).map(([kind, count]) => <label className="text-xs" key={kind}>Minimum {kind}<Input type="number" min={0} max={2000} value={count} onChange={e => setRequirements({ ...requirements, [kind]: Number(e.target.value) })} /></label>)}</div>
      <label className="flex gap-2 text-xs"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />Distribution is authorized for this listing and package.</label>
      <label className="flex gap-2 text-xs"><input type="checkbox" required checked={emails} onChange={e => setEmails(e.target.checked)} />Pilot recipient understands they may receive RePro and Aryeo emails.</label>
      <Button size="sm" type="submit" disabled={busy || !consent || !emails}>Save reviewed destination</Button>
    </form>
  </details>;
}

function ExportCard({ value: e, busy, run }: { value: Export; busy: boolean; run: (task: () => Promise<unknown>) => Promise<void> }) {
  const [ack, setAck] = useState(false);
  const [feature, setFeature] = useState('media');
  const [status, setStatus] = useState('verified');
  const [evidence, setEvidence] = useState('');
  const [reason, setReason] = useState('');
  const [kind, setKind] = useState('correction');
  const action = (name: string, body: object = {}) => run(() => apiClient.post(`${aryeoApi}/exports/${e.id}/actions/${name}`, body));
  const packet = () => run(async () => { const r = await apiClient.get(`${aryeoApi}/exports/${e.id}/support`, { responseType: 'blob' }); const url = URL.createObjectURL(r.data); const a = document.createElement('a'); a.href = url; a.download = `aryeo-support-${e.id}.json`; a.click(); URL.revokeObjectURL(url); });
  return <details className="rounded border p-3" open={['draft', 'outcome_unknown', 'blocked', 'correction_required'].includes(e.status)}><summary className="cursor-pointer text-sm font-medium">{readable(e.status)} · Revision {e.revision.slice(0, 10)}</summary><div className="mt-3 space-y-3">
    <div className="flex flex-wrap gap-2 text-xs">{Object.entries(e.outcomes).map(([key, value]) => <span className="rounded bg-muted px-2 py-1" key={key}>{readable(key)}: {readable(value)}</span>)}</div>
    {e.blocker && <p role="status" className="text-sm">Needs attention: {readable(e.blocker)}</p>}
    <p className="text-xs">{e.snapshot.assets.length} files · {e.snapshot.tours.length} tour links · {e.snapshot.release.release_override ? 'Explicit release override' : e.snapshot.release.paid ? 'Paid / complimentary release' : 'Release review required'} · {e.snapshot.consent.intent} delivery</p>
    <p className="break-all text-xs">Company: {e.snapshot.company_id} · Listing: {e.snapshot.legacy_listing_id || 'Awaiting listing'} · Unit: {e.snapshot.unit_id ?? 'Whole property'}<br />Recipients: {e.snapshot.recipients.map(r => r.email).join(', ')}</p>
    <details><summary className="cursor-pointer text-xs">Exact approved package and history</summary><ol className="list-inside list-decimal text-xs">{e.snapshot.assets.map(a => <li key={a.id}>{a.filename} · {a.type} · {a.content.bytes} bytes <span className="break-all text-muted-foreground">SHA256 {a.content.sha256}</span></li>)}</ol>{e.snapshot.tours.map(t => <p className="break-all text-xs" key={t.id}>{t.id}: {t.url}</p>)}{e.operations.map(op => <p className="text-xs" key={op.id}>{op.operation_key}: {op.status}{op.error_code && ` · ${readable(op.error_code)}`}</p>)}{e.evidence.map(v => <p className="text-xs" key={v.id}>{v.feature}: {v.status} · <a className="underline" href={v.evidence_url} target="_blank" rel="noreferrer">Evidence</a> · {new Date(v.observed_at).toLocaleString()}</p>)}</details>
    {e.status === 'draft' && <><label className="flex gap-2 text-xs"><input type="checkbox" checked={ack} onChange={v => setAck(v.target.checked)} />I reviewed this destination, recipients, package and email/order effects. The named destination is reserved with no outside editing for the next two hours. I will supervise delivery. Outside-edit risk remains.</label><Button size="sm" disabled={busy || !ack} onClick={() => void action('approve', { revision: e.revision, editing_window_until: new Date(Date.now() + 2 * 3600000).toISOString(), no_external_editing_acknowledged: ack })}>Approve this revision</Button></>}
    <div className="flex flex-wrap gap-2">{['approved', 'blocked'].includes(e.status) && <Button size="sm" disabled={busy} onClick={() => void action('submit')}>Submit / resume approved work</Button>}
      {e.operations.some(o => ['sent', 'unknown'].includes(o.status)) && <Button size="sm" variant="outline" disabled={busy} onClick={() => void action('reconcile')}>Reconcile provider outcome</Button>}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void packet()}>Download support packet</Button></div>
    {e.cases.filter(c => c.status === 'open').map(c => <p className="rounded border p-2 text-xs" key={c.id}>{readable(c.kind)} · Owner: {c.owner}<br />Next: {c.next_action}<br />Partner escalation due: {new Date(c.escalate_at).toLocaleString()}</p>)}
    {e.cases.map(c => <AryeoCaseResolution key={c.id} value={c} busy={busy} run={run} />)}
    <AryeoPilotMetrics exportId={e.id} busy={busy} run={run} />
    <AryeoExecutorControls exportId={e.id} revision={e.revision} busy={busy} run={run} />
    <details><summary className="cursor-pointer text-xs">Record listing or benefit verification</summary><form className="mt-2 flex flex-wrap gap-2" onSubmit={v => { v.preventDefault(); void run(() => apiClient.post(`${aryeoApi}/exports/${e.id}/evidence`, { feature, status, evidence_url: evidence, listing_url: e.snapshot.listing_url, revision: e.revision, observed_at: new Date().toISOString() })); }}>
      <select aria-label="Verification feature" className="rounded border bg-background p-2" value={feature} onChange={v => { setFeature(v.target.value); setStatus(states[v.target.value][0]); }}>{Object.keys(states).map(k => <option key={k} value={k}>{readable(k)}</option>)}</select><select aria-label="Verification result" className="rounded border bg-background p-2" value={status} onChange={v => setStatus(v.target.value)}>{states[feature].map(s => <option key={s} value={s}>{readable(s)}</option>)}</select><Input aria-label="Verification evidence URL" type="url" required placeholder="Evidence URL" value={evidence} onChange={v => setEvidence(v.target.value)} /><Button size="sm" type="submit" disabled={busy || !e.snapshot.listing_url}>Record evidence</Button>
    </form></details>
    <details><summary className="cursor-pointer text-xs">Cancel, correct, or remove media</summary><div className="mt-2 space-y-2"><Input aria-label="Correction reason" placeholder="Reason and affected media" value={reason} onChange={v => setReason(v.target.value)} /><select aria-label="Correction kind" className="rounded border bg-background p-2" value={kind} onChange={v => setKind(v.target.value)}>{['correction', 'removal', 'wrong_destination', 'unauthorized_release', 'duplicate_delivery'].map(k => <option key={k} value={k}>{readable(k)}</option>)}</select><p className="text-xs">Stopping downloads cannot recall bytes already received. Provider removal requires independent verification.</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy || !reason || ['delivered', 'cancelled'].includes(e.status)} onClick={() => void action('cancel', { reason })}>Cancel export</Button><Button size="sm" variant="outline" disabled={busy || !reason} onClick={() => void run(() => apiClient.post(`${aryeoApi}/exports/${e.id}/cases`, { kind, reason, owner: 'Shubham', next_action: 'Reconcile exact provider assets; arrange correction or removal and verify downstream result' }))}>Open case and hold destination</Button></div></div></details>
  </div></details>;
}
