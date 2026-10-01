import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PhoneIncoming, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { claimIncomingVoiceOffer, getIncomingVoiceOffers, getScheduleState, getVoiceCalls } from '@/services/voice';
import { CallsAvatar, EmptyCalls } from './workspace/bits';
import { callerInitials, callerName, formatDuration, relatedShoot } from './workspace/callDisplay';
import { CallsPagination } from './workspace/CallsPagination';
import { CallsQueryError } from './workspace/CallsQueryError';
import { usePermissions } from '@/context/PermissionsContext';
import CallBrowserPanel from '@/components/voice/CallBrowserPanel';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';

export default function CallsLive() {
  const { can } = usePermissions();
  const canOperate = can('voice-calls', 'operate');
  const phone = useBrowserPhone();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const phoneClaimKeys = useRef<Record<string, string>>({});
  const live = useQuery({ queryKey: ['voice-calls', 'live', page], queryFn: () => getVoiceCalls({ per_page: 20, page, filter: 'live' }), refetchInterval: 8000 });
  const offers = useQuery({ queryKey: ['voice-incoming-offers'], queryFn: getIncomingVoiceOffers, refetchInterval: 3000, enabled: canOperate });
  const schedule = useQuery({ queryKey: ['voice-schedule-state'], queryFn: () => getScheduleState() });
  const answer = useMutation({
    mutationFn: async ({ id, device }: { id: string; device: 'browser' | 'phone' }) => {
      if (device === 'browser') { await phone.answerIncoming(id); return null; }
      phoneClaimKeys.current[id] ||= crypto.randomUUID();
      return claimIncomingVoiceOffer(id, { device, idempotency_key: phoneClaimKeys.current[id] });
    },
    onSuccess: (result, variables) => {
      void cache.invalidateQueries({ queryKey: ['voice-incoming-offers'] });
      void cache.invalidateQueries({ queryKey: ['voice-calls'] });
      const offer = offers.data?.find((item) => item.id === variables.id);
      if (variables.device === 'phone') toast({ title: 'Your phone is ringing', description: 'Press 1 when you answer to accept the caller.' });
      else if (offer) navigate(`/calls/live/${offer.voice_call_id}`);
      if (result?.phone_pending) void cache.invalidateQueries({ queryKey: ['voice-phone-settings'] });
    },
    onError: (error) => { void offers.refetch(); toast({ title: 'Could not answer', description: error instanceof Error ? error.message : 'The call may have been answered by a teammate. Refresh the queue.', variant: 'destructive' }); },
  });
  const rows = live.data?.data ?? [];
  const incoming = offers.data?.filter((offer) => offer.status === 'waiting') ?? [];
  const queueEmpty = canOperate && offers.isSuccess && live.isSuccess
    && !incoming.length && !rows.length && (live.data.total ?? 0) === 0;
  const linkedOffer = params.get('offer');
  return <div className="calls-fill-page">
    <header className="calls-page-heading flex flex-wrap items-center justify-between gap-2"><div><h2>Team queue</h2><p>Answer an incoming call or open a conversation in progress.</p></div><span className="calls-chip calls-chip-neutral">{schedule.data?.state.label || 'Checking coverage…'}</span></header>
    <div className={queueEmpty ? 'calls-scroll flex flex-col gap-4' : 'calls-scroll space-y-4'} aria-label="Team call queue" tabIndex={0}>
      {canOperate && offers.isError && <CallsQueryError message="Could not check incoming calls." retry={() => void offers.refetch()} />}
      {linkedOffer && offers.data && !offers.data.some((offer) => offer.id === linkedOffer && offer.can_claim) && <p role="status" className="rounded-xl bg-[var(--calls-warning-soft)] p-3 text-sm text-[var(--calls-warning)]">That call is no longer waiting for an answer. It may have been answered or ended.</p>}
      {incoming.map((offer) => <section key={offer.id} className="calls-panel border-[var(--calls-success)] bg-[var(--calls-success-soft)] p-4 sm:p-5" aria-label={`Incoming call from ${offer.caller_name || offer.remote_phone}`}>
        <div className="flex items-center gap-3"><PhoneIncoming className="h-6 w-6 text-[var(--calls-success)]" /><div><h3 className="text-lg font-semibold">{offer.caller_name || offer.remote_phone}</h3><p className="text-sm text-[var(--calls-muted)]">{offer.remote_phone} · Incoming call</p></div></div>
        <p className="mt-3 text-sm">The first teammate to answer takes this call.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button className="calls-call h-11" disabled={!offer.can_claim || phone.busy || Boolean(phone.active) || answer.isPending} onClick={() => answer.mutate({ id: offer.id, device: 'browser' })}>{answer.isPending && answer.variables?.id === offer.id ? 'Connecting…' : 'Answer in browser'}</Button>{offer.phone_available && <Button className="calls-secondary h-11" disabled={!offer.can_claim || answer.isPending || Boolean(phone.active)} onClick={() => answer.mutate({ id: offer.id, device: 'phone' })}>Answer on my phone</Button>}<Button asChild variant="ghost" className="h-11"><Link to={`/calls/inbox/${offer.voice_call_id}`}>Caller details</Link></Button></div>
        {answer.isPending && answer.variables?.id === offer.id && answer.variables.device === 'browser' && <Button variant="ghost" className="mt-2 h-11" onClick={() => void phone.cancelPending()}>Cancel connection</Button>}
      </section>)}
      {canOperate && !incoming.length && !offers.isError && <div className="flex shrink-0 items-center gap-2 rounded-xl bg-[var(--calls-subtle)] px-4 py-3 text-sm text-[var(--calls-muted)]"><Radio className="h-4 w-4" />{offers.isLoading ? 'Checking incoming calls…' : 'No callers waiting'}</div>}
      <h3 className="text-sm font-semibold">In progress{live.data ? ` · ${live.data.total ?? rows.length}` : ''}</h3>
      {live.isError && <CallsQueryError message="Could not load live calls." retry={() => void live.refetch()} />}
      {rows.map((call) => <section className="calls-panel p-4" key={call.id}><div className="flex items-start gap-3"><CallsAvatar initials={callerInitials(call)} size={40} /><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{callerName(call)}</h3><p className="mt-1 text-xs text-[var(--calls-muted)]">{phone.active?.offer.voice_call_id === call.id ? 'Your browser call' : call.handled_by === 'ai' ? 'With Robbie' : 'Team conversation'} · {formatDuration(call.duration_seconds)}</p><p className="mt-2 truncate text-sm text-[var(--calls-muted)]">{relatedShoot(call)?.address || call.intent?.replace(/_/g, ' ') || call.live_transcript_preview || call.status.replace(/_/g, ' ')}</p></div><Button asChild className="calls-secondary h-11 shrink-0"><Link to={`/calls/live/${call.id}`}>Open</Link></Button></div><CallBrowserPanel callId={call.id} compact /></section>)}
      {!live.isLoading && !live.isError && !rows.length && <div className={queueEmpty ? 'flex-1' : undefined}><EmptyCalls icon="calls" fill={queueEmpty} compact={!queueEmpty} title="No active conversations" description={queueEmpty ? 'Incoming callers and conversations in progress will appear here.' : 'Calls in progress appear here when Robbie or your team connects.'} /></div>}
      <div className="flex shrink-0 flex-wrap gap-2 text-sm"><Button asChild variant="ghost" className="h-11"><Link to="/calls/settings">Set up browser & phone alerts</Link></Button><Button asChild variant="ghost" className="h-11"><Link to="/calls/schedule">Business hours</Link></Button></div>
    </div>
    <CallsPagination page={page} pages={live.data?.last_page} total={live.data?.total} count={rows.length} pending={live.isFetching} error={live.isError} onChange={setPage} label="Active calls" />
  </div>;
}
