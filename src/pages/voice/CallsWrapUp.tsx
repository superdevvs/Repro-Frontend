import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2, Download, FileText, Pause, Play, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePageLoading } from '@/hooks/use-page-loading';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/context/PermissionsContext';
import { getVoiceCall, getVoiceCallRecordingUrl, wrapUpVoiceCall } from '@/services/voice';
import type { VoiceWrapUpPayload } from '@/types/voice';
import { CallsWave, EmptyCalls } from './workspace/bits';
import {
  callerName,
  formatDuration,
  formatWhen,
  getCallPhone,
  recapBody,
  recapHeadline,
  recapOutcome,
  recordingMoments,
  relatedShoot,
  smsSegmentCount,
  suggestedSms,
  suggestedTaskTitle,
  toLocalInput,
  wrapUpOf,
} from './workspace/callDisplay';

const outcomes = ['Follow-up required', 'Resolved', 'Voicemail', 'Callback scheduled'];

export default function CallsWrapUp() {
  const { id } = useParams();
  const callId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const canOperate = can('voice-calls', 'operate');
  const hasSmsAccess = can('messaging-sms', 'view');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hydratedCall = useRef<number | null>(null);
  const submission = useRef<{ payload: string; key: string } | null>(null);
  const [editingRecap, setEditingRecap] = useState(false);
  const [editingSms, setEditingSms] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [outcome, setOutcome] = useState('Follow-up required');
  const [taskTitle, setTaskTitle] = useState('');
  const [createTask, setCreateTask] = useState(false);
  const [taskStatus, setTaskStatus] = useState<'open' | 'completed'>('open');
  const [taskDue, setTaskDue] = useState(toLocalInput());
  const [attachShoot, setAttachShoot] = useState(true);
  const [smsBody, setSmsBody] = useState('');
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [sendUncertain, setSendUncertain] = useState(false);

  const call = useQuery({
    queryKey: ['voice-call', callId],
    queryFn: () => getVoiceCall(callId),
    enabled: Number.isFinite(callId),
  });
  const recording = useQuery({
    queryKey: ['voice-call-recording', callId],
    queryFn: () => getVoiceCallRecordingUrl(callId),
    enabled: Number.isFinite(callId) && Boolean(call.data?.recording_consent_given && (call.data?.recording_url || call.data?.metadata?.recording_id)),
    staleTime: 240_000,
    refetchOnWindowFocus: !playing,
  });
  usePageLoading(call.isLoading);

  useEffect(() => {
    if (!call.data || hydratedCall.current === call.data.id) return;
    hydratedCall.current = call.data.id;
    submission.current = null;
    setPlaying(false);
    setPlaybackError(false);
    setProgress(0);
    const saved = wrapUpOf(call.data);
    setTitle(recapHeadline(call.data));
    setBody(recapBody(call.data));
    setOutcome(recapOutcome(call.data));
    setTaskTitle(suggestedTaskTitle(call.data));
    setCreateTask(Boolean(saved?.task?.id));
    setTaskStatus(saved?.task?.status || 'open');
    setTaskDue(toLocalInput(saved?.task?.due_at));
    setSmsBody(suggestedSms(call.data));
    setAttachShoot(saved?.task?.id ? Boolean(saved.task.related_shoot_id) : Boolean(relatedShoot(call.data)?.id));
    setSendUncertain(saved?.sms?.status === 'uncertain');
    setSendResult(saved?.sms?.status === 'uncertain' ? 'The previous message delivery is uncertain. Check its status before starting another send.' : null);
  }, [call.data]);

  const save = useMutation({
    mutationFn: (sendSms: boolean) => {
      if (!canOperate || (sendSms && !hasSmsAccess)) {
        return Promise.reject(new Error('You do not have permission to perform this action.'));
      }
      const payload: VoiceWrapUpPayload = {
        recap_title: title.trim(),
        recap_body: body.trim(),
        outcome,
        create_task: createTask,
        task_title: createTask ? taskTitle.trim() : undefined,
        task_due_at: createTask && taskDue ? new Date(taskDue).toISOString() : undefined,
        task_status: taskStatus,
        attach_shoot: attachShoot,
        send_sms: sendSms,
        sms_body: smsBody.trim(),
      };
      const fingerprint = JSON.stringify(payload);
      if (submission.current?.payload !== fingerprint) {
        submission.current = { payload: fingerprint, key: crypto.randomUUID() };
      }
      return wrapUpVoiceCall(callId, { ...payload, idempotency_key: submission.current.key });
    },
    onSuccess: (updated, sendSms) => {
      queryClient.setQueryData(['voice-call', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      const saved = wrapUpOf(updated);
      const result = updated.wrap_up_result;
      const smsSent = result ? result.sms_sent === true : saved?.sms_sent === true && (saved.sms?.status === 'sent' || Boolean(saved.sms?.sent_at));
      if (sendSms && !smsSent) {
        const uncertain = (result?.sms_status ?? saved?.sms?.status) === 'uncertain';
        const sendError = result?.error ?? saved?.sms?.error;
        setSendUncertain(uncertain);
        const message = uncertain
          ? 'Your recap and task changes are saved. Message delivery is uncertain; check its status before sending again.'
          : `Your recap and task changes are saved. The SMS was not sent.${sendError ? ` ${sendError}` : ''}`;
        setSendResult(message);
        toast({ title: 'Wrap-up saved · message not confirmed', description: message, variant: 'destructive' });
        return;
      }
      toast({
        title: sendSms ? 'Follow-up sent' : 'Wrap-up saved',
        description: sendSms ? 'The message was sent and your changes were saved.' : 'Your changes were saved. No message was sent.',
      });
      navigate(`/calls/inbox/${updated.id}`);
    },
    onError: () =>
      toast({
        title: 'Could not confirm wrap-up',
        description: 'Your changes may have been saved. Retry the same submission to check the result without sending twice.',
        variant: 'destructive',
      }),
  });

  const data = call.data;
  const phone = getCallPhone(data);
  const shoot = relatedShoot(data);
  const moments = recordingMoments(data);
  const duration = formatDuration(data?.duration_seconds);
  const canSave = canOperate && Boolean(data) && (!createTask || Boolean(taskTitle.trim() && taskDue && Number.isFinite(new Date(taskDue).getTime())));
  const savedSms = wrapUpOf(data)?.sms;
  const alreadySent = Boolean(savedSms?.sent_at && savedSms.body?.trim() === smsBody.trim());
  const canSend = hasSmsAccess && Boolean(phone && smsBody.trim()) && !sendUncertain && !alreadySent;

  const seek = async (seconds: number) => {
    if (!audioRef.current) return;
    try {
      audioRef.current.currentTime = seconds;
      await audioRef.current.play();
      setPlaying(true);
      setPlaybackError(false);
    } catch {
      setPlaying(false);
      setPlaybackError(true);
      toast({ title: 'Could not play the recording', description: 'Refresh the recording link and try again.', variant: 'destructive' });
    }
  };

  if (call.isError) {
    return (
      <div role="alert" className="calls-panel p-6 text-sm text-[var(--calls-danger)]">
        Could not load this wrap-up.
        <Button variant="outline" className="mt-3 calls-secondary" onClick={() => void call.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data && !call.isLoading) {
    return <EmptyCalls title="This conversation is no longer available" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-[28px] font-semibold leading-9">A good conversation. A clear next step.</h2>
          <p className="mt-1 text-sm text-[var(--calls-muted)]">
            {data ? `${callerName(data)} · ${duration} · Call ended at ${data.ended_at ? new Date(data.ended_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}` : 'Loading…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="calls-chip calls-chip-warning">{wrapUpOf(data)?.saved_at ? 'Previously saved' : 'Needs your review'}</span>
          <Button asChild variant="outline" className="calls-secondary h-11 rounded-lg">
            <Link to={data ? `/calls/inbox/${data.id}` : '/calls/inbox'}>Back to inbox</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <div className="space-y-4">
          <section className="calls-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-[var(--calls-ai)]" />
                Conversation recap
              </p>
              <Button disabled={!canOperate} type="button" variant="outline" className="calls-secondary h-11 rounded-lg" onClick={() => setEditingRecap((value) => !value)}>
                {editingRecap ? 'Done' : 'Edit recap'}
              </Button>
            </div>
            {editingRecap ? (
              <div className="mt-4 space-y-3">
                <Input disabled={!canOperate} value={title} onChange={(event) => setTitle(event.target.value)} />
                <Textarea disabled={!canOperate} value={body} onChange={(event) => setBody(event.target.value)} className="min-h-28" />
              </div>
            ) : (
              <>
                <h3 className="mt-4 text-[22px] font-semibold leading-7">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--calls-muted)]">{body}</p>
              </>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--calls-brand-soft)] px-3 py-2">
              <span className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-[var(--calls-brand)]" />
                Outcome · {outcome}
              </span>
              <select
                disabled={!canOperate}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                className="h-11 rounded-lg border border-[var(--calls-border)] bg-[var(--calls-surface)] px-3 text-sm"
              >
                {outcomes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-3 text-xs text-[var(--calls-muted)]">Review the call details and suggested recap before saving.</p>
          </section>

          <section className="calls-panel p-5">
            <h3 className="text-lg font-semibold">Replay what matters</h3>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--calls-subtle)] p-3">
              <Button
                type="button"
                variant="outline"
                className="calls-secondary h-11 w-11 rounded-lg p-0"
                disabled={!recording.data}
                onClick={() => {
                  if (!audioRef.current) return;
                  if (playing) {
                    audioRef.current.pause();
                    setPlaying(false);
                  } else {
                    void seek(audioRef.current.currentTime);
                  }
                }}
                aria-label={playing ? 'Pause recording' : 'Play recording'}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <CallsWave played={progress} />
              <span className="text-xs text-[var(--calls-muted)]">
                {data ? `${formatDuration(Math.round((data.duration_seconds || 0) * progress))} / ${duration}` : '0:00'}
              </span>
            </div>
            {recording.data && (
              <audio
                ref={audioRef}
                src={recording.data}
                className="hidden"
                onTimeUpdate={(event) => {
                  const node = event.currentTarget;
                  setProgress(node.duration ? node.currentTime / node.duration : 0);
                }}
                onEnded={() => setPlaying(false)}
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                onError={() => {
                  setPlaying(false);
                  setPlaybackError(true);
                }}
              />
            )}
            {(recording.isError || playbackError) && (
              <div role="alert" className="mt-3 text-sm text-[var(--calls-danger)]">
                Could not play the recording. Refresh its link and try again.
                <Button disabled={recording.isFetching} className="calls-secondary ml-2" onClick={() => {
                  setPlaybackError(false);
                  void recording.refetch();
                }}>Retry recording</Button>
              </div>
            )}
            {!recording.data && !recording.isError && (
              <p className="mt-3 text-sm text-[var(--calls-muted)]">
                {data?.recording_consent_given ? 'The recording is not ready yet.' : 'No recording is available for this call.'}
              </p>
            )}
            <div className="mt-4 space-y-2">
              {moments.map((moment) => (
                <button
                  key={moment.at}
                  type="button"
                  disabled={!recording.data}
                  onClick={() => seek(moment.seconds)}
                  className="flex w-full items-center justify-between rounded-xl bg-[var(--calls-subtle)] px-3 py-2 text-left text-sm"
                >
                  <span>
                    <span className="mr-3 text-[var(--calls-muted)]">{moment.at}</span>
                    {moment.label}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[var(--calls-muted)]" />
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button asChild variant="outline" className="calls-secondary h-11 rounded-lg">
                  <Link to={data ? `/calls/inbox/${data.id}?tab=transcript` : '/calls/inbox'}>
                    <FileText className="h-4 w-4" />
                    Open transcript
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="calls-secondary h-11 rounded-lg"
                  disabled={!recording.data}
                  onClick={() => recording.data && window.open(recording.data, '_blank', 'noopener,noreferrer')}
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
              <span className="text-xs text-[var(--calls-muted)]">Access follows recording permissions</span>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="calls-panel p-5">
            <h3 className="text-lg font-semibold">Ready when you are</h3>
            <p className="mt-1 text-sm text-[var(--calls-muted)]">Choose what to store or send.</p>
            <div className="mt-4 rounded-2xl bg-[var(--calls-subtle)] p-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input disabled={!canOperate} type="checkbox" checked={createTask} onChange={(event) => setCreateTask(event.target.checked)} />
                {wrapUpOf(data)?.task?.id ? 'Update follow-up task' : 'Create a follow-up task'}
              </label>
              <p className="mt-2 text-xs text-[var(--calls-muted)]">An internal task for your team. This does not schedule an outbound call.</p>
              <Input aria-label="Task title" className="mt-2" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} disabled={!canOperate || !createTask} />
              <p className="mt-2 text-xs text-[var(--calls-muted)]">
                {wrapUpOf(data)?.task?.id ? 'Existing task owner preserved' : `Assigned to ${user?.name || 'you'}`} · {formatWhen(taskDue || null)}
              </p>
              <Input aria-label="Task due date" type="datetime-local" className="mt-2" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} disabled={!canOperate || !createTask} />
              {wrapUpOf(data)?.task?.id && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input disabled={!canOperate} type="checkbox" checked={taskStatus === 'completed'} onChange={(event) => setTaskStatus(event.target.checked ? 'completed' : 'open')} />
                  Task completed
                </label>
              )}
              {shoot && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input disabled={!canOperate} type="checkbox" checked={attachShoot} onChange={(event) => setAttachShoot(event.target.checked)} />
                  Attach to {shoot.address}
                </label>
              )}
            </div>
            <div className="mt-4 rounded-2xl bg-[var(--calls-ai-soft)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--calls-ai)]">Follow-up SMS · Draft</p>
                <Button disabled={!canOperate} type="button" variant="ghost" className="h-8 px-2 text-[var(--calls-ai)]" onClick={() => setEditingSms((value) => !value)}>
                  {editingSms ? 'Done' : 'Edit message'}
                </Button>
              </div>
              {editingSms ? (
                <Textarea disabled={!canOperate} className="mt-2 min-h-28" value={smsBody} onChange={(event) => setSmsBody(event.target.value)} />
              ) : (
                <p className="mt-3 text-sm leading-6">{smsBody}</p>
              )}
              <p className="mt-3 text-xs text-[var(--calls-muted)]">
                To {phone || 'an unknown number'} · {smsSegmentCount(smsBody)} segment{smsSegmentCount(smsBody) === 1 ? '' : 's'}
              </p>
            </div>
            <p className="mt-4 text-xs text-[var(--calls-muted)]">
              {createTask ? (wrapUpOf(data)?.task?.id ? 'Your existing task will be updated. ' : '1 internal task will be created. ') : 'No task will be created. '}
              The message is sent only when you choose Save & send.
            </p>
            {sendResult && <p role="alert" className="mt-3 rounded-xl bg-[var(--calls-warning-soft)] p-3 text-sm text-[var(--calls-warning)]">{sendResult}</p>}
            {alreadySent && <p className="mt-3 text-sm text-[var(--calls-brand)]">This follow-up was already sent. Edit the message to send a new follow-up.</p>}
            {!permissionsLoading && !canOperate && <p className="mt-3 text-sm text-[var(--calls-muted)]">You have read-only Calls access.</p>}
            {!permissionsLoading && canOperate && !hasSmsAccess && <p className="mt-3 text-sm text-[var(--calls-muted)]">SMS access is required to send a follow-up. You can still save this wrap-up.</p>}
            <div className="mt-4 space-y-2">
              <Button
                type="button"
                variant="outline"
                className="calls-secondary h-11 w-full rounded-lg"
                disabled={save.isPending || !canSave}
                onClick={() => save.mutate(false)}
              >
                Save without sending
              </Button>
              <Button
                type="button"
                className="calls-primary h-11 w-full rounded-lg"
                disabled={save.isPending || !canSave || !canSend}
                onClick={() => save.mutate(true)}
              >
                Save & send follow-up
              </Button>
            </div>
            {!phone && <p className="mt-2 text-xs text-[var(--calls-warning)]">This call has no phone number to text.</p>}
          </section>
          <p className="flex items-start gap-2 text-xs text-[var(--calls-muted)]">
            <ShieldCheck className="mt-0.5 h-4 w-4" />
            Reviewable actions, clear ownership and a complete activity trail.
          </p>
        </aside>
      </div>
    </div>
  );
}
