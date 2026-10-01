import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Calendar, ChevronRight, Phone, Search, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePageLoading } from '@/hooks/use-page-loading';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/context/PermissionsContext';
import { sendSms } from '@/services/messaging';
import { addVoiceCallNote, getVoiceCall, getVoiceCalls } from '@/services/voice';
import type { VoiceCall } from '@/types/voice';
import CallNowButton from './workspace/CallNowButton';
import { CallsPagination } from './workspace/CallsPagination';
import TranscriptPanel from './workspace/TranscriptPanel';
import { useCallSearch } from './workspace/useCallSearch';
import ScheduleVoiceCallDialog from './ScheduleVoiceCallDialog';
import { CallsAvatar, EmptyCalls } from './workspace/bits';
import {
  briefingText,
  callerInitials,
  callerName,
  callDirectionLabel,
  callOwnerLabel,
  formatClock,
  formatRelative,
  getCallPhone,
  inboxDetail,
  inboxFilterFor,
  inboxStatusLine,
  isLiveCall,
  needsReview,
  nextStepText,
  notesOf,
  relatedShoot,
  suggestedSms,
  type InboxFilter,
} from './workspace/callDisplay';

const filters: Array<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'needs_attention', label: 'Needs attention' },
  { id: 'voicemail', label: 'Voicemail' },
];

