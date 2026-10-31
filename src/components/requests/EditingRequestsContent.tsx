import { lazy, Suspense } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { EditingTasks } from '@/components/shoots/EditingTasks';
import { useRequestManager } from '@/context/RequestManagerContext';
import { useStudioRevisionRequests, type EditingSource } from '@/context/studioRevisionRequestsState';
import type { EditingRequest } from '@/services/editingRequestService';
import { StudioRevisionQueue } from './StudioRevisionQueue';
import { cn } from '@/lib/utils';

const StudioRevisionPanel = lazy(() => import('@/components/listing-studio/team/StudioRevisionPanel').then(module => ({ default: module.StudioRevisionPanel })));
const sources: { id: EditingSource; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'shoots', label: 'Shoot edits' }, { id: 'studio', label: 'Studio revisions' }];
const statusLabels = { open: 'Open', in_progress: 'In Progress', completed: 'Completed' };
const priorityStyles = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  normal: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800',
  high: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
};
const statusStyles = {
  open: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  in_progress: 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800',
  completed: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
};

export interface EditingRequestsContentProps {
  managerMode?: boolean;
  editingRequests?: EditingRequest[];
  editingRequestsLoading?: boolean;
  onCreateEditingRequest?: () => void;
  onEditingRequestClick?: (id: number) => void;
  editingActionLabel?: string;
  showShootRequests?: boolean;
}
export function EditingRequestsContent({ managerMode = false, editingRequests = [], editingRequestsLoading = false, onCreateEditingRequest, onEditingRequestClick, editingActionLabel = 'New request', showShootRequests = true }: EditingRequestsContentProps) {
  const studio = useStudioRevisionRequests();
  const { closeModal } = useRequestManager();
  const requests = (managerMode ? editingRequests : editingRequests.filter(request => request.status !== 'completed')).slice(0, managerMode ? undefined : 7);
  const source = studio.enabled ? studio.source : 'shoots';
  const showShoots = showShootRequests && source !== 'studio';
  const showingDetail = managerMode && studio.enabled && Boolean(studio.selectedTaskId);
  const run = (action?: () => void) => { if (managerMode) closeModal(); action?.(); };
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    {showingDetail && studio.selectedTaskId && <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Button variant="ghost" size="sm" className="shrink-0 self-start" onClick={studio.clearTask}><ChevronLeft className="mr-1 h-4 w-4" />Back to editing requests</Button>
      <div className="min-h-0 flex-1 overflow-y-auto"><Suspense fallback={<p role="status" className="p-4 text-sm">Loading revision…</p>}><StudioRevisionPanel key={`${studio.accessKey}:${studio.selectedTaskId}`} accountId={studio.accountId} taskId={studio.selectedTaskId} /></Suspense></div>
    </div>}
    <div className={showingDetail ? 'hidden' : 'flex min-h-0 flex-1 flex-col gap-3'}>
    {studio.enabled && <div role="group" aria-label="Editing request source" className="flex shrink-0 flex-wrap gap-1">
      {sources.filter(item => showShootRequests || item.id !== 'shoots').map(item => <Button key={item.id} size="sm" variant={source === item.id ? 'secondary' : 'ghost'} aria-pressed={source === item.id} onClick={() => studio.setSource(item.id)} className="h-8 px-2 text-xs">{item.label}</Button>)}
    </div>}
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
      {showShoots && <section aria-label="Shoot editing requests" className="space-y-2">
        <EditingTasks />
        {editingRequestsLoading ? <p className="py-3 text-xs text-muted-foreground">Loading...</p> : requests.length === 0 ? <EmptyState icon="clear" title={<>No active requests.</>} size="compact" /> : requests.map(request => <button key={request.id} onClick={() => run(() => onEditingRequestClick?.(request.id))} className="w-full rounded-lg border border-border/60 bg-muted/20 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30">
          <div className="flex items-center justify-between gap-2"><span className="min-w-0 flex-1 break-words text-xs font-medium">{request.summary || 'Untitled request'}</span><div className="flex shrink-0 items-center gap-1"><Badge className={cn('border px-1.5 py-0 text-[9px] font-semibold whitespace-nowrap', priorityStyles[request.priority] || priorityStyles.normal)}>{request.priority || 'normal'}</Badge><Badge className={cn('border px-1.5 py-0 text-[9px] font-semibold whitespace-nowrap', statusStyles[request.status] || statusStyles.open)}>{statusLabels[request.status] || 'Open'}</Badge></div></div>
        </button>)}
        {onCreateEditingRequest && <Button size="sm" className="w-full" onClick={() => run(onCreateEditingRequest)}>{editingActionLabel}</Button>}
      </section>}
      {studio.enabled && source !== 'shoots' && <StudioRevisionQueue key={studio.accessKey} expanded={managerMode} />}
      {studio.enabled && studio.countError && <p role="status" className="text-xs text-muted-foreground">The Studio revision count is unavailable.</p>}
    </div>
    </div>
  </div>;
}
