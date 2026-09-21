import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Minimize2,
  PhoneForwarded,
  PhoneOff,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { usePageLoading } from '@/hooks/use-page-loading';
import MemoryDrawer from '@/components/voice/MemoryDrawer';
import { useCallLiveStream } from '@/hooks/useCallLiveStream';
import { addVoiceCallNote, getVoiceCall, getVoiceSettings, hangupVoiceCall, markCockpitOpened, transferVoiceCall, wrapUpVoiceCall } from '@/services/voice';
import { CallsAvatar, EmptyCalls } from './workspace/bits';
import { callerInitials, callerName, formatDuration, relatedShoot } from './workspace/callDisplay';
import { usePermissions } from '@/context/PermissionsContext';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import CallBrowserPanel from '@/components/voice/CallBrowserPanel';

export default function CallLiveCockpit() {
  const params = useParams();
  const callId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const canOperate = can('voice-calls', 'operate');
  const phone = useBrowserPhone();
  const ownBrowserCall = phone.active?.offer.voice_call_id === callId;
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [now, setNow] = useState(Date.now());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [taskKey, setTaskKey] = useState(() => crypto.randomUUID());
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });

  const call = useQuery({
    queryKey: ['voice-call', callId],
    queryFn: () => getVoiceCall(callId),
    enabled: Number.isFinite(callId),
    refetchInterval: 5000,
  });
  const live = useCallLiveStream(Number.isFinite(callId) ? callId : null);
  usePageLoading(call.isLoading);

  useEffect(() => {
    if (canOperate && Number.isFinite(callId)) markCockpitOpened(callId).catch(() => undefined);
  }, [callId, canOperate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hangup = useMutation({
    mutationFn: () => hangupVoiceCall(callId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-call', callId] });
      queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      toast({ title: 'Call ended' });
      navigate(`/calls/inbox/${callId}/wrap-up`);
    },
    onError: (error) => toast({ title: 'Could not end call', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
  });
  const transfer = useMutation({
    mutationFn: (reason: string) => transferVoiceCall(callId, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData(['voice-call', callId], updated);
      queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      toast({ title: updated.status === 'callback_needed' ? 'Transfer could not connect' : 'Transfer requested', description: updated.status === 'callback_needed' ? 'A callback has been queued.' : 'Waiting for the staff line to connect.' });
    },
    onError: (error) => toast({ title: 'Could not transfer call', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
  });
  const saveNote = useMutation({
    mutationFn: (body: string) => addVoiceCallNote(callId, body),
    onSuccess: () => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['voice-call', callId] });
      toast({ title: 'Note saved' });
    },
    onError: (error) => toast({ title: 'Could not save note', description: error instanceof Error ? error.message : 'Your draft is still here.', variant: 'destructive' }),
  });
  const createTask = useMutation({
    mutationFn: () =>
      wrapUpVoiceCall(callId, {
        create_task: true,
        task_title: insights?.next_best_action || 'Follow up from the live call',
        attach_shoot: Boolean(relatedShoot(call.data)?.id),
        idempotency_key: taskKey,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['voice-call', callId], updated);
      setTaskKey(crypto.randomUUID());
      toast({ title: 'Follow-up task saved', description: 'Review and complete it in the call wrap-up.' });
    },
    onError: (error) =>
      toast({ title: 'Could not create the follow-up', description: error instanceof Error ? error.message : undefined, variant: 'destructive' }),
  });

  const insights = live.insights ?? live.finalSummary;
  const transcript = useMemo(
    () => live.transcript.filter((chunk) => !search || chunk.text.toLowerCase().includes(search.toLowerCase())),
    [live.transcript, search],
  );
  const shoot = relatedShoot(call.data);
  const ended = Boolean(call.data?.ended_at || ['completed', 'failed', 'missed', 'cancelled'].includes(call.data?.status || ''));
  const elapsed = !ended && call.data?.answered_at
    ? Math.max(0, Math.floor((now - new Date(call.data.answered_at).getTime()) / 1000))
    : call.data?.duration_seconds || 0;

  if (call.isError) {
    return (
      <div role="alert" className="calls-panel p-6 text-sm text-[var(--calls-danger)]">
        Could not load this live call.
        <Button variant="outline" className="mt-3 calls-secondary" onClick={() => void call.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="calls-panel flex flex-wrap items-center justify-between gap-3 bg-[var(--calls-brand-soft)] p-4">
        <div className="flex items-center gap-3">
          <CallsAvatar initials={callerInitials(call.data)} size={40} />
          <div>
            <p className="text-lg font-semibold">{callerName(call.data)}</p>
            <p className="text-xs text-[var(--calls-muted)]">
              {call.data?.status?.replace(/_/g, ' ') || 'Connecting'} · {ended ? 'Call ended' : live.connected ? 'Transcript connected' : 'Reconnecting transcript'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-semibold tabular-nums">{formatDuration(elapsed)}</span>
          <Button asChild variant="outline" className="calls-secondary h-11 rounded-lg">
            <Link to="/calls/live">
              <Minimize2 className="h-4 w-4" />
              Minimize
            </Link>
          </Button>
        </div>
      </div>

      <CallBrowserPanel callId={callId} ended={ended} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <section className="calls-panel flex min-h-[520px] flex-col p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[22px] font-semibold">In the conversation</h2>
            <div className="flex gap-2">
              <span className="calls-chip calls-chip-success">{ended ? 'Ended' : live.connected ? 'Live transcript' : 'Connecting'}</span>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-[var(--calls-muted)]" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 w-40 pl-7 text-xs" placeholder="Search" />
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--calls-muted)]">
            <span>{call.data?.recording_consent_given ? (call.data.metadata?.recording_started_at ? 'Recording started · Consent received' : 'Consent received · Recording is not active') : 'Recording consent not received'}</span>
          </div>
          <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
            {transcript.length === 0 && <EmptyCalls title={search ? 'No matching transcript' : ended ? 'No transcript available' : 'Waiting for transcript…'} />}
            {transcript.map((chunk) => (
              <div key={chunk.seq}>
                <p className="text-xs uppercase tracking-wide text-[var(--calls-muted)]">
                  {chunk.speaker} · {new Date(chunk.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                </p>
                <p className="mt-1 text-sm leading-6">{chunk.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="calls-secondary h-11 rounded-lg"
                disabled={!canOperate || !note.trim() || saveNote.isPending}
                onClick={() => saveNote.mutate(note.trim())}
              >
                Add note
              </Button>
              <Button
                type="button"
                variant="outline"
                className="calls-secondary h-11 rounded-lg"
                disabled={!canOperate || saveNote.isPending}
                onClick={() => saveNote.mutate(`Moment at ${formatDuration(elapsed)}: ${call.data?.live_transcript_preview || 'bookmarked from live call'}`)}
              >
                Bookmark moment
              </Button>
            </div>
            <span className="text-xs text-[var(--calls-muted)]">Visible to your team</span>
          </div>
          <Textarea disabled={!canOperate} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Private note for this call…" className="mt-2 min-h-16" />
          {!permissionsLoading && !canOperate && <p className="mt-2 text-xs text-[var(--calls-muted)]">You have read-only Calls access.</p>}
        </section>

        <aside className="space-y-4">
          <section className="calls-panel bg-[var(--calls-ai-soft)] p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--calls-ai)]">
              <Sparkles className="h-4 w-4" />
              Robbie’s call insights
            </p>
            <h3 className="mt-3 text-xl font-semibold">{insights?.intent?.replace(/_/g, ' ') || 'Waiting for a clear next step'}</h3>
            <p className="mt-2 text-sm leading-6">{insights?.next_best_action || insights?.summary_text || 'Suggestions appear when Robbie has enough of the conversation.'}</p>
            <p className="mt-3 text-xs text-[var(--calls-muted)]">Suggestion only · Nothing has been sent</p>
            <Button
              type="button"
              className="calls-ai mt-4 h-11 w-full rounded-lg"
              disabled={!canOperate || createTask.isPending || !call.data || !insights?.next_best_action}
              onClick={() => createTask.mutate()}
            >
              Create follow-up task
            </Button>
          </section>
          <section className="calls-panel p-5">
            <h3 className="text-lg font-semibold">At a glance</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Property" value={shoot?.address || 'Not linked'} />
              <Row label="Next shoot" value={shoot?.scheduled_at ? new Date(shoot.scheduled_at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '—'} />
              <Row label="Photographer" value={shoot?.photographer?.name || '—'} />
              <Row label="Status" value={call.data?.status?.replace(/_/g, ' ') || '—'} />
            </dl>
            <Button type="button" variant="outline" className="calls-secondary mt-4 h-11 w-full rounded-lg" onClick={() => setHistoryOpen((value) => !value)}>
              {historyOpen ? 'Hide customer history' : 'View full customer history'}
            </Button>
            {historyOpen && <div className="mt-3"><MemoryDrawer callId={callId} streamMemory={live.memory} call={call.data ?? null} /></div>}
          </section>
        </aside>
      </div>

      {!ownBrowserCall && <div className="calls-panel flex flex-wrap items-center justify-between gap-2 p-3 md:gap-3">
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" className="calls-secondary h-11 rounded-lg" disabled={!canOperate || transfer.isPending || ended || !call.data?.call_control_id || settings.isError || !settings.data?.support_handoff_number}>
                <PhoneForwarded className="h-4 w-4" />Transfer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="calls-workspace">
              <AlertDialogHeader><AlertDialogTitle>Transfer to the team?</AlertDialogTitle><AlertDialogDescription>Connect this caller to {settings.data?.support_handoff_number}. If the transfer fails, the configured callback route will be used.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Keep call</AlertDialogCancel><AlertDialogAction disabled={!canOperate || transfer.isPending} onClick={() => canOperate && transfer.mutate('operator_live_transfer')}>Transfer call</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <Button type="button" variant="destructive" className="h-11 rounded-lg" disabled={!canOperate || hangup.isPending || ended || !call.data?.call_control_id} onClick={() => hangup.mutate()}>
          <PhoneOff className="h-4 w-4" />
          End call
        </Button>
      </div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--calls-muted)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