export default function CallsInbox() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const canOperate = can('voice-calls', 'operate');
  const canSendSms = canOperate && can('messaging-sms', 'view');
  const selectedId = id ? Number(id) : null;
  const filter = (filters.some((item) => item.id === searchParams.get('filter')) ? searchParams.get('filter') : 'all') as InboxFilter;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const search = searchParams.get('q') || '';
  const setSearch = (value: string) => setSearchParams((params) => { params.set('q', value); params.set('page', '1'); return params; }, { replace: true });
  const debounced = useCallSearch(search.trim());
  const setPage = (value: number) => setSearchParams((params) => { params.set('page', String(value)); return params; }, { replace: true });
  const setFilter = (value: InboxFilter) => setSearchParams((params) => { params.set('filter', value); params.set('page', '1'); return params; }, { replace: true });
  const [tab, setTab] = useState<'activity' | 'transcript' | 'notes'>(searchParams.get('tab') === 'transcript' ? 'transcript' : 'activity');
  const [composeMode, setComposeMode] = useState<'sms' | 'note'>('note');
  const [draft, setDraft] = useState('');
  const initializedComposer = useRef('');

  const list = useQuery({
    queryKey: ['voice-calls', 'inbox', filter, debounced, page],
    queryFn: () => getVoiceCalls({ per_page: 20, page, filter: inboxFilterFor(filter), search: debounced || undefined }),
  });
  const attention = useQuery({
    queryKey: ['voice-calls', 'inbox-count', 'needs_attention'],
    queryFn: () => getVoiceCalls({ per_page: 1, filter: 'needs_attention' }),
  });
  const live = useQuery({
    queryKey: ['voice-calls', 'live-count'],
    queryFn: () => getVoiceCalls({ per_page: 10, filter: 'live' }),
    refetchInterval: 15000,
  });
  const selected = useQuery({
    queryKey: ['voice-call', selectedId],
    queryFn: () => getVoiceCall(selectedId as number),
    enabled: Number.isFinite(selectedId),
  });

  usePageLoading(list.isLoading || selected.isLoading);

  const rows = list.data?.data ?? [];
  const liveRows = live.data?.data ?? [];
  const call = selected.data ?? rows.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!call) return;
    const key = `${call.id}:${composeMode}`;
    if (initializedComposer.current === key) return;
    initializedComposer.current = key;
    setDraft(composeMode === 'sms' ? suggestedSms(call) : '');
  }, [call, composeMode]);

  const phone = getCallPhone(call);
  const shoot = relatedShoot(call);
  const notes = notesOf(call);
  const activity = useMemo(() => buildActivity(call, notes), [call, notes]);

  const sendNote = useMutation({
    mutationFn: (body: string) => addVoiceCallNote(call!.id, body),
    onSuccess: (updated, sentBody) => {
      queryClient.setQueryData(['voice-call', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      setDraft((current) => current.trim() === sentBody ? '' : current);
      toast({ title: 'Note saved' });
    },
    onError: (error) =>
      toast({ title: 'Could not save the note', description: error instanceof Error ? error.message : undefined, variant: 'destructive' }),
  });

  const sendReply = useMutation({
    mutationFn: (body: string) => sendSms({ to: phone, body_text: body }),
    onSuccess: (result, sentBody) => {
      if (result.message.status === 'FAILED' || result.message.status === 'CANCELLED') {
        toast({ title: 'Message was not sent', description: 'Your draft is still here. Review the message status before retrying.', variant: 'destructive' });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['voice-call', call?.id] });
      setDraft((current) => current.trim() === sentBody ? '' : current);
      toast({ title: result.message.status === 'SENT' || result.message.status === 'DELIVERED' ? 'Message sent' : 'Message queued' });
    },
    onError: (error) =>
      toast({ title: 'Could not send the message', description: error instanceof Error ? error.message : undefined, variant: 'destructive' }),
  });

  const onSubmit = () => {
    const body = draft.trim();
    if (!call || !body || !canOperate || (composeMode === 'sms' && !canSendSms)) return;
    if (composeMode === 'note') {
      sendNote.mutate(body);
      return;
    }
    if (!phone) {
      toast({ title: 'This call has no number to text', variant: 'destructive' });
      return;
    }
    sendReply.mutate(body);
  };

  return (
    <div className="calls-fill-page">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-[28px] font-semibold leading-9">Conversations</h2>
          <div className="flex flex-wrap items-center gap-2">
            {attention.data && <span className="calls-chip calls-chip-warning">{attention.data.total ?? 0} need attention</span>}
            <Link to="/calls/live" className="calls-chip calls-chip-success">Team queue{live.data ? ` · ${live.data.total ?? liveRows.length} live` : ''}</Link>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className={selectedId ? 'hidden min-h-0 lg:flex lg:flex-col lg:gap-3' : 'flex min-h-0 flex-col gap-3'}>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--calls-muted)]" />
            <Input
              value={search}
              aria-label="Search conversations"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone or transcript"
              className="calls-search pl-9"
            />
          </div>
          <div className="calls-filter-row">
            {filters.map((item) => (
              <button key={item.id} type="button" className="calls-filter" data-active={filter === item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div key={`${filter}-${debounced}-${page}`} className="calls-scroll space-y-2" aria-label="Conversation results" tabIndex={0}>
            {list.isLoading && <p role="status" className="p-4 text-sm text-[var(--calls-muted)]">Loading conversations…</p>}
            {rows.map((item) => (
              <button
                key={item.id}
                type="button"
                data-selected={item.id === selectedId}
                onClick={() => navigate(`/calls/inbox/${item.id}?${searchParams.toString()}`)}
                className="calls-item calls-panel flex w-full flex-col gap-1.5 p-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <CallsAvatar initials={callerInitials(item)} size={40} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{callerName(item)}</span><span className="mt-1 block truncate text-xs text-[var(--calls-muted)]">{inboxDetail(item)} · {inboxStatusLine(item)}</span></span>
                  <span className="text-xs text-[var(--calls-muted)]">{formatRelative(item.ended_at || item.started_at || item.created_at)}</span>
                </div>
              </button>
            ))}
            {list.isError && (
              <div role="alert" className="calls-panel p-4 text-sm text-[var(--calls-danger)]">
                Could not load conversations.
                <Button variant="outline" className="mt-3 calls-secondary" onClick={() => void list.refetch()}>
                  Try again
                </Button>
              </div>
            )}
            {!list.isLoading && !list.isError && rows.length === 0 && (
              <EmptyCalls fill icon={debounced || filter !== 'all' ? 'search' : 'calls'} title={debounced || filter !== 'all' ? 'No conversations match' : 'No calls yet'} description={debounced || filter !== 'all' ? 'Try another search or filter.' : 'Your incoming and outgoing conversations will appear here.'} />
            )}
          </div>
          <CallsPagination label="Conversations" page={page} pages={list.data?.last_page} total={list.data?.total} count={rows.length} pending={list.isFetching} error={list.isError} onChange={setPage} />
          {liveRows[0] && (
            <Link to={`/calls/live/${liveRows[0].id}`} className="calls-panel flex items-center gap-3 bg-[var(--calls-brand-soft)] p-3 text-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--calls-surface)]">
                <Phone className="h-4 w-4 text-[var(--calls-brand)]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{callerName(liveRows[0])} is live</span>
                <span className="text-xs text-[var(--calls-muted)]">View conversation</span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-[var(--calls-brand)]" />
            </Link>
          )}
        </div>

        <div className={!selectedId ? 'calls-scroll hidden lg:block' : 'calls-scroll'} aria-label="Conversation detail">
          {selected.isError && (
            <div role="alert" className="calls-panel p-5 text-sm text-[var(--calls-danger)]">
              Could not load this conversation.
              <Button className="calls-secondary mt-3" onClick={() => void selected.refetch()}>Try again</Button>
            </div>
          )}
          {!call && !selected.isLoading && !selected.isError && (
            <EmptyCalls fill icon="conversations" title="Select a conversation" description="Choose a call to see its recap, transcript and next steps." />
          )}
          {call && (
            <div className="calls-panel min-h-full overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-[var(--calls-border)] p-5">
                <div className="lg:hidden">
                  <Button variant="ghost" className="h-11 px-2" onClick={() => navigate(`/calls/inbox?${searchParams.toString()}`)}>
                    Back to inbox
                  </Button>
                </div>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <CallsAvatar initials={callerInitials(call)} size={40} />
                    <div>
                      <h3 className="text-[22px] font-semibold leading-7">{callerName(call)}</h3>
                      <p className="text-xs text-[var(--calls-muted)]">
                        {[phone, formatClock(call.started_at || call.created_at)].filter(Boolean).join(' · ')}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="calls-chip calls-chip-neutral">{callDirectionLabel(call)}</span>
                        <span className="calls-chip calls-chip-neutral">Owner · {callOwnerLabel(call)}</span>
                        {call.recording_consent_given && <span className="calls-chip calls-chip-success">Recording consent received</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CallNowButton to={phone} name={callerName(call)} reason={`Follow-up with ${callerName(call)}`} />
                    <ScheduleVoiceCallDialog
                      initialTargetPhone={phone}
                      initialReason={`Callback for ${callerName(call)}`}
                      trigger={<Button disabled={!canOperate} className="calls-secondary h-11 rounded-lg">Schedule callback</Button>}
                    />
                  </div>
                </div>
                {shoot && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--calls-subtle)] p-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 text-[var(--calls-muted)]" />
                      <div>
                        <p className="font-medium">{shoot.address}</p>
                        <p className="text-xs text-[var(--calls-muted)]">
                          {[shoot.scheduled_at ? new Date(shoot.scheduled_at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : shoot.status, shoot.photographer?.name]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>
                    <Button asChild variant="outline" className="calls-secondary h-11 rounded-lg">
                      <Link to={`/shoots/${shoot.id}`}>Open shoot</Link>
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-2xl bg-[var(--calls-ai-soft)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-[var(--calls-ai)]">
                      <Sparkles className="h-4 w-4" />
                      Robbie brief
                    </p>
                    <span className="text-xs text-[var(--calls-muted)]">
                      {isLiveCall(call) ? 'Live' : formatClock(call.ended_at || call.started_at)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6">{briefingText(call)}</p>
                  {nextStepText(call) && <p className="mt-3 text-sm text-[var(--calls-muted)]">Suggested next step: {nextStepText(call)}</p>}
                </div>

                <div className="flex items-center justify-between border-b border-[var(--calls-border)]">
                  {(['activity', 'transcript', 'notes'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTab(item)}
                      className={`px-1 pb-3 text-sm capitalize ${tab === item ? 'border-b-2 border-[var(--calls-brand)] text-[var(--calls-brand)]' : 'text-[var(--calls-muted)]'}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {tab === 'activity' && (
                  <div className="space-y-3">
                    {activity.map((item) => (
                      <div key={item.id} className="flex gap-3 text-sm">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--calls-border)]" />
                        <div>
                          <p>{item.body}</p>
                          <p className="text-xs text-[var(--calls-muted)]">{item.meta}</p>
                        </div>
                      </div>
                    ))}
                    {activity.length === 0 && <p className="text-sm text-[var(--calls-muted)]">No activity captured for this call yet.</p>}
                  </div>
                )}
                {tab === 'transcript' && (
                  <TranscriptPanel call={call} />
                )}
                {tab === 'notes' && (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={`${note.at}-${note.body}`} className="rounded-xl bg-[var(--calls-subtle)] p-3 text-sm">
                        <p>{note.body}</p>
                        <p className="mt-1 text-xs text-[var(--calls-muted)]">{[note.user_name, formatClock(note.at)].filter(Boolean).join(' · ')}</p>
                      </div>
                    ))}
                    {notes.length === 0 && <p className="text-sm text-[var(--calls-muted)]">No private notes yet.</p>}
                  </div>
                )}

                <div className="rounded-2xl bg-[var(--calls-subtle)] p-3">
                  <Textarea
                    value={draft}
                    disabled={!canOperate || (composeMode === 'sms' && !canSendSms)}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={composeMode === 'note' ? 'Add a private note…' : `Reply to ${callerName(call).split(' ')[0] || 'the caller'}…`}
                    className="min-h-20 border-0 bg-transparent shadow-none"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-1" role="group" aria-label="Reply type"><button type="button" className="calls-filter" data-active={composeMode === 'note'} aria-pressed={composeMode === 'note'} onClick={() => setComposeMode('note')}>Private note</button><button type="button" className="calls-filter" data-active={composeMode === 'sms'} aria-pressed={composeMode === 'sms'} onClick={() => setComposeMode('sms')}>Message</button></div>
                    <div className="flex gap-2">
                      {composeMode === 'sms' && <Button disabled={!canOperate || !canSendSms} type="button" variant="outline" className="calls-ai h-11 rounded-lg" onClick={() => setDraft(suggestedSms(call))}>
                        Use recap draft
                      </Button>}
                      <Button
                        type="button"
                        className="calls-primary h-11 rounded-lg"
                        disabled={!canOperate || (composeMode === 'sms' && !canSendSms) || !draft.trim() || sendNote.isPending || sendReply.isPending}
                        onClick={onSubmit}
                      >
                        <Send className="h-4 w-4" />
                        {composeMode === 'note' ? 'Save note' : 'Send'}
                      </Button>
                    </div>
                  </div>
                  {!permissionsLoading && !canOperate && <p className="mt-2 text-xs text-[var(--calls-muted)]">You have read-only Calls access.</p>}
                  {!permissionsLoading && canOperate && composeMode === 'sms' && !canSendSms && <p className="mt-2 text-xs text-[var(--calls-muted)]">SMS access is required to send a message. You can still add private notes.</p>}
                </div>

                {(needsReview(call) || !isLiveCall(call)) && (
                  <Button asChild className="calls-primary h-11 w-full rounded-lg">
                    <Link to={`/calls/inbox/${call.id}/wrap-up`}>
                      {canOperate && needsReview(call) ? 'Wrap up this conversation' : 'Review wrap-up'}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildActivity(call: VoiceCall | null, notes: ReturnType<typeof notesOf>) {
  if (!call) return [];
  const items = [];
  if (call.live_transcript_preview || call.transcript) {
    items.push({
      id: 'quote',
      body: `“${(call.live_transcript_preview || call.transcript || '').split(/[.!?]/)[0]}”`,
      meta: `${call.disposition === 'voicemail' ? 'Voicemail' : 'Call'} · ${formatClock(call.ended_at || call.started_at)}`,
    });
  }
  if (call.summary) {
    items.push({ id: 'summary', body: call.summary, meta: call.summary_generated_at ? formatClock(call.summary_generated_at) : 'Recap' });
  }
  notes.forEach((note, index) => {
    items.push({ id: `note-${index}`, body: note.body, meta: [note.user_name, formatClock(note.at)].filter(Boolean).join(' · ') });
  });
  return items;
}
