import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useRequestManager } from '@/context/RequestManagerContext';
import type { AryeoRequestsState } from '@/features/dashboard/hooks/useAryeoRequests';

const labels: Record<string, string> = {
  matched: 'Matched', unmatched: 'Needs matching', queued: 'Queued', running: 'Processing',
  reconciling: 'Checking delivery', failed: 'Needs attention', followup_pending: 'Follow-up pending', delivered: 'Delivered',
};

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export function AryeoRequestsPanel({ requests, canManage = false }: { requests: AryeoRequestsState; canManage?: boolean }) {
  const navigate = useNavigate();
  const { closeModal } = useRequestManager();
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2" data-testid="dashboard-aryeo-requests-panel">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">New requests refresh automatically.</p>
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" onClick={() => requests.setHistory(!requests.history)}>{requests.history ? 'Pending requests' : 'Delivered history'}</Button>
        <Button variant="outline" size="sm" onClick={requests.refresh}>Refresh</Button>
      </div>
    </div>
    {requests.connections.map(connection => <p key={connection.id} className="break-words text-xs text-muted-foreground">
      {connection.name}: {connection.online ? 'Connected' : 'Offline'}
      {!connection.processingEnabled ? ' · Delivery paused' : !connection.executorReady ? ' · Delivery worker unavailable' : ' · Delivery available'}
    </p>)}
    {requests.loading ? <p role="status" className="p-3 text-sm text-muted-foreground">Loading Aryeo requests...</p>
      : requests.error ? <div role="alert" className="p-3 text-sm">{requests.error}</div>
        : <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {!requests.requests.length && <EmptyState icon="clear" title={requests.history ? 'No delivered Aryeo requests.' : 'No pending Aryeo requests.'} size="compact" />}
          {requests.requests.map(request => <article key={request.id} className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3" data-testid={`aryeo-request-${request.id}`}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 break-words text-sm font-semibold">{request.address || 'Address unavailable'}</h3>
              <Badge variant={request.status === 'delivered' ? 'secondary' : 'outline'} className="shrink-0 text-[10px]">{labels[request.status] || 'Needs review'}</Badge>
            </div>
            <p className="break-words text-xs text-muted-foreground">{request.requesterName || request.requesterEmail || 'Requester details pending'}</p>
            {dateLabel(request.receivedAt) && <p className="text-[11px] text-muted-foreground">Received {dateLabel(request.receivedAt)}</p>}
            {request.providerCheckedAt && dateLabel(request.providerCheckedAt) && <p className="text-[11px] text-muted-foreground">Aryeo last verified {dateLabel(request.providerCheckedAt)}</p>}
            {request.shoot ? <>
              <p className="break-words text-xs text-muted-foreground">Shoot #{request.shoot.id} · {request.shoot.clientName} · {request.shoot.workflowStatus}{request.shoot.scheduledDate ? ` · ${request.shoot.scheduledDate}` : ''}</p>
              <Button variant="outline" size="sm" className="min-h-10" onClick={() => {
                closeModal();
                navigate('/dashboard', { state: { openShootId: request.shoot!.id, openShootTab: canManage ? 'tours' : 'overview' } });
              }}>{canManage ? 'Open Tours' : 'Open shoot'}</Button>
            </> : <p className="text-xs text-muted-foreground">{canManage ? 'Confirm the requester and matching shoot in Tours before delivery.' : 'Awaiting a verified shoot match.'}</p>}
          </article>)}
        </div>}
    {requests.lastPage > 1 && <div className="flex shrink-0 items-center justify-between gap-2 text-xs">
      <Button variant="ghost" size="sm" disabled={requests.page <= 1} onClick={() => requests.setPage(requests.page - 1)}>Previous</Button>
      <span>Page {requests.page} of {requests.lastPage}</span>
      <Button variant="ghost" size="sm" disabled={requests.page >= requests.lastPage} onClick={() => requests.setPage(requests.page + 1)}>Next</Button>
    </div>}
  </div>;
}
