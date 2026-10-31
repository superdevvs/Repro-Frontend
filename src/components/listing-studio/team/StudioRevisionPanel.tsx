import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listingStudioTeam } from '@/services/listingStudioTeamService';
import { normalizeApiError } from '@/services/apiError';
import { beginStudioDelivery, forgetStudioDelivery, readStudioDelivery, StudioDeliveryRecoveryError } from '@/lib/listingStudioDelivery';
import { studioActionKey } from '@/lib/listingStudioPurchase';
import type { StudioRevisionReason, StudioRevisionTask } from '@/types/listingStudioTeam';
import { studioDate, studioLabels } from '../client/studioPresentation';
import { StudioRevisionMedia } from './StudioRevisionMedia';

const reasons: { value: StudioRevisionReason; label: string }[] = [
  { value: 'quality_review', label: 'Quality review' }, { value: 'source_issue', label: 'Source photo issue' },
  { value: 'instructions_unclear', label: 'Instructions need clarification' }, { value: 'unable_to_complete', label: 'Unable to complete' },
  { value: 'client_cancelled', label: 'Client requested cancellation' },
];
const selectClass = 'h-11 w-full rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function StudioRevisionPanel({ accountId, taskId }: { accountId: string; taskId: string }) {
  const queryClient = useQueryClient(); const queryKey = ['studio-team', accountId, 'task', taskId];
  const query = useQuery({ queryKey, queryFn: () => listingStudioTeam.detail(taskId), refetchInterval: current => current.state.data && !['delivered', 'cancelled'].includes(current.state.data.status) ? 10000 : false });
  const task = query.data;
  const candidates = useQuery({ queryKey: ['studio-team', accountId, 'assignees', taskId], queryFn: () => listingStudioTeam.assignees(taskId), enabled: Boolean(task?.actions.canAssign) });
  const [assigneeId, setAssigneeId] = useState(''); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const inFlight = useRef(false);
  const [pending, setPending] = useState(() => readStudioDelivery(accountId, taskId));
  const [transition, setTransition] = useState<'hold' | 'fail' | 'cancel' | null>(null);
  const [reason, setReason] = useState<StudioRevisionReason>('quality_review'); const [note, setNote] = useState('');
  useEffect(() => setAssigneeId(task?.assignee?.id ?? ''), [task?.assignee?.id]);
  useEffect(() => {
    if (task?.deliveryAttempt || task?.status === 'delivered') {
      forgetStudioDelivery(accountId, taskId); setPending(null);
    }
  }, [accountId, taskId, task?.deliveryAttempt, task?.status]);
  const update = (value: StudioRevisionTask) => { queryClient.setQueryData(queryKey, value); void queryClient.invalidateQueries({ queryKey: ['studio-team', accountId] }); };
  const run = async (operation: () => Promise<StudioRevisionTask | void>) => {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError('');
    try { const result = await operation(); if (result) update(result); }
    catch (failure) { setError(failure instanceof StudioDeliveryRecoveryError ? failure.message : normalizeApiError(failure).message); void query.refetch(); }
    finally { inFlight.current = false; setBusy(false); }
  };
  if (query.isPending) return <p role="status" className="flex items-center gap-2 rounded-2xl border p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading revision…</p>;
  if (!task) return <div role="alert" className="space-y-3 rounded-2xl border p-6"><p className="text-sm">This revision could not be loaded.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>;
  const actionKey = (action: string) => studioActionKey(accountId, `team:${task.id}:${task.version}:${action}`);
  const deliver = () => run(async () => {
    if (!file) { setError('Choose the finished photo first.'); return; }
    if (!task.deliveryConstraints.mimeTypes.includes(file.type) || file.size > task.deliveryConstraints.maxFileBytes || !file.size) { setError('Choose a JPEG, PNG or WebP photo within the delivery size limit.'); return; }
    const request = await beginStudioDelivery(accountId, task.id, task.version, file); setPending(request);
    try {
      const result = await listingStudioTeam.deliver(task.id, file, request.expectedVersion, request.key);
      if (result.task.deliveryAttempt || result.task.status === 'delivered') { forgetStudioDelivery(accountId, task.id); setPending(null); setFile(null); }
      return result.task;
    } catch (failure) {
      const code = normalizeApiError(failure).code;
      if (code === 'validation_failed') { forgetStudioDelivery(accountId, task.id); setPending(null); }
      // The server checks this exact key/body replay before its version guard.
      // A version conflict therefore rejects this attempt without accepting it.
      if (code === 'version_conflict') {
        const latest = await query.refetch();
        if (latest.isSuccess) { forgetStudioDelivery(accountId, task.id); setPending(null); setFile(null); }
      }
      throw failure;
    }
  });
  const openTransition = (action: 'hold' | 'fail' | 'cancel') => { setTransition(action); setNote(''); setReason(action === 'cancel' ? 'client_cancelled' : action === 'fail' ? 'unable_to_complete' : 'quality_review'); setError(''); };
  return <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{studioLabels[task.service]} revision</h2><p className="mt-1 text-sm text-muted-foreground">{task.client.name} · {studioDate(task.createdAt)}</p><p className="mt-2 text-xs font-medium capitalize">{task.status.replaceAll('_', ' ')}</p></div><Button variant="ghost" size="sm" disabled={busy || query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></header>
    <div className="rounded-xl bg-muted/60 p-4"><h3 className="text-sm font-medium">Requested changes</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{task.instructions}</p></div>
    <div className="grid gap-3 sm:grid-cols-2">{task.source.originalPreviewAvailable && <StudioRevisionMedia key={`${task.id}:original:${task.updatedAt}`} accountId={accountId} taskId={task.id} variant="original" />}{task.source.resultPreviewAvailable && <StudioRevisionMedia key={`${task.id}:result:${task.updatedAt}`} accountId={accountId} taskId={task.id} variant="result" />}{task.deliveryPreviewAvailable && <StudioRevisionMedia key={`${task.id}:delivery:${task.updatedAt}`} accountId={accountId} taskId={task.id} variant="delivery" />}</div>
    {task.actions.canViewSource && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => listingStudioTeam.downloadSource(task.id, 'original'))}><Download className="mr-2 h-4 w-4" />Original photo</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => listingStudioTeam.downloadSource(task.id, 'result'))}><Download className="mr-2 h-4 w-4" />Prior edited result</Button></div>}
    {task.actions.canAssign ? <div className="space-y-2 border-t pt-4"><Label htmlFor="revision-assignee">Assigned editor</Label><div className="flex flex-col gap-2 sm:flex-row"><select id="revision-assignee" className={selectClass} disabled={busy || candidates.isPending || candidates.isError} value={assigneeId} onChange={event => setAssigneeId(event.target.value)}><option value="">Unassigned</option>{candidates.data?.assignees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select><Button variant="outline" disabled={busy || !candidates.data} onClick={() => void run(() => listingStudioTeam.assign(task.id, assigneeId || null, task.version, actionKey(`assign:${assigneeId || 'none'}`)))}>Assign</Button></div>{candidates.isError && <p role="alert" className="text-xs text-destructive">Eligible editors could not be loaded.</p>}</div> : <p className="border-t pt-4 text-sm text-muted-foreground">Assigned to {task.assignee?.name ?? 'the team queue'}</p>}
    {task.actions.canStart && <Button disabled={busy} onClick={() => void run(() => listingStudioTeam.start(task.id, task.version, actionKey('start')))}>Start revision</Button>}
    {task.recovery.message && <p role="status" className="rounded-xl bg-muted p-3 text-sm leading-6">{task.recovery.message}</p>}
    {task.deliveryAttempt && !['completed', 'needs_attention'].includes(task.deliveryAttempt.status) && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Saving the delivered photo. This task will update when it is ready.</p>}
    {task.deliveryAttempt?.message && <p className="text-sm text-muted-foreground">{task.deliveryAttempt.message}</p>}
    {task.actions.canResumeDelivery && task.deliveryAttempt && <Button variant="outline" disabled={busy} onClick={() => void run(() => listingStudioTeam.resume(task.id, task.deliveryAttempt!.id, task.version, actionKey(`resume:${task.deliveryAttempt!.id}`)))}>Recover saved delivery</Button>}
    {pending && <div className="space-y-2 rounded-xl border p-4 text-sm"><p>The last upload has not been confirmed. Refresh this task to check for a saved delivery. If no delivery was saved, retry the same file.</p><Button variant="outline" size="sm" disabled={busy || query.isFetching} onClick={() => void query.refetch()}>Check delivery status</Button></div>}
    {task.actions.canDeliver && <div className="space-y-3 border-t pt-4"><Label htmlFor="revision-delivery">Finished photo</Label><Input id="revision-delivery" type="file" accept={task.deliveryConstraints.mimeTypes.join(',')} disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setError(''); }} /><p className="text-xs text-muted-foreground">One JPEG, PNG or WebP · Up to {Math.floor(task.deliveryConstraints.maxFileBytes / 1024 / 1024)} MiB. Delivery completes after the private photo and preview are saved.</p><Button disabled={busy || !file} onClick={() => void deliver()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Upload className="mr-2 h-4 w-4" />}{busy ? 'Saving delivery…' : pending ? 'Retry pending upload' : 'Deliver finished photo'}</Button></div>}
    <div className="flex flex-wrap gap-2 border-t pt-4">{task.actions.canHold && <Button variant="outline" size="sm" disabled={busy} onClick={() => openTransition('hold')}>Put on hold</Button>}{task.actions.canFail && <Button variant="outline" size="sm" disabled={busy} onClick={() => openTransition('fail')}>Unable to complete</Button>}{task.actions.canCancel && <Button variant="ghost" size="sm" disabled={busy} onClick={() => openTransition('cancel')}>Cancel revision</Button>}</div>
    {error && !transition && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={Boolean(transition)} onOpenChange={open => { if (!open && !busy) setTransition(null); }}><DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>{transition === 'hold' ? 'Put this revision on hold' : transition === 'cancel' ? 'Cancel this revision' : 'Mark this revision unable to complete'}</DialogTitle><DialogDescription>{transition === 'hold' ? 'Keep the funded request reserved while the team resolves the issue.' : 'Confirm that work cannot proceed. The server will apply the order’s credit or refund policy.'}</DialogDescription></DialogHeader><div className="space-y-3"><Label htmlFor="revision-reason">Reason</Label><select id="revision-reason" value={reason} className={selectClass} disabled={busy} onChange={event => setReason(event.target.value as StudioRevisionReason)}>{reasons.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Label htmlFor="revision-note">Note (optional)</Label><Textarea id="revision-note" value={note} maxLength={1000} rows={3} disabled={busy} onChange={event => setNote(event.target.value)} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setTransition(null)}>Back</Button><Button disabled={busy} onClick={() => void run(async () => { const result = await listingStudioTeam.transition(task.id, transition!, task.version, reason, note, actionKey(`${transition}:${reason}`)); setTransition(null); return result; })}>{busy ? 'Saving…' : 'Confirm'}</Button></div></div></DialogContent></Dialog>
  </section>;
}
