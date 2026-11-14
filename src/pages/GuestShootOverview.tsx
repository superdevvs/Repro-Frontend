import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BedDouble, Bath, Ruler, Download, ExternalLink, ShieldCheck, Mail, FileText } from 'lucide-react';
import { API_BASE_URL } from '@/config/env';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type GuestFile = { id: number; name: string; kind: string; preview_url: string; download_url: string };
type Overview = {
  property: { address: string; city: string; state: string; zip: string; beds: number | null; baths: number | null; sqft: number | null };
  services: Array<{ name: string; components: Array<{ label: string; status: string }> }>;
  files: GuestFile[]; tours: Array<{ label: string; url: string }>; expires_at: string;
};
type GuestResponse = { verified: boolean; recipient: string; data: Overview | null };

export default function GuestShootOverview() {
  const { token = '' } = useParams();
  return <GuestShootOverviewContent key={token} token={token} />;
}

function GuestShootOverviewContent({ token }: { token: string }) {
  const pendingRequests = useRef(new Set<AbortController>());
  useEffect(() => { const pending = pendingRequests.current; return () => { pending.forEach(controller => controller.abort()); }; }, []);
  const [result, setResult] = useState<GuestResponse | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [tab, setTab] = useState('photo');
  const [selected, setSelected] = useState<GuestFile | null>(null);
  const endpoint = `${API_BASE_URL}/api/public/guest-shares/${encodeURIComponent(token)}`;
  const request = useCallback(async (suffix = '', body?: object) => {
    const controller = new AbortController(); pendingRequests.current.add(controller);
    try {
      const response = await fetch(`${endpoint}${suffix}`, { credentials: 'include', cache: 'no-store', signal: controller.signal,
        method: body ? 'POST' : 'GET', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
      if (!response.ok) throw new Error(data.message || 'This invitation is unavailable.');
      return data;
    } finally { pendingRequests.current.delete(controller); }
  }, [endpoint]);
  const load = useCallback(async () => {
    const data = await request(); setResult(data);
    if (!data.verified) { setSelected(null); setCodeSent(false); setCode(''); setMessage(''); }
    else setSelected(previous => previous ? data.data?.files.find((file: GuestFile) => file.id === previous.id) ?? null : null);
  }, [request]);
  useEffect(() => {
    let current = true;
    setResult(null); setError('');
    void request().then(data => { if (current) setResult(data); }).catch((reason: Error) => { if (current) setError(reason.message); });
    return () => { current = false; };
  }, [request]);
  useEffect(() => {
    if (!result?.verified) return;
    const refresh = () => { if (!document.hidden) void load().catch((reason: Error) => { setResult(null); setSelected(null); setError(reason.message); }); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [result?.verified, load]);
  useEffect(() => {
    const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.appendChild(meta);
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex,nofollow'; document.head.appendChild(robots);
    return () => { meta.remove(); robots.remove(); };
  }, []);
  const sendCode = async () => {
    setBusy(true); setError(''); setMessage('');
    try { await request('/code', {}); setCodeSent(true); setMessage('Code sent. Check your inbox.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send code.'); }
    finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await request('/verify', { code }); await load(); setCode(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to verify code.'); }
    finally { setBusy(false); }
  };
  const retry = async () => {
    setBusy(true); setError('');
    try { await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to open the Magic Link.'); }
    finally { setBusy(false); }
  };
  const overview = result?.verified ? result.data : null;
  if (!overview) return <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground"><section className="w-full max-w-md space-y-6 rounded-3xl border bg-card p-8 shadow-xl"><ShieldCheck className="h-10 w-10 text-primary" /><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">R/E Pro Photos</p><h1 className="text-2xl font-semibold tracking-tight">Open your Magic Link</h1><p className="mt-3 text-sm text-muted-foreground">{result ? `Verify ${result.recipient} to view the media and tours. No account needed.` : error ? 'Ask the sender for a new Magic Link if access has expired.' : 'Opening your Magic Link…'}</p></div>
    {result && <>{!codeSent ? <Button className="w-full gap-2" disabled={busy} onClick={() => void sendCode()}><Mail className="h-4 w-4" />{busy ? 'Sending…' : 'Email me a verification code'}</Button> : <form onSubmit={verify} className="space-y-3"><Label htmlFor="guest-code">Six-digit code</Label><Input id="guest-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="text-center text-xl tracking-[.4em]" /><Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'View property'}</Button><Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => void sendCode()}>Send another code</Button></form>}</>}
    {!result && error && <Button variant="outline" className="w-full" disabled={busy} onClick={() => void retry()}>Try again</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
  </section></main>;
  const labels: Record<string, string> = { photo: 'Photos', floorplan: 'Floorplans', video: 'Videos', file: 'Files', tours: 'Tours' };
  const tabs = ['photo', 'floorplan', 'video', 'file', 'tours'].filter(kind => kind === 'photo' || kind === 'tours' || overview.files.some(file => file.kind === kind));
  const activeTab = tabs.includes(tab) ? tab : 'photo';
  const visible = overview.files.filter(file => file.kind === activeTab);
  const property = overview.property;
  return <main className="min-h-screen bg-background text-foreground"><header className="border-b px-5 py-5 md:px-10"><div className="mx-auto flex max-w-[1600px] items-center justify-between"><span className="text-sm font-semibold tracking-tight">R/E Pro Photos</span><span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Verified guest access</span></div></header>
    <div className="mx-auto grid max-w-[1680px] gap-8 p-5 md:p-10 lg:grid-cols-[300px_minmax(0,1fr)]"><aside className="space-y-5"><div><p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Property overview</p><h1 className="text-3xl font-semibold tracking-tight">{property.address}</h1><p className="mt-2 text-sm text-muted-foreground">{[property.city, property.state, property.zip].filter(Boolean).join(', ')}</p></div><div className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-4">{[[BedDouble, property.beds, 'Beds'], [Bath, property.baths, 'Baths'], [Ruler, property.sqft, 'Sq ft']].map(([Icon, value, label]) => { const MetricIcon = Icon as typeof BedDouble; return <div key={String(label)} className="space-y-1"><MetricIcon className="h-4 w-4 text-muted-foreground" /><p className="font-semibold">{value == null ? '—' : Number(value).toLocaleString()}</p><p className="text-xs text-muted-foreground">{String(label)}</p></div>; })}</div>
      <section className="rounded-2xl border bg-card p-4"><h2 className="mb-4 text-sm font-semibold">Delivery progress</h2><div className="space-y-4">{overview.services.map((service, index) => <div key={index}><h3 className="text-sm font-medium">{service.name}</h3>{service.components.map((component, componentIndex) => <div key={componentIndex} className="mt-2 flex justify-between gap-3 text-xs"><span className="text-muted-foreground">{component.label}</span><span className={component.status === 'delivered' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>{component.status === 'delivered' ? 'Delivered' : component.status === 'cancelled' ? 'Cancelled' : 'Pending'}</span></div>)}</div>)}</div></section>
      <p className="text-xs leading-relaxed text-muted-foreground">This view updates as more work is released. Only delivered media with client access appears here. Guest access expires {new Date(overview.expires_at).toLocaleDateString()}.</p>
    </aside><section className="min-w-0"><div className="mb-5 flex gap-2 overflow-x-auto" role="tablist" aria-label="Property media">{tabs.map(kind => <Button key={kind} role="tab" aria-selected={activeTab === kind} variant={activeTab === kind ? 'default' : 'outline'} className="rounded-full" onClick={() => setTab(kind)}>{labels[kind]} ({kind === 'tours' ? overview.tours.length : overview.files.filter(file => file.kind === kind).length})</Button>)}</div>
      {activeTab === 'tours' ? <div className="grid gap-3 sm:grid-cols-2">{overview.tours.map(tour => <a key={tour.url} href={tour.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 font-medium hover:border-primary">{tour.label}<ExternalLink className="h-4 w-4 shrink-0" /></a>)}{!overview.tours.length && <p className="p-8 text-sm text-muted-foreground">Tours will appear when released.</p>}</div> : visible.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(file => <article key={file.id} className="overflow-hidden rounded-2xl border bg-card"><button className="block aspect-[4/3] w-full overflow-hidden bg-muted" onClick={() => setSelected(file)} aria-label={`Preview ${file.name}`}>{file.kind === 'photo' ? <img src={file.preview_url} alt={file.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03] motion-reduce:transition-none" /> : <span className="flex h-full items-center justify-center"><FileText className="h-12 w-12 text-muted-foreground" /></span>}</button><div className="flex items-center justify-between gap-3 p-3"><span className="truncate text-xs" title={file.name}>{file.name}</span><a href={file.download_url} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label={`Download ${file.name}`}><Download className="h-4 w-4" /></a></div></article>)}</div> : <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">Released {labels[activeTab].toLowerCase()} will appear here when available.</div>}
    </section></div>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-w-5xl"><DialogTitle className="pr-8 text-sm">{selected?.name}</DialogTitle><DialogDescription className="sr-only">Shared property media preview</DialogDescription>{selected?.kind === 'photo' ? <img src={selected.preview_url} alt={selected.name} className="max-h-[75vh] w-full object-contain" /> : selected?.kind === 'video' ? <video controls src={selected.preview_url} className="max-h-[75vh] w-full" /> : selected && <a href={selected.preview_url} target="_blank" rel="noopener noreferrer" className="py-10 text-center text-primary">Open file preview <ExternalLink className="inline h-4 w-4" /></a>}{selected && <a href={selected.download_url} className="inline-flex items-center gap-2 text-sm text-primary"><Download className="h-4 w-4" />Download file</a>}</DialogContent></Dialog>
  </main>;
}
