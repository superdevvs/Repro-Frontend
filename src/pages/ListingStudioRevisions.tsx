import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Loader2, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { StudioRevisionPanel } from '@/components/listing-studio/team/StudioRevisionPanel';
import { studioDate, studioLabels } from '@/components/listing-studio/client/studioPresentation';
import { listingStudioTeam } from '@/services/listingStudioTeamService';
import { canUseListingStudioRevisions } from '@/utils/listingStudio';

export default function ListingStudioRevisions() {
  const { user, role, isImpersonating } = useAuth();
  if (!user || !canUseListingStudioRevisions(role, user.secondary_roles) || isImpersonating) return <div className="space-y-3 p-6"><h1 className="text-2xl font-semibold">Studio revisions</h1><p className="text-sm text-muted-foreground">Use your own authorized team account to manage revisions.</p></div>;
  return <RevisionWorkspace key={user.id} accountId={String(user.id)} />;
}
function RevisionWorkspace({ accountId }: { accountId: string }) {
  const [page, setPage] = useState(1); const [status, setStatus] = useState(''); const [params, setParams] = useSearchParams();
  const candidateId = params.get('task'); const selectedId = candidateId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateId) ? candidateId : null;
  const query = useQuery({ queryKey: ['studio-team', accountId, 'tasks', page, status], queryFn: () => listingStudioTeam.list(page, status), refetchInterval: 15000 });
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 pb-24 sm:p-6 lg:p-8">
    <PageHeader title="Studio revisions" description="Assigned photo revisions, source files and private delivery." compactTitleOnMobile action={<Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>} />
    <div className="max-w-xs space-y-2"><Label htmlFor="studio-task-status">Status</Label><select id="studio-task-status" value={status} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All revisions</option><option value="queued">Queued</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></div>
    <div className={selectedId ? 'grid items-start gap-5 xl:grid-cols-[minmax(260px,0.65fr)_1.35fr]' : ''}><div className="space-y-4">
      {query.isPending && <p role="status" className="flex items-center gap-2 p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading revisions…</p>}
      {query.isError && <div role="alert" className="space-y-3 rounded-2xl border p-5"><p className="text-sm">Your revision queue could not be loaded.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>}
      {query.data?.tasks.length === 0 && <div className="space-y-3 rounded-2xl border border-dashed p-8 text-center"><Users className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="font-medium">No revisions in this view</h2><p className="text-sm text-muted-foreground">Only revisions within your team access appear here.</p></div>}
      <div className={selectedId ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}>{query.data?.tasks.map(task => <button key={task.id} type="button" className={`space-y-2 rounded-2xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${task.id === selectedId ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/50'}`} onClick={() => setParams({ task: task.id })}><span className="block text-sm font-medium">{studioLabels[task.service]} · {task.client.name}</span><span className="block text-xs capitalize text-muted-foreground">{task.status.replaceAll('_', ' ')} · {studioDate(task.createdAt)}</span><span className="block text-xs">{task.assignee?.name ?? 'Unassigned'}</span></button>)}</div>
      {query.data && (page > 1 || query.data.pagination.hasMore) && <nav aria-label="Revision pages" className="flex items-center justify-between gap-3"><Button variant="outline" size="sm" disabled={page === 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="text-xs text-muted-foreground">Page {page}</span><Button variant="outline" size="sm" disabled={!query.data.pagination.hasMore || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></nav>}
    </div>{selectedId && <StudioRevisionPanel key={selectedId} accountId={accountId} taskId={selectedId} />}</div>
  </div>;
}
