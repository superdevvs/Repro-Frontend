import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCallSearch } from './workspace/useCallSearch';
import { usePermissions } from '@/context/PermissionsContext';
import { getVoiceDirectory } from '@/services/voice';
import { CallsPagination } from './workspace/CallsPagination';
import { CallsQueryError } from './workspace/CallsQueryError';
import { CallsAvatar, EmptyCalls } from './workspace/bits';
import CallNowButton from './workspace/CallNowButton';
import { directoryRoles, directoryRoleLabel, nameInitials } from './workspace/directoryDisplay';

export default function CallsPeople() {
  const { can } = usePermissions();
  const allowed = can('voice-calls', 'operate');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const query = useCallSearch(search);
  const people = useQuery({ queryKey: ['voice-directory', query, role, page], queryFn: () => getVoiceDirectory({ q: query, role, page, per_page: 20 }), enabled: allowed });
  const rows = people.data?.data ?? [];
  return <div className="calls-fill-page">
    <header className="calls-page-heading"><h2>People</h2><p>Clients, reps, photographers and team contacts.</p></header>
    {!allowed ? <EmptyCalls title="Calling access required" description="An administrator can grant Calls operate permission to search the directory." /> : <>
      <div className="relative shrink-0"><Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--calls-muted)]" /><Input aria-label="Search people" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, company or phone" className="calls-search pl-10" /></div>
      <div className="calls-filter-row" aria-label="Filter contacts by role">{directoryRoles.map(([value, label]) => <button type="button" key={value} className="calls-filter" data-active={role === value} aria-pressed={role === value} onClick={() => { setRole(value); setPage(1); }}>{label}</button>)}</div>
      <div key={`${query}-${role}-${page}`} className="calls-scroll space-y-2" aria-label="People results" tabIndex={0}>
        {people.isLoading && <p className="p-4 text-sm text-[var(--calls-muted)]" role="status">Loading people…</p>}
        {people.isError && <CallsQueryError message="Could not load people." retry={() => void people.refetch()} />}
        {rows.map((person) => <div key={person.id} className="calls-panel flex items-center gap-3 p-3 sm:p-4">
          <CallsAvatar initials={nameInitials(person.name)} size={40} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{person.name}</p><p className="truncate text-xs text-[var(--calls-muted)]">{directoryRoleLabel(person.role)} · {person.phone || 'No phone number'}</p>{person.company_name && <p className="truncate text-xs text-[var(--calls-muted)]">{person.company_name}</p>}</div>
          <CallNowButton to={person.phone} name={person.name} label="Call" disabled={!person.callable} className="shrink-0" />
        </div>)}
        {!people.isLoading && !people.isError && !rows.length && <EmptyCalls title="No people found" description="Try another name or a different role." />}
      </div>
      <CallsPagination page={page} pages={people.data?.last_page} total={people.data?.total} count={rows.length} pending={people.isFetching} error={people.isError} onChange={setPage} label="People" />
    </>}
  </div>;
}
