import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Search, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageSearch } from '@/components/search/PageSearch';
import { crmApi } from '../api';
import { crmKeys, useCrmMeta, useCrmMutation, useCrmQuery } from '../hooks';
import { ago } from '../format';
import { useRobbieWhere } from '../robbie/useCrmRobbie';
import type { Contact, Paged, Stat } from '../types';
import { Field, FilterSelect, Select } from '../ui/fields';
import { Avatar, Chip, CrmPage, Empty, ErrorNote, Loading, StageChip, StatStrip } from '../ui/primitives';
import { ContactFormDialog } from '../components/ContactFormDialog';
import { ImportDialog } from '../components/ImportDialog';

/** Contacts list (frame 13). Admins see everyone and can bulk-assign; reps see their own. */
export default function ContactsPage() {
  useRobbieWhere({ page: 'contacts' });
  const { data: meta } = useCrmMeta();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const search = params.get('search') ?? '';
  const stage = params.get('stage') ?? '';
  const rep = params.get('rep_id') ?? '';
  const segment = params.get('segment') ?? '';
  const market = params.get('market_state') ?? params.get('market') ?? '';
  const review = params.get('filter') === 'needs_review';
  const filterCount = [stage, rep, segment, market, review].filter(Boolean).length;
  const setFilter = (key: string, value: string) => setParams((old) => {
    const next = new URLSearchParams(old);
    if (key === 'market_state') next.delete('market');
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bulk, setBulk] = useState<'assign' | 'drip' | null>(null);

  useEffect(() => { setPage(1); setSelected([]); }, [search, stage, rep, segment, market, review]);
  useEffect(() => {
    if (params.get('new') === '1' && meta) { setAdding(meta.can.create); params.delete('new'); setParams(params, { replace: true }); }
  }, [params, setParams, meta]);

  const filters = { search, stage, rep_id: rep, segment, market_state: market, needs_review: review || undefined, include_lost: stage === 'lost' || undefined, page, per_page: 50 };
  const list = useCrmQuery<Paged<Contact>>(crmKeys.contacts(filters), '/contacts', filters);
  const stats = useCrmQuery<{ stats: Stat[] } | Stat[]>(['crm', 'contacts', 'stats'], '/contacts/stats');
  const statList = Array.isArray(stats.data) ? stats.data : stats.data?.stats;

  const rows = list.data?.data ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const canBulk = Boolean(meta?.can.assign || meta?.can.enrol_drips);

  return (
    <CrmPage
      title="Contacts"
      count={list.data?.meta.total ?? null}
      description={meta?.can.view_all ? 'Everyone in the CRM, across all reps.' : 'The contacts assigned to you.'}
      actions={<>
        {meta?.can.import && <Button variant="outline" size="sm" className="h-8" onClick={() => setImporting(true)}><Upload className="mr-1.5 h-3.5 w-3.5" />Import</Button>}
        {meta?.can.create && <Button size="sm" className="h-8" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add contact</Button>}
      </>}
    >
      {statList && <StatStrip stats={statList} className="max-md:grid-cols-2" />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex h-8 w-60 items-center rounded-lg border bg-background max-md:h-10 max-md:w-full" data-page-search-container>
          <Search className="ml-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <PageSearch searchId="crm-contacts" scope="crm-contacts" scopeLabel="Contacts" priority={20} aria-label="Search contacts" placeholder="Search name, company, email, phone" value={search} onChange={(e) => setFilter('search', e.target.value)}
            className="h-full border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0" />
        </div>
        <Button type="button" variant="outline" size="sm" className="md:hidden" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>Filters{filterCount ? ` (${filterCount})` : ''}</Button>
        <div className={`flex-wrap items-center gap-2 md:flex ${filtersOpen ? 'flex' : 'hidden'}`}>
        <FilterSelect label="Stage" allLabel="All open" value={stage} onChange={(v) => setFilter('stage', v)} options={(meta?.stages ?? []).map((s) => ({ value: s.key, label: s.label }))} />
        {meta?.can.view_all && <FilterSelect label="Rep" allLabel="All reps" value={rep} onChange={(v) => setFilter('rep_id', v)} options={[{ value: 'unassigned', label: 'Unassigned' }, ...meta.reps.map((r) => ({ value: String(r.id), label: r.name }))]} />}
        <FilterSelect label="Segment" allLabel="All" value={segment} onChange={(v) => setFilter('segment', v)} options={(meta?.segments ?? []).map((s) => ({ value: s.key, label: s.label }))} />
        <FilterSelect label="Market" allLabel="All markets" value={market} onChange={(v) => setFilter('market_state', v)} options={(meta?.markets ?? []).map((m) => ({ value: m, label: m }))} />
        <label className="flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[13px]"><input type="checkbox" checked={review} onChange={(e) => setFilter('filter', e.target.checked ? 'needs_review' : '')} />Needs clean-up</label>
        {filterCount > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setParams(search ? { search } : {}, { replace: true })}>Clear filters</Button>}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border bg-accent px-3 py-2 text-[13px] text-accent-foreground">
          <b>{selected.length} selected</b>
          {meta?.can.assign && <Button size="sm" variant="outline" className="h-7 bg-card" onClick={() => setBulk('assign')}>Assign rep</Button>}
          {meta?.can.enrol_drips && <Button size="sm" variant="outline" className="h-7 bg-card" onClick={() => setBulk('drip')}>Enrol in drip</Button>}
          <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}

      {list.isLoading && <Loading />}
      {list.error && <ErrorNote error={list.error} onRetry={() => list.refetch()} />}
      {list.data && rows.length === 0 && (
        <Empty icon={<Users className="h-5 w-5" />} title={search || stage || rep || segment || market || review ? 'No contacts match these filters.' : 'No contacts yet.'}
          action={meta?.can.create ? <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add contact</Button> : undefined}>
          {meta?.can.import ? 'Add one, or import a CSV from your old spreadsheet.' : undefined}
        </Empty>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-[10px] border">
          <table className="crm-table">
            <thead>
              <tr>
                {canBulk && <th className="w-8"><input type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} /></th>}
                <th>Name</th><th className="max-md:hidden">Company</th><th>Stage</th><th className="max-lg:hidden">Segment</th><th className="max-lg:hidden">Market</th>
                {meta?.can.view_all && <th className="max-md:hidden">Rep</th>}<th className="max-md:hidden">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} data-href onClick={() => navigate(`/crm/contacts/${c.id}`)}>
                  {canBulk && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.includes(c.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id))} /></td>}
                  <td>
                    <div className="flex items-center gap-2">
                      <Link to={`/crm/contacts/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{c.name}</Link>
                      {c.needs_review && <Chip tone="amber" title={c.review_reasons.join(', ')}>Clean-up</Chip>}
                      {c.email_opted_out && <Chip tone="line">Unsubscribed</Chip>}
                    </div>
                    <div className="text-xs text-muted-foreground md:hidden">{c.company}</div>
                  </td>
                  <td className="max-md:hidden">{c.company ?? <span className="text-muted-foreground">—</span>}</td>
                  <td><StageChip stage={c.stage} label={c.stage_label} /></td>
                  <td className="max-lg:hidden capitalize">{c.segment}</td>
                  <td className="max-lg:hidden">{c.market ?? '—'}</td>
                  {meta?.can.view_all && <td className="max-md:hidden">{c.assigned_rep ? <span className="flex items-center gap-1.5"><Avatar person={c.assigned_rep} size="sm" />{c.assigned_rep.name}</span> : <Chip tone="amber">Unassigned</Chip>}</td>}
                  <td className="max-md:hidden text-muted-foreground">{c.last_contacted_at ? ago(c.last_contacted_at) : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && list.data.meta.last_page > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          Page {list.data.meta.page} of {list.data.meta.last_page}
          <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Next page" disabled={page >= list.data.meta.last_page} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      <ContactFormDialog open={adding} onOpenChange={setAdding} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
      <BulkDialog kind={bulk} ids={selected} onClose={(done) => { setBulk(null); if (done) setSelected([]); }} />
    </CrmPage>
  );
}

function BulkDialog({ kind, ids, onClose }: { kind: 'assign' | 'drip' | null; ids: number[]; onClose: (done: boolean) => void }) {
  const { data: meta } = useCrmMeta();
  const [value, setValue] = useState('');
  const drips = useCrmQuery<{ data: { id: number; name: string; status: string }[] }>(['crm', 'drips'], '/drips', undefined, kind === 'drip');
  useEffect(() => setValue(''), [kind]);
  type BulkResult = { updated?: number; enrolled?: number; skipped?: number };
  const run = useCrmMutation<void, BulkResult>(
    () => kind === 'assign'
      ? crmApi.post<BulkResult>('/contacts/bulk-assign', { ids, rep_id: value ? Number(value) : null })
      : crmApi.post<BulkResult>('/drips/bulk-enrol', { ids, campaign_id: Number(value) }),
    { success: (r) => kind === 'assign' ? `${r.updated} contacts updated` : `${r.enrolled} enrolled${r.skipped ? `, ${r.skipped} skipped` : ''}` },
  );
  return (
    <Dialog open={kind !== null} onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="crm-root sm:max-w-[420px]">
        <DialogHeader><DialogTitle>{kind === 'assign' ? `Assign ${ids.length} contacts` : `Enrol ${ids.length} contacts in a drip`}</DialogTitle></DialogHeader>
        {kind === 'assign' && <Field label="Rep" hint="Every change is logged on each contact.">{(id, d) => <Select id={id} aria-describedby={d} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Unassigned" options={(meta?.reps ?? []).map((r) => ({ value: String(r.id), label: r.name }))} />}</Field>}
        {kind === 'drip' && <Field label="Drip" hint="Contacts already on another drip move to this one; unsubscribed contacts are skipped.">{(id, d) => <Select id={id} aria-describedby={d} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Choose…" options={(drips.data?.data ?? []).filter((x) => x.status === 'live').map((x) => ({ value: String(x.id), label: x.name }))} />}</Field>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onClose(false)}>Cancel</Button>
          <Button disabled={run.isPending || (kind === 'drip' && !value)} onClick={() => run.mutate(undefined, { onSuccess: () => onClose(true) })}>{run.isPending ? 'Saving…' : 'Apply'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
