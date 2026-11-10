import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { aryeoApi, readable } from '@/services/aryeoApi';
import { AryeoAlerts } from './AryeoOperatingControls';
type Requirement = { status: string; owner: string; counterpart?: string; deadline: string; evidence_url: string | null };
export type Installation = { id: string; name: string; environment: string; company_id: string; status: string; paused: boolean;
  enrolled: boolean; paused_workflows: string[] | null; allowed_client_ids: number[] | null; allowed_shoot_ids: number[] | null;
  requirements: Record<string, Requirement>; capabilities: { media?: Capability[] } };
type Capability = { key: string; workflow: string; ingest: boolean; listing: boolean; product: boolean; evidence_url: string };
type Overview = { installations: Installation[]; provider_enabled: boolean; writes_enabled: boolean; production_enabled: boolean; automation_supported: boolean };

export function AryeoApiIntegration() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('RePro pilot');
  const [company, setCompany] = useState('');
  const [environment, setEnvironment] = useState('sandbox');
  const reload = useCallback(async () => { const r = await apiClient.get<Overview>(`${aryeoApi}/installations`); setData(r.data); }, []);
  useEffect(() => { void reload().catch(() => setError('Could not load Aryeo API settings.')); }, [reload]);
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await task(); await reload(); } catch { setError('Could not save. Check required fields, access, and qualification evidence.'); } finally { setBusy(false); }
  };
  return <section className="space-y-5" aria-label="Aryeo API settings">
    <AryeoAlerts />
    <div><h2 className="text-lg font-semibold">Zillow / Aryeo delivery</h2><p className="text-sm text-muted-foreground">RePro controls media approval and release. Aryeo delivery and Zillow benefits are verified separately.</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {data && <p className="rounded-md border p-3 text-sm">Provider access: {data.provider_enabled ? 'Enabled' : 'Disabled'} · Sending: {data.writes_enabled ? 'Enabled for qualified pilots' : 'Disabled'} · Production: {data.production_enabled ? 'Pilot enabled' : 'Disabled'}<br />Staff approval is required. Unattended delivery awaits enforceable package protection.</p>}
    <form className="grid gap-3 rounded-md border p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void run(() => apiClient.post(`${aryeoApi}/installations`, { name, company_id: company, environment })); }}>
      <label className="text-sm">Connection name<Input required value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="text-sm">Provider company ID<Input required value={company} onChange={e => setCompany(e.target.value)} placeholder="Verified company UUID" /></label>
      <label className="text-sm">Environment<select className="ml-3 rounded border bg-background p-2" value={environment} onChange={e => setEnvironment(e.target.value)}><option value="sandbox">Sandbox</option><option value="production">Production pilot</option></select></label>
      <Button disabled={busy} type="submit">Add paused connection</Button>
    </form>
    {data?.installations.map(i => <InstallationEditor key={i.id} installation={i} busy={busy} run={run} />)}
  </section>;
}

