import React, { useState } from 'react';
import { Copy, ExternalLink, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { crmApi } from '../../api';
import { useCrmMutation, useCrmQuery } from '../../hooks';
import { day } from '../../format';
import type { Person } from '../../types';
import { Field, Select, TextArea, TextInput } from '../../ui/fields';
import { Chip, Empty, ErrorNote, Loading } from '../../ui/primitives';
import { ROLE_LABEL } from './recruitingShared';

interface Posting { id: number; role: 'photographer' | 'sales_rep'; title: string; state: string; region: string | null; slug: string; description: string | null; status: 'draft' | 'open' | 'closed'; public_url: string; applicants: number | null; opened_at: string | null; closed_at: string | null }

/** Job postings (frame 15), each with a public apply page. */
export function PostingsTab({ canManage, states }: { canManage: boolean; states: Record<string, string> }) {
  const q = useCrmQuery<{ data: Posting[] }>(['crm', 'postings'], '/recruiting/postings');
  const [editing, setEditing] = useState<Posting | 'new' | null>(null);
  const status = useCrmMutation(({ id, s }: { id: number; s: Posting['status'] }) => crmApi.post(`/recruiting/postings/${id}/status`, { status: s }), { success: 'Posting updated' });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="flex flex-col gap-3">
      {canManage && <Button size="sm" variant="outline" className="self-start" onClick={() => setEditing('new')}><Plus className="mr-1.5 h-3.5 w-3.5" />New posting</Button>}
      {q.data?.data.length === 0 && <Empty title="No job postings yet.">Each posting gets its own apply page on the website.</Empty>}
      {(q.data?.data.length ?? 0) > 0 && (
        <div className="overflow-x-auto rounded-[10px] border">
          <table className="crm-table">
            <thead><tr><th>Posting</th><th>Role</th><th>Region</th><th>Status</th><th className="r">Applicants</th><th>Apply page</th>{canManage && <th />}</tr></thead>
            <tbody>
              {q.data!.data.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.title}</td>
                  <td>{ROLE_LABEL[p.role]}</td>
                  <td>{[p.region, states[p.state] ?? p.state].filter(Boolean).join(', ')}</td>
                  <td><Chip tone={p.status === 'open' ? 'green' : p.status === 'draft' ? 'line' : 'neutral'} className="capitalize">{p.status}</Chip>{p.opened_at && <span className="ml-1.5 text-xs text-muted-foreground">since {day(p.opened_at)}</span>}</td>
                  <td className="r tabular-nums">{p.applicants ?? 0}</td>
                  <td>
                    {p.status === 'open' ? (
                      <span className="flex items-center gap-1">
                        <a href={p.public_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-foreground hover:underline">/careers/{p.slug}<ExternalLink className="h-3 w-3" /></a>
                        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Copy link" onClick={() => { void navigator.clipboard.writeText(p.public_url); toast.success('Link copied'); }}><Copy className="h-3 w-3" /></Button>
                      </span>
                    ) : <span className="text-xs text-muted-foreground">Not public</span>}
                  </td>
                  {canManage && (
                    <td className="r">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(p)}>Edit</Button>
                        {p.status !== 'open' && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => status.mutate({ id: p.id, s: 'open' })}>Open</Button>}
                        {p.status === 'open' && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => status.mutate({ id: p.id, s: 'closed' })}>Close</Button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PostingDialog posting={editing} states={states} onClose={() => setEditing(null)} />
    </div>
  );
}

function PostingDialog({ posting, states, onClose }: { posting: Posting | 'new' | null; states: Record<string, string>; onClose: () => void }) {
  const isNew = posting === 'new';
  const [f, setF] = useState({ role: 'photographer', title: '', state: '', region: '', description: '' });
  React.useEffect(() => {
    if (posting && posting !== 'new') setF({ role: posting.role, title: posting.title, state: posting.state, region: posting.region ?? '', description: posting.description ?? '' });
    if (posting === 'new') setF({ role: 'photographer', title: '', state: '', region: '', description: '' });
  }, [posting]);
  const save = useCrmMutation(() => (isNew ? crmApi.post('/recruiting/postings', f) : crmApi.patch(`/recruiting/postings/${(posting as Posting).id}`, f)), { success: 'Posting saved' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open={posting !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="crm-root sm:max-w-xl">
        <DialogHeader><DialogTitle>{isNew ? 'New job posting' : 'Edit posting'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">{(id) => <Select id={id} value={f.role} onChange={set('role')} options={[{ value: 'photographer', label: 'Photographer' }, { value: 'sales_rep', label: 'Sales rep' }]} />}</Field>
          <Field label="State" required>{(id) => <Select id={id} value={f.state} onChange={set('state')} placeholder="Choose…" options={Object.entries(states).map(([code, name]) => ({ value: code, label: name }))} />}</Field>
          <Field label="Title" required className="col-span-2">{(id) => <TextInput id={id} value={f.title} onChange={set('title')} placeholder="Real estate photographer, Northern Virginia" />}</Field>
          <Field label="Region" className="col-span-2">{(id) => <TextInput id={id} value={f.region} onChange={set('region')} placeholder="Arlington, Alexandria, Fairfax" />}</Field>
          <Field label="Description" className="col-span-2" hint="Shown on the public apply page. Needed before the posting can open.">{(id, d) => <TextArea id={id} aria-describedby={d} rows={6} value={f.description} onChange={set('description')} />}</Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!f.title.trim() || !f.state || save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Coverage {
  states: { code: string; name: string; photographers: number; reps: number; in_pipeline: number; pipeline_by_role: { photographer: number; sales_rep: number }; open_postings: number; status: 'covered' | 'thin' | 'gap' }[];
  totals: { covered: number; thin: number; gap: number; photographers: number; reps: number; in_pipeline: number };
}

// Tile-grid map of the US: [row, column] per state.
const TILES: Record<string, [number, number]> = {
  AK: [0, 0], ME: [0, 11], VT: [1, 10], NH: [1, 11], WA: [2, 1], ID: [2, 2], MT: [2, 3], ND: [2, 4], MN: [2, 5], IL: [2, 6], WI: [2, 7], MI: [2, 8], NY: [2, 9], RI: [2, 10], MA: [2, 11],
  OR: [3, 1], NV: [3, 2], WY: [3, 3], SD: [3, 4], IA: [3, 5], IN: [3, 6], OH: [3, 7], PA: [3, 8], NJ: [3, 9], CT: [3, 10], CA: [4, 1], UT: [4, 2], CO: [4, 3], NE: [4, 4], MO: [4, 5],
  KY: [4, 6], WV: [4, 7], VA: [4, 8], MD: [4, 9], DE: [4, 10], AZ: [5, 2], NM: [5, 3], KS: [5, 4], AR: [5, 5], TN: [5, 6], NC: [5, 7], SC: [5, 8], DC: [5, 9], OK: [6, 4], LA: [6, 5],
  MS: [6, 6], AL: [6, 7], GA: [6, 8], HI: [7, 0], TX: [7, 4], FL: [7, 8],
};

/** Coverage map (frame 12): photographers and reps per state, and who is in the pipeline. */
export function CoverageTab() {
  const q = useCrmQuery<Coverage>(['crm', 'coverage'], '/recruiting/coverage');
  const [focus, setFocus] = useState<string | null>(null);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const byCode = Object.fromEntries(q.data.states.map((s) => [s.code, s]));
  const selected = focus ? byCode[focus] : null;
  const tone = (code: string) => {
    const s = byCode[code];
    if (!s) return 'bg-secondary text-muted-foreground/60';
    return s.status === 'covered' ? 'bg-emerald-500/85 text-white' : s.status === 'thin' ? 'bg-amber-400/90 text-amber-950' : 'bg-rose-500/80 text-white';
  };

  return (
    <div className="grid gap-5 crm-coverage-grid">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-emerald-500/85" />Covered (2+ photographers) · {q.data.totals.covered}</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-amber-400/90" />Thin (1) · {q.data.totals.thin}</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-rose-500/80" />Gap (applicants or postings, no photographer) · {q.data.totals.gap}</span>
        </div>
        <div className="grid aspect-[12/8] max-w-[760px] grid-cols-12 grid-rows-8 gap-1" role="grid" aria-label="Coverage by state">
          {Object.entries(TILES).map(([code, [row, col]]) => (
            <button key={code} type="button" onClick={() => setFocus(code)} aria-label={`${code}: ${byCode[code] ? `${byCode[code].photographers} photographers, ${byCode[code].in_pipeline} in pipeline` : 'no activity'}`}
              className={cn('flex flex-col items-center justify-center rounded-md text-[11px] font-semibold leading-tight transition-transform hover:scale-105', tone(code), focus === code && 'ring-2 ring-foreground ring-offset-1')}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}>
              {code}
              {byCode[code] && <span className="text-[9.5px] font-medium opacity-90">{byCode[code].photographers}·{byCode[code].in_pipeline}</span>}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Numbers on a state: photographers · applicants in the pipeline. Photographers count in the states of their service areas, or their home state.</p>
      </div>
      <div className="flex flex-col gap-3">
        {selected ? (
          <div className="rounded-[10px] border p-4">
            <h3 className="text-[15px] font-semibold">{selected.name}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
              <div><dt className="text-xs text-muted-foreground">Photographers</dt><dd className="text-xl font-semibold">{selected.photographers}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Sales reps</dt><dd className="text-xl font-semibold">{selected.reps}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Photographer applicants</dt><dd className="text-xl font-semibold">{selected.pipeline_by_role.photographer}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Rep applicants</dt><dd className="text-xl font-semibold">{selected.pipeline_by_role.sales_rep}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{selected.open_postings} open posting{selected.open_postings === 1 ? '' : 's'}</p>
          </div>
        ) : focus ? <Empty title={`Nothing in ${focus} yet.`} /> : <p className="text-[13px] text-muted-foreground">Pick a state to see who covers it.</p>}
        <div className="rounded-[10px] border p-4 text-[13px]">
          <p><b>{q.data.totals.photographers}</b> photographer placements · <b>{q.data.totals.reps}</b> rep placements · <b>{q.data.totals.in_pipeline}</b> in the pipeline</p>
        </div>
      </div>
    </div>
  );
}

interface RosterRow { user: Person | null; role: string; states: string[]; part107_expiry: string | null; insurance_expiry: string | null; part107_expiring: boolean; insurance_expiring: boolean; active: boolean }

/** Hired people with licence and insurance expiry dates; reminders go out 30 days ahead. */
export function RosterTab() {
  const [expiring, setExpiring] = useState(true);
  const q = useCrmQuery<{ data: RosterRow[] }>(['crm', 'roster', expiring], '/recruiting/roster', { expiring: expiring ? 1 : undefined });
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={expiring} onChange={(e) => setExpiring(e.target.checked)} />Only expiring in the next 30 days</label>
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.data.length === 0 && <Empty title={expiring ? 'Nothing expires in the next 30 days.' : 'Nobody hired through recruiting yet.'} />}
      {(q.data?.data.length ?? 0) > 0 && (
        <div className="overflow-x-auto rounded-[10px] border">
          <table className="crm-table">
            <thead><tr><th>Person</th><th>Role</th><th>States</th><th>FAA Part 107</th><th>Insurance</th></tr></thead>
            <tbody>
              {q.data!.data.map((r) => (
                <tr key={r.user?.id}>
                  <td className="font-medium">{r.user?.name}</td>
                  <td>{ROLE_LABEL[r.role] ?? r.role}</td>
                  <td>{r.states.join(', ') || '—'}</td>
                  <td>{r.part107_expiry ? <span className={r.part107_expiring ? 'crm-text-red font-medium' : ''}>{day(r.part107_expiry)}</span> : '—'}</td>
                  <td>{r.insurance_expiry ? <span className={r.insurance_expiring ? 'crm-text-red font-medium' : ''}>{day(r.insurance_expiry)}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
