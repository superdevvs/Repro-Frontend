import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/context/PermissionsContext';
import { useToast } from '@/hooks/use-toast';
import { cancelScheduledVoiceCall, getScheduledVoiceCalls, retryScheduledVoiceCall } from '@/services/voice';
import ScheduleVoiceCallDialog from './ScheduleVoiceCallDialog';
import { CallsPagination } from './workspace/CallsPagination';
import { CallsQueryError } from './workspace/CallsQueryError';
import { EmptyCalls } from './workspace/bits';
import { formatWhen } from './workspace/callDisplay';

const filters = [['due', 'Due now'], ['scheduled', 'Scheduled'], ['failed', 'Failed'], ['completed', 'Completed'], ['all', 'All']] as const;
export default function CallsFollowUps() {
  const [filter, setFilter] = useState('due');
  const [page, setPage] = useState(1);
  const { can } = usePermissions();
  const canOperate = can('voice-calls', 'operate');
  const cache = useQueryClient();
  const { toast } = useToast();
  const list = useQuery({ queryKey: ['scheduled-voice-calls', filter, page], queryFn: () => getScheduledVoiceCalls({ page, per_page: 20, due: filter === 'due' || undefined, status: !['due', 'all'].includes(filter) ? filter : undefined }) });
  const action = useMutation({ mutationFn: ({ id, mode }: { id: number; mode: 'retry' | 'cancel' }) => mode === 'retry' ? retryScheduledVoiceCall(id) : cancelScheduledVoiceCall(id), onSuccess: (_, variables) => { void cache.invalidateQueries({ queryKey: ['scheduled-voice-calls'] }); toast({ title: variables.mode === 'retry' ? 'Callback retry queued' : 'Callback cancelled' }); }, onError: (error) => toast({ title: 'Could not update callback', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }) });
  const rows = list.data?.data ?? [];
  return <div className="calls-fill-page">
    <header className="calls-page-heading flex items-start justify-between gap-3"><div><h2>Follow-ups</h2><p>Callbacks with a clear next step.</p></div><ScheduleVoiceCallDialog trigger={<Button aria-label="Schedule callback" className="calls-primary h-11 shrink-0 rounded-xl" disabled={!canOperate}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Schedule callback</span><span className="sm:hidden">Add</span></Button>} /></header>
    <div className="calls-filter-row" aria-label="Follow-up filters">{filters.map(([value, label]) => <button type="button" key={value} className="calls-filter" data-active={filter === value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }}>{label}</button>)}</div>
    <div key={`${filter}-${page}`} className="calls-scroll space-y-3" aria-label="Follow-up results" tabIndex={0}>
      {list.isLoading && <p role="status" className="p-4 text-sm text-[var(--calls-muted)]">Loading follow-ups…</p>}
      {list.isError && <CallsQueryError message="Could not load follow-ups." retry={() => void list.refetch()} />}
      {rows.map((item) => {
        const name = item.caller_user?.name || item.callerUser?.name || item.caller_contact?.name || item.callerContact?.name || item.target_phone;
        const editable = ['scheduled', 'deferred', 'failed'].includes(item.status);
        return <section className="calls-panel p-4 sm:p-5" key={item.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{name}</h3><p className="mt-1 text-sm text-[var(--calls-muted)]">{item.summary || item.reason || 'Scheduled callback'}</p></div><span className={`calls-chip ${item.status === 'failed' ? 'calls-chip-warning' : 'calls-chip-neutral'}`}>{item.status.replaceAll('_', ' ')}</span></div><p className="mt-3 text-xs text-[var(--calls-muted)]">{formatWhen(item.next_attempt_at || item.scheduled_at)} · Attempt {item.attempts} of {item.max_attempts}</p>{item.last_error && <p className="mt-2 text-sm text-[var(--calls-danger)]">{item.last_error}</p>}<div className="mt-4 flex flex-wrap gap-2">
          {editable && <ScheduleVoiceCallDialog scheduledCallId={item.id} initialTargetPhone={item.target_phone} initialFromPhone={item.from_phone || ''} initialScheduledAt={item.next_attempt_at || item.scheduled_at || undefined} initialReason={item.reason || item.summary || ''} trigger={<Button className="calls-secondary h-11" disabled={!canOperate}>Reschedule</Button>} />}
          {item.status === 'failed' && <Button className="calls-secondary h-11" disabled={!canOperate || action.isPending || item.attempts >= item.max_attempts} onClick={() => action.mutate({ id: item.id, mode: 'retry' })}>Retry callback</Button>}
          {item.original_voice_call_id && <Button asChild variant="ghost" className="h-11"><Link to={`/calls/inbox/${item.original_voice_call_id}`}>View conversation</Link></Button>}
          {editable && <Button variant="ghost" className="h-11 text-[var(--calls-muted)]" disabled={!canOperate || action.isPending} onClick={() => action.mutate({ id: item.id, mode: 'cancel' })}>Cancel callback</Button>}
        </div></section>;
      })}
      {!list.isLoading && !list.isError && !rows.length && <EmptyCalls title={filter === 'due' ? 'You’re caught up' : 'No callbacks here'} description={filter === 'due' ? 'No callbacks are due right now. Scheduled follow-ups have their own list.' : 'Choose another filter or schedule a callback.'} />}
    </div>
    <CallsPagination label="Follow-ups" page={page} pages={list.data?.last_page} total={list.data?.total} count={rows.length} pending={list.isFetching} error={list.isError} onChange={setPage} />
  </div>;
}