function InstallationEditor({ installation: i, busy, run }: { installation: Installation; busy: boolean; run: (task: () => Promise<unknown>) => Promise<void> }) {
  const [rows, setRows] = useState(i.requirements);
  const [clients, setClients] = useState((i.allowed_client_ids ?? []).join(', '));
  const [shoots, setShoots] = useState((i.allowed_shoot_ids ?? []).join(', '));
  const [enrolled, setEnrolled] = useState(i.enrolled);
  const [capabilities, setCapabilities] = useState<Capability[]>(i.capabilities?.media ?? []);
  useEffect(() => { setRows(i.requirements); setCapabilities(i.capabilities?.media ?? []); }, [i]);
  const patch = (body: object) => run(() => apiClient.patch(`${aryeoApi}/installations/${i.id}`, body));
  const connect = (kind: string) => run(async () => {
    const r = await apiClient.post<{ url: string }>(`${aryeoApi}/installations/${i.id}/connect`, { kind });
    const url = new URL(r.data.url);
    if (url.protocol !== 'https:' || !['auth.aryeo.com', 'app.aryeo.com'].includes(url.hostname)) throw new Error('Unexpected authorization host');
    window.location.assign(url.href);
  });
  const ids = (value: string) => value.split(',').map(v => v.trim()).filter(Boolean).map(Number);
  return <article className="space-y-4 rounded-lg border p-4">
    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{i.name}</h3><span className="text-xs">{i.environment} · {readable(i.status)} · {i.paused ? 'Paused' : 'Active'}</span></div>
    <p className="break-all text-xs text-muted-foreground">Company: {i.company_id}</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void connect('install')}>Install application</Button><Button variant="outline" disabled={busy} onClick={() => void connect('delegate')}>Connect / reconnect user</Button><Button disabled={busy} variant="outline" onClick={() => void patch({ paused: !i.paused })}>{i.paused ? 'Resume qualified work' : 'Pause all work'}</Button>
      {['ordinary', 'showcase'].map(workflow => <Button key={workflow} disabled={busy} variant="outline" onClick={() => void patch({ paused_workflows: (i.paused_workflows ?? []).includes(workflow) ? (i.paused_workflows ?? []).filter(w => w !== workflow) : [...(i.paused_workflows ?? []), workflow] })}>{(i.paused_workflows ?? []).includes(workflow) ? 'Resume' : 'Pause'} {workflow}</Button>)}</div>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void patch({ enrolled, allowed_client_ids: ids(clients), allowed_shoot_ids: ids(shoots), requirements: rows, capabilities: { media: capabilities } }); }}>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={enrolled} onChange={e => setEnrolled(e.target.checked)} />Program enrollment confirmed</label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Pilot client IDs<Input value={clients} onChange={e => setClients(e.target.value)} placeholder="Comma separated IDs" /></label><label className="text-sm">Pilot shoot IDs<Input value={shoots} onChange={e => setShoots(e.target.value)} /></label></div>
      <details><summary className="cursor-pointer font-medium">Partner requirements and evidence</summary><p className="my-2 text-xs text-muted-foreground">Documentation alone is not a demonstration. Record an accountable owner, deadline, and actual test evidence.</p>
        <div className="space-y-3">{Object.entries(rows).map(([key, row]) => <fieldset className="grid gap-2 rounded border p-3 sm:grid-cols-2" key={key}><legend className="text-sm">{readable(key)}</legend>
          <label className="text-xs">Status<select aria-label={`${key} status`} className="block w-full rounded border bg-background p-2" value={row.status} onChange={e => setRows({ ...rows, [key]: { ...row, status: e.target.value } })}><option value="unconfirmed">Unconfirmed</option><option value="sandbox_demonstrated">Demonstrated in sandbox</option><option value="production_verified">Verified in production</option></select></label>
          {(['owner', 'deadline', 'evidence_url'] as const).map(field => <label className="text-xs" key={field}>{readable(field)}<Input required={field !== 'evidence_url' || row.status !== 'unconfirmed'} type={field === 'evidence_url' ? 'url' : 'text'} value={row[field] ?? ''} onChange={e => setRows({ ...rows, [key]: { ...row, [field]: e.target.value || null } })} /></label>)}
        </fieldset>)}</div>
      </details>
      <details><summary className="cursor-pointer font-medium">Qualified media capabilities</summary><p className="my-2 text-xs text-muted-foreground">Qualify transfer, listing distribution, and product eligibility independently. A floor plan image is not an interactive floor plan.</p>
        {capabilities.map((cap, n) => <fieldset className="my-3 space-y-2 rounded border p-3" key={n}><legend>Capability {n + 1}</legend><div className="flex flex-wrap gap-2">
          <select aria-label={`Capability ${n + 1} media`} className="rounded border bg-background p-2" value={cap.key} onChange={e => setCapabilities(capabilities.map((c, x) => x === n ? { ...c, key: e.target.value } : c))}>{['photos:image/jpeg', 'photos:image/png', 'floor_plans:image/jpeg', 'floor_plans:image/png', 'videos:video/mp4', 'tour:zillow_3d', 'tour:matterport_mls', 'tour:matterport_branded', 'tour:iguide_mls', 'tour:iguide_branded'].map(k => <option key={k}>{k}</option>)}</select>
          <select aria-label={`Capability ${n + 1} workflow`} className="rounded border bg-background p-2" value={cap.workflow} onChange={e => setCapabilities(capabilities.map((c, x) => x === n ? { ...c, workflow: e.target.value } : c))}><option>ordinary</option><option>showcase</option></select>
          {(['ingest', 'listing', 'product'] as const).map(k => <label key={k} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={cap[k]} onChange={e => setCapabilities(capabilities.map((c, x) => x === n ? { ...c, [k]: e.target.checked } : c))} />{k}</label>)}</div>
          <Input aria-label={`Capability ${n + 1} evidence`} type="url" required placeholder="https://… demonstration evidence" value={cap.evidence_url} onChange={e => setCapabilities(capabilities.map((c, x) => x === n ? { ...c, evidence_url: e.target.value } : c))} />
        </fieldset>)}<Button type="button" variant="outline" onClick={() => setCapabilities([...capabilities, { key: 'photos:image/jpeg', workflow: 'ordinary', ingest: false, listing: false, product: false, evidence_url: '' }])}>Add capability</Button>
      </details><Button type="submit" disabled={busy}>Save pilot requirements</Button>
    </form>
  </article>;
}
