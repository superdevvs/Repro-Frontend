import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useStudioRevisionRequests } from '@/context/studioRevisionRequestsState';
import { listingStudioTeam } from '@/services/listingStudioTeamService';
import { studioDate, studioLabels } from '@/components/listing-studio/client/studioPresentation';
import { normalizeApiError } from '@/services/apiError';

export function StudioRevisionQueue({ expanded }: { expanded: boolean }) {
  const studio = useStudioRevisionRequests();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const query = useQuery({
    queryKey: ['studio-team', studio.accountId, 'requests', studio.accessKey, page, status],
    queryFn: () => listingStudioTeam.list(page, status),
    enabled: studio.enabled && !(expanded && studio.selectedTaskId), staleTime: 30_000, retry: false,
    refetchInterval: current => [401, 403].includes(normalizeApiError(current.state.error).status ?? 0) ? false : 60_000,
    refetchIntervalInBackground: false,
  });
  const refresh = () => { void query.refetch(); studio.refreshCount(); };
  return <section aria-label="Listing Studio revisions" className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xs font-semibold">Studio revisions</h3>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={query.isFetching} onClick={refresh}><RefreshCw className="mr-1.5 h-3 w-3" />Refresh revisions</Button>
    </div>
    {expanded && <label className="flex items-center gap-2 text-xs">Revision status
      <select className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
        <option value="">All statuses</option><option value="queued">Queued</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
      </select>
    </label>}
    {query.isPending && <p role="status" className="py-3 text-xs text-muted-foreground">Loading Studio revisions…</p>}
    {query.isError && <div role="alert" className="space-y-2 rounded-lg border p-3 text-xs">
      <p>{normalizeApiError(query.error).status === 403 ? 'Studio revisions are not available for this account.' : 'Studio revisions could not be loaded.'}</p>
      <Button variant="outline" size="sm" disabled={query.isFetching} onClick={refresh}>Try again</Button>
    </div>}
    {query.data?.tasks.length === 0 && <p className="py-3 text-xs text-muted-foreground">No Studio revisions in this view.</p>}
    {query.data?.tasks.slice(0, expanded ? undefined : 5).map(task => <button key={task.id} type="button" onClick={() => studio.openTask(task.id)} className="w-full space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary" className="text-[10px]">Listing Studio</Badge><span className="text-[10px] capitalize text-muted-foreground">{task.status.replaceAll('_', ' ')}</span></div>
      <span className="block text-xs font-medium">{studioLabels[task.service]} · {task.client.name}</span>
      <span className="block text-xs text-muted-foreground">{task.assignee?.name ?? 'Unassigned'} · {studioDate(task.createdAt)}</span>
    </button>)}
    {expanded && query.data && (page > 1 || query.data.pagination.hasMore) && <nav aria-label="Studio revision pages" className="flex items-center justify-between gap-2 pt-2">
      <Button size="sm" variant="outline" disabled={page === 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="text-xs">Page {page}</span><Button size="sm" variant="outline" disabled={!query.data.pagination.hasMore || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button>
    </nav>}
  </section>;
}
