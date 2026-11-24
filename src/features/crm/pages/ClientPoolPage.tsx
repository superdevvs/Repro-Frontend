import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserCheck } from 'lucide-react';
import { PageSearch } from '@/components/search/PageSearch';
import { cn } from '@/lib/utils';
import { useCrmMeta, useCrmQuery } from '../hooks';
import { ago, day } from '../format';
import { useRobbieWhere } from '../robbie/useCrmRobbie';
import type { Contact, Paged } from '../types';
import { FilterSelect } from '../ui/fields';
import { Avatar, Chip, CrmPage, Empty, ErrorNote, HealthChip, Loading, Note } from '../ui/primitives';

interface Pool extends Paged<Contact> {
  matrix: Record<'residential' | 'commercial', Record<'one_off' | 'recurring', number>>;
  needs_review: number;
  health: { healthy: number; slowing: number; at_risk: number };
}

/** Client pool (frame 04) with client health (frame F6). */
export default function ClientPoolPage() {
  useRobbieWhere({ page: 'client_pool' });
  const { data: meta } = useCrmMeta();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [type, setType] = useState('');
  const [rep, setRep] = useState('');
  const [health, setHealth] = useState(params.get('health') ?? '');
  const [page, setPage] = useState(1);
  React.useEffect(() => setPage(1), [search, segment, type, rep, health]);
  const filters = { search, segment, client_type: type, rep_id: rep, health, page };
  const q = useCrmQuery<Pool>(['crm', 'client-pool', filters], '/client-pool', filters);

  const cell = (seg: 'residential' | 'commercial', t: 'one_off' | 'recurring', label: string) => {
    const active = segment === seg && type === t;
    return (
      <button type="button" onClick={() => { setSegment(active ? '' : seg); setType(active ? '' : t); }} aria-pressed={active}
        className={cn('flex flex-col items-start gap-1 rounded-[10px] border px-4 py-3 text-left transition-colors hover:bg-secondary/60', active && 'border-primary bg-accent')}>
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-[22px] font-semibold leading-7 tabular-nums">{q.data?.matrix[seg][t] ?? '–'}</span>
      </button>
    );
  };

  return (
    <CrmPage title="Client pool" count={q.data?.meta.total ?? null} description="Everyone who has completed a first shoot, by segment and how often they book.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cell('residential', 'recurring', 'Residential · recurring')}
        {cell('residential', 'one_off', 'Residential · one-off')}
        {cell('commercial', 'recurring', 'Commercial · recurring')}
        {cell('commercial', 'one_off', 'Commercial · one-off')}
      </div>

      {q.data && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Client health">
          {([['', 'All'], ['healthy', `Healthy ${q.data.health.healthy}`], ['slowing', `Slowing ${q.data.health.slowing}`], ['at_risk', `At risk ${q.data.health.at_risk}`]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setHealth(key)} aria-pressed={health === key}
              className={cn('h-8 rounded-full border px-3 text-[13px] font-medium', health === key ? 'border-primary bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
          <span className="text-xs text-muted-foreground">Health compares the time since a client’s last shoot with how often they usually book.</span>
        </div>
      )}

      {q.data && q.data.needs_review > 0 && <Note tone="warn">{q.data.needs_review} imported clients need review. <Link className="font-medium underline" to="/crm/contacts?filter=needs_review">Review contacts</Link></Note>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex h-8 w-[240px] items-center rounded-lg border bg-background max-md:h-10 max-md:w-full" data-page-search-container>
          <Search className="ml-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <PageSearch searchId="crm-client-pool" scope="crm-contacts" scopeLabel="Client pool" priority={20} aria-label="Search clients" placeholder="Search clients" value={search} onChange={(e) => setSearch(e.target.value)} className="h-full border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0" />
        </div>
        {meta?.can.view_all && <FilterSelect label="Rep" allLabel="All reps" value={rep} onChange={setRep} options={meta.reps.map((r) => ({ value: String(r.id), label: r.name }))} />}
      </div>

      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.data.length === 0 && <Empty icon={<UserCheck className="h-5 w-5" />} title="No clients match.">Contacts arrive here on their own when their first shoot is completed.</Empty>}
      {q.data && q.data.data.length > 0 && (
        <div className="overflow-x-auto rounded-[10px] border">
          <table className="crm-table">
            <thead><tr><th>Client</th><th>Type</th><th className="r">Shoots</th><th>Last shoot</th><th>Usual gap</th><th>Health</th>{meta?.can.view_all && <th>Rep</th>}<th>First shoot</th></tr></thead>
            <tbody>
              {q.data.data.map((c) => (
                <tr key={c.id} data-href onClick={() => navigate(`/crm/contacts/${c.id}`)}>
                  <td><Link to={`/crm/contacts/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{c.name}</Link>{c.company && <span className="block text-xs text-muted-foreground">{c.company}</span>}</td>
                  <td><Chip tone="line">{c.segment === 'commercial' ? 'Commercial' : 'Residential'}</Chip> {c.client_type ? <Chip>{c.client_type === 'recurring' ? 'Recurring' : 'One-off'}</Chip> : <Chip tone="amber">Type?</Chip>}</td>
                  <td className="r tabular-nums">{c.shoots?.total ?? '—'}</td>
                  <td className="text-muted-foreground">{c.shoots?.last_shoot ? ago(c.shoots.last_shoot) : '—'}</td>
                  <td className="text-muted-foreground">{c.usual_gap_days ? `${c.usual_gap_days} days` : '—'}</td>
                  <td><HealthChip health={c.health} /></td>
                  {meta?.can.view_all && <td>{c.assigned_rep ? <span className="flex items-center gap-1.5"><Avatar person={c.assigned_rep} size="sm" />{c.assigned_rep.name}</span> : <Chip tone="amber">Unassigned</Chip>}</td>}
                  <td className="text-muted-foreground">{day(c.first_shoot_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q.data && q.data.meta.last_page > 1 && <nav className="flex items-center justify-end gap-3" aria-label="Client pool pages">
        <button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {q.data.meta.last_page}</span>
        <button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={page >= q.data.meta.last_page} onClick={() => setPage(page + 1)}>Next</button>
      </nav>}
    </CrmPage>
  );
}
