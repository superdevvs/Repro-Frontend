import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Delete,
  FileText,
  Flag,
  Hash,
  Headphones,
  Link as LinkIcon,
  MessageCircle,
  MoreVertical,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Search,
  Sparkles,
  UserRoundPlus,
  Users,
  Voicemail,
  XCircle,
} from 'lucide-react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getSmsThreads, sendSms, updateSmsContactComment } from '@/services/messaging';
import {
  createScheduledVoiceCall,
  getScheduledVoiceCalls,
  getVoiceCalls,
  getVoiceSettings,
  getVoiceStats,
  pageVoiceCallStaff,
  placeVoiceCall,
} from '@/services/voice';
import type { SmsContact, SmsThreadSummary } from '@/types/messaging';
import type { VoiceCall, VoiceStatsCard } from '@/types/voice';
import MakeTestCallDialog from './MakeTestCallDialog';
import ScheduleVoiceCallDialog from './ScheduleVoiceCallDialog';

const CANONICAL_FROM_NUMBER = '+18888041663';

const metricFallbacks: Array<VoiceStatsCard & { icon: typeof PhoneCall; color: string }> = [
  { key: 'total_calls', label: 'Total Calls', value: 0, icon: PhoneCall, color: '#1d8fff' },
  { key: 'answered', label: 'Answered', value: 0, icon: PhoneIncoming, color: '#22c55e' },
  { key: 'missed', label: 'Missed', value: 0, icon: PhoneMissed, color: '#f97316' },
  { key: 'avg_duration', label: 'Avg Duration', value: 0, suffix: 'sec', icon: Clock3, color: '#3b82f6' },
  { key: 'ai_handled', label: 'AI Handled', value: 0, icon: Bot, color: '#8b5cf6' },
  { key: 'needs_follow_up', label: 'Needs Follow-up', value: 0, icon: Flag, color: '#f59e0b' },
];

const keypad = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
  ['*', ''],
  ['0', ''],
  ['#', ''],
];

const panelClass = 'rounded-lg border border-border bg-card shadow-sm';
const subtlePanelClass = 'rounded-lg border border-border bg-muted/30';
const dialerPanelClass = [
  'rounded-lg border p-3 shadow-sm xl:sticky xl:top-4',
  'border-sky-300/80 bg-[linear-gradient(145deg,hsl(var(--card))_0%,rgba(239,246,255,0.98)_42%,rgba(220,252,231,0.88)_100%)] shadow-[0_18px_45px_rgba(14,165,233,0.16)] ring-1 ring-sky-100/80',
  'dark:border-border dark:bg-card dark:bg-none dark:shadow-sm dark:ring-0',
].join(' ');

const normalizePhone = (value?: string | null) => (value || '').trim();

const displayPhone = (value?: string | null) => normalizePhone(value) || 'Unknown caller';

const getCallPhone = (call?: VoiceCall | null) => normalizePhone(call?.from_phone) || normalizePhone(call?.to_phone);

const formatDuration = (seconds?: number | null) => {
  const total = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return minutes > 0 ? `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${secs} sec`;
};

const formatRelative = (value?: string | null) => {
  if (!value) return 'recently';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff)) return 'recently';
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const tomorrowMorningIso = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
};

const toLocalInputValue = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const statusClasses = (status?: string | null) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('miss') || normalized.includes('fail') || normalized.includes('no answer')) return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300';
  if (normalized.includes('complete') || normalized.includes('answer') || normalized.includes('success')) return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (normalized.includes('schedule') || normalized.includes('callback')) return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300';
  if (normalized.includes('handoff') || normalized.includes('transfer')) return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300';
  return 'border-border bg-muted text-muted-foreground';
};

const callTone = (call: VoiceCall) => {
  const status = String(call.status || call.disposition || '').toLowerCase();
  if (status.includes('miss') || status.includes('fail')) return 'orange';
  if (call.direction === 'OUTBOUND') return 'blue';
  return 'green';
};

const deriveTimeline = (call?: VoiceCall | null) => {
  if (!call) return [];
  const baseTime = call.started_at || call.created_at;
  const rows = [
    {
      time: baseTime,
      label: call.direction === 'OUTBOUND' ? 'Outbound call started' : 'AI answered call',
      status: call.status || 'Connected',
    },
  ];

  if (call.intent) rows.push({ time: baseTime, label: `Captured caller intent: ${call.intent.replace(/_/g, ' ')}`, status: 'Completed' });
  if (call.menu_digit) rows.push({ time: baseTime, label: `Menu digit ${call.menu_digit} selected`, status: 'Completed' });
  if (call.escalation_reason || call.disposition?.includes('transfer')) rows.push({ time: call.updated_at, label: 'Transfer or handoff attempted', status: call.disposition || 'Handoff' });
  if (call.callback_status || call.scheduled_voice_call_id) rows.push({ time: call.preferred_callback_at || call.updated_at, label: 'Callback scheduled', status: call.callback_status || 'Scheduled' });
  if (call.last_telnyx_command_status) rows.push({ time: call.updated_at, label: 'Telnyx command recorded', status: String(call.last_telnyx_command_status.ok ?? 'tracked') });
  if (call.summary || call.transcript) rows.push({ time: call.ended_at || call.updated_at, label: 'Conversation summary captured', status: call.summary ? 'Success' : 'Transcript' });

  return rows.slice(0, 6);
};

const metricFor = (cards: VoiceStatsCard[], fallback: (typeof metricFallbacks)[number]) => {
  const found = cards.find((card) => card.key === fallback.key || card.label.toLowerCase() === fallback.label.toLowerCase());
  return { ...fallback, ...found };
};

const uniqueContacts = (threads: SmsThreadSummary[] = []) => {
  const seen = new Set<string>();
  return threads
    .map((thread) => thread.contact)
    .filter((contact): contact is SmsContact => Boolean(contact?.primaryNumber || contact?.numbers?.[0]?.number))
    .filter((contact) => {
      const key = String(contact.id || contact.primaryNumber);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

type ConfirmAction = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

type SmsDialogState = {
  open: boolean;
  target: string;
  body: string;
};

export default function CallsOverview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [smsDialog, setSmsDialog] = useState<SmsDialogState>({ open: false, target: '', body: '' });

  const stats = useQuery({ queryKey: ['voice-stats', '7d'], queryFn: () => getVoiceStats('7d') });
  const calls = useQuery({ queryKey: ['voice-calls', 'overview'], queryFn: () => getVoiceCalls({ per_page: 6 }) });
  const callbacks = useQuery({ queryKey: ['scheduled-voice-calls', 'overview'], queryFn: () => getScheduledVoiceCalls({ per_page: 6 }) });
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });

  const recentCalls = calls.data?.data ?? [];
  const selectedCall = recentCalls.find((call) => call.id === selectedCallId) ?? recentCalls[0] ?? null;
  const selectedPhone = getCallPhone(selectedCall);
  const statCards = metricFallbacks.map((fallback) => metricFor(stats.data?.cards ?? [], fallback));

  const smsMutation = useMutation({
    mutationFn: () => sendSms({ to: smsDialog.target, body_text: smsDialog.body }),
    onSuccess: () => {
      toast({ title: 'SMS sent', description: `Message sent to ${smsDialog.target}.` });
      setSmsDialog({ open: false, target: '', body: '' });
    },
    onError: (error) => {
      toast({
        title: 'Unable to send SMS',
        description: error instanceof Error ? error.message : 'Please check the phone number and try again.',
        variant: 'destructive',
      });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: (payload: { phone: string; reason: string; scheduledAt: string; summary: string }) =>
      createScheduledVoiceCall({
        target_phone: payload.phone,
        from_phone: CANONICAL_FROM_NUMBER,
        reason: payload.reason,
        scheduled_at: payload.scheduledAt,
        summary: payload.summary,
        max_attempts: settings.data?.callback_max_attempts ?? 3,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-voice-calls'] });
      toast({ title: 'Callback scheduled', description: 'The call was added to the callback queue.' });
    },
    onError: (error) => {
      toast({
        title: 'Unable to schedule callback',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const pageStaffMutation = useMutation({
    mutationFn: (call: VoiceCall) => pageVoiceCallStaff(call.id, 'overview_assign_human_agent'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-voice-calls'] });
      toast({ title: 'Staff handoff queued', description: 'The selected call was escalated.' });
    },
    onError: (error) => {
      toast({
        title: 'Unable to page staff',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const openSms = (target: string, body = '') => {
    if (!target) {
      toast({ title: 'No phone number selected', description: 'Choose a caller or enter a number in Smart Dialer.', variant: 'destructive' });
      return;
    }
    setSmsDialog({ open: true, target, body });
  };

  const scheduleWithConfirm = (phone: string, reason: string, scheduledAt: string, summary: string) => {
    if (!phone) {
      toast({ title: 'No phone number selected', description: 'Choose a caller or enter a number first.', variant: 'destructive' });
      return;
    }
    setConfirmAction({
      title: 'Schedule callback?',
      description: `Create a scheduled voice call to ${phone}.`,
      confirmLabel: 'Schedule',
      onConfirm: () => scheduleMutation.mutate({ phone, reason, scheduledAt, summary }),
    });
  };

  return (
    <div className="min-h-[calc(100vh-170px)] text-foreground">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {statCards.map((card) => (
              <MetricCard key={card.key} card={card} />
            ))}
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(340px,0.95fr)_1.35fr]">
            <RecentCallsPanel calls={recentCalls} selectedCallId={selectedCall?.id ?? null} onSelect={setSelectedCallId} loading={calls.isLoading} />

            <div className="space-y-3">
              <TimelinePanel call={selectedCall} />
              <AiSummaryPanel call={selectedCall} assistantId={settings.data?.assistant_id} />
              <FollowUpSuggestions
                call={selectedCall}
                onSms={() => openSms(selectedPhone, 'Hi, this is R/E Pro Photos following up on your call.')}
                onCallbackTomorrow={() => scheduleWithConfirm(selectedPhone, 'callback_tomorrow', tomorrowMorningIso(), 'Call back tomorrow')}
                onAssignHuman={() => {
                  if (!selectedCall) {
                    toast({ title: 'No call selected', description: 'Select a recent call first.', variant: 'destructive' });
                    return;
                  }
                  setConfirmAction({
                    title: 'Page staff?',
                    description: 'Create a staff handoff/escalation for the selected call.',
                    confirmLabel: 'Page staff',
                    onConfirm: () => pageStaffMutation.mutate(selectedCall),
                  });
                }}
                onConsultation={() => scheduleWithConfirm(selectedPhone, 'shoot_consultation', tomorrowMorningIso(), 'Schedule shoot consultation')}
              />
            </div>
          </div>
        </div>

        <SmartDialerPanel
          defaultFrom={CANONICAL_FROM_NUMBER}
          onSms={openSms}
          onConfirm={setConfirmAction}
        />
      </div>

      <SmsComposeDialog
        state={smsDialog}
        sending={smsMutation.isPending}
        onOpenChange={(open) => setSmsDialog((current) => ({ ...current, open }))}
        onBodyChange={(body) => setSmsDialog((current) => ({ ...current, body }))}
        onSend={() => smsMutation.mutate()}
      />

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmAction?.onConfirm();
                setConfirmAction(null);
              }}
            >
              {confirmAction?.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetricCard({ card }: { card: VoiceStatsCard & { icon: typeof PhoneCall; color: string } }) {
  const Icon = card.icon;
  const value = card.key.includes('duration') ? formatDuration(card.value) : card.value.toLocaleString();
  const trendPositive = !card.key.includes('miss') && !card.key.includes('follow');
  const sparkline = card.sparkline?.length ? card.sparkline : Array.from({ length: 14 }, (_, index) => ({ date: String(index), value: 0 }));

  return (
    <div className={`${panelClass} min-h-[116px] overflow-hidden p-3`}>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${card.color}22`, color: card.color }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 text-sm font-medium text-foreground">{card.label}</div>
      </div>
      <div className="mt-3 text-2xl font-semibold leading-none text-foreground">{value}</div>
      <div className={`mt-1.5 text-xs ${trendPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
        {trendPositive ? '↑' : '↓'} Live 7d trend
      </div>
      <div className="mt-1.5 h-7">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkline}>
            <Line type="monotone" dataKey="value" stroke={card.color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RecentCallsPanel({
  calls,
  selectedCallId,
  onSelect,
  loading,
}: {
  calls: VoiceCall[];
  selectedCallId: number | null;
  onSelect: (id: number) => void;
  loading: boolean;
}) {
  return (
    <section className={`${panelClass} min-h-[360px] p-3`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Recent Calls</h2>
        <Button asChild size="sm" variant="outline" className="h-8">
          <Link to="/calls/log">View All</Link>
        </Button>
      </div>
      <div className="space-y-2.5">
        {calls.map((call) => {
          const tone = callTone(call);
          const selected = call.id === selectedCallId;
          return (
            <button
              key={call.id}
              type="button"
              onClick={() => onSelect(call.id)}
              className={`w-full rounded-lg border p-2.5 text-left transition ${
                selected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    tone === 'green'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : tone === 'orange'
                        ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                  }`}
                >
                  {tone === 'orange' ? <PhoneMissed className="h-4 w-4" /> : call.direction === 'OUTBOUND' ? <PhoneOutgoing className="h-4 w-4" /> : <PhoneIncoming className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{call.caller_user?.name ?? call.caller_contact?.name ?? displayPhone(getCallPhone(call))}</span>
                    <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/40">{call.direction}</Badge>
                    <Badge className={statusClasses(call.status)}>{call.status || 'Tracked'}</Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{call.summary || call.transcript || 'No summary yet.'}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatRelative(call.started_at || call.created_at)}</span>
                    {call.callback_status && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">{call.callback_status}</Badge>}
                    {call.intent && <Badge className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">{call.intent.replace(/_/g, ' ')}</Badge>}
                  </div>
                </div>
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          );
        })}
        {loading && <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Loading calls...</div>}
        {!loading && calls.length === 0 && <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No voice calls yet.</div>}
      </div>
      {calls.length > 0 && <div className="mt-3 text-xs text-muted-foreground">Showing 1 to {calls.length} recent calls</div>}
    </section>
  );
}

function TimelinePanel({ call }: { call?: VoiceCall | null }) {
  const rows = deriveTimeline(call);
  return (
    <section className={`${panelClass} p-3`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">AI Call Activity Timeline</h2>
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live</div>
      </div>
      <div className="space-y-2.5">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="grid grid-cols-[24px_72px_minmax(0,1fr)_96px] items-center gap-2.5 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/50 text-primary">{index + 1}</div>
            <div className="text-muted-foreground">{row.time ? new Date(row.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Now'}</div>
            <div className="truncate text-foreground">{row.label}</div>
            <Badge className={`${statusClasses(row.status)} justify-center`}>{row.status}</Badge>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Select a call to see AI activity.</div>}
      </div>
    </section>
  );
}

function AiSummaryPanel({ call, assistantId }: { call?: VoiceCall | null; assistantId?: string | null }) {
  const intent = call?.intent?.replace(/_/g, ' ') || 'Unknown';
  const isPositive = call?.status?.toLowerCase().includes('complete') || Boolean(call?.summary);
  const bookingProbability = call?.intent?.includes('booking') ? 'High (87%)' : call?.intent ? 'Medium' : 'Unknown';

  return (
    <section className={`${panelClass} p-3`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">AI Summary</h2>
        <Badge variant="secondary">Generated by Robbie AI</Badge>
      </div>
      <div className={subtlePanelClass}>
        <div className="grid gap-3 p-3 md:grid-cols-[60px_repeat(3,minmax(0,1fr))]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <SummaryItem label="Voice Sentiment" value={isPositive ? 'Positive' : 'Needs Review'} tone={isPositive ? 'green' : 'orange'} />
          <SummaryItem label="Caller Intent" value={intent} />
          <SummaryItem label="Booking Probability" value={bookingProbability} tone={bookingProbability.startsWith('High') ? 'green' : undefined} />
        </div>
        <div className="grid gap-3 border-t border-border p-3 md:grid-cols-2">
          <SummaryItem label="Unresolved Issues" value={call?.escalation_reason || (call?.callback_status ? 'Callback pending' : 'None detected')} />
          <SummaryItem label="Assistant" value={assistantId || call?.assistant_id || 'Not configured'} />
        </div>
        <p className="line-clamp-2 border-t border-border p-3 text-sm text-muted-foreground">{call?.summary || call?.transcript || 'No AI summary has been captured for this call yet.'}</p>
      </div>
    </section>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'orange' }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate text-sm font-semibold ${tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'orange' ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function FollowUpSuggestions({
  call,
  onSms,
  onCallbackTomorrow,
  onAssignHuman,
  onConsultation,
}: {
  call?: VoiceCall | null;
  onSms: () => void;
  onCallbackTomorrow: () => void;
  onAssignHuman: () => void;
  onConsultation: () => void;
}) {
  const disabled = !call;
  const colorClasses = {
    emerald: 'border-emerald-200 bg-emerald-50 hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/30 dark:hover:border-emerald-700',
    blue: 'border-blue-200 bg-blue-50 hover:border-blue-300 dark:border-blue-900 dark:bg-blue-950/30 dark:hover:border-blue-700',
    violet: 'border-violet-200 bg-violet-50 hover:border-violet-300 dark:border-violet-900 dark:bg-violet-950/30 dark:hover:border-violet-700',
    orange: 'border-orange-200 bg-orange-50 hover:border-orange-300 dark:border-orange-900 dark:bg-orange-950/30 dark:hover:border-orange-700',
  } as const;
  const actions = [
    { label: 'Send SMS', description: 'Send a follow-up text message', icon: MessageCircle, color: 'emerald' as const, onClick: onSms },
    { label: 'Call Back Tomorrow', description: 'Schedule a callback for tomorrow', icon: PhoneOff, color: 'blue' as const, onClick: onCallbackTomorrow },
    { label: 'Assign Human Agent', description: 'Route to a team member', icon: Users, color: 'violet' as const, onClick: onAssignHuman },
    { label: 'Schedule Shoot Consultation', description: 'Book a consultation callback', icon: CalendarClock, color: 'orange' as const, onClick: onConsultation },
  ];

  return (
    <section className={`${panelClass} p-3`}>
      <h2 className="mb-3 text-lg font-semibold text-foreground">Follow-up Suggestions</h2>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              disabled={disabled}
              onClick={action.onClick}
              className={`rounded-lg border p-3 text-center transition disabled:cursor-not-allowed disabled:opacity-45 ${colorClasses[action.color]}`}
            >
              <Icon className="mx-auto mb-2 h-6 w-6 text-foreground" />
              <div className="text-sm font-semibold text-foreground">{action.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{action.description}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SmartDialerPanel({
  defaultFrom,
  onSms,
  onConfirm,
}: {
  defaultFrom: string;
  onSms: (target: string, body?: string) => void;
  onConfirm: (action: ConfirmAction | null) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [number, setNumber] = useState('');
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<SmsContact | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  const recentThreads = useQuery({ queryKey: ['sms-threads', 'dialer-recent'], queryFn: () => getSmsThreads({ per_page: 5 }) });
  const searchThreads = useQuery({
    queryKey: ['sms-threads', 'dialer-search', search],
    queryFn: () => getSmsThreads({ per_page: 6, search }),
    enabled: search.trim().length > 1,
  });

  const contacts = useMemo(
    () => uniqueContacts(search.trim().length > 1 ? searchThreads.data?.data : recentThreads.data?.data),
    [recentThreads.data?.data, search, searchThreads.data?.data]
  );

  const callMutation = useMutation({
    mutationFn: () =>
      placeVoiceCall({
        to: number.trim(),
        from: defaultFrom,
        dynamic_variables: {
          reason: 'Smart Dialer call',
          source: 'calls_overview_smart_dialer',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      queryClient.invalidateQueries({ queryKey: ['voice-stats'] });
      toast({ title: 'Call started', description: `Calling ${number}.` });
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      const description =
        axiosErr?.response?.data?.error
        || axiosErr?.response?.data?.message
        || axiosErr?.message
        || 'Please check Telnyx settings and try again.';
      toast({
        title: 'Unable to start call',
        description,
        variant: 'destructive',
      });
    },
  });

  const noteMutation = useMutation({
    mutationFn: () => updateSmsContactComment(selectedContact!.id, note),
    onSuccess: () => {
      toast({ title: 'Note saved', description: 'The contact note was updated.' });
      setNoteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['sms-threads'] });
    },
    onError: (error) => {
      toast({
        title: 'Unable to save note',
        description: error instanceof Error ? error.message : 'Select a contact and try again.',
        variant: 'destructive',
      });
    },
  });

  const chooseContact = (contact: SmsContact) => {
    const phone = contact.primaryNumber || contact.numbers?.[0]?.number || '';
    setSelectedContact(contact);
    setNumber(phone);
    setNote(contact.comment || '');
  };

  const appendKey = (key: string) => {
    setNumber((current) => (key === '+' && current.includes('+') ? current : `${current}${key}`));
  };

  const addPlus = () => {
    setNumber((current) => {
      if (current.startsWith('+')) return current;
      return `+${current.replace(/\+/g, '')}`;
    });
  };

  const deleteLastDigit = () => {
    setNumber((current) => current.slice(0, -1));
  };

  const canCall = number.trim().length > 0 && !callMutation.isPending;

  return (
    <aside className={`${dialerPanelClass} h-fit`}>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Dialer</h2>
        <Button
          type="button"
          variant="outline"
          disabled={!number}
          onClick={() => setNumber('')}
          className="h-8 w-[54px] px-0 text-xs"
        >
          Clear
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search contacts..."
          className="pl-9"
        />
      </div>

      {contacts.length > 0 && (
        <div className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-md border border-border bg-popover p-1">
          {contacts.map((contact) => (
            <button key={contact.id || contact.primaryNumber} type="button" onClick={() => chooseContact(contact)} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted">
              <span className="truncate">{contact.name || contact.primaryNumber}</span>
              <span className="ml-2 shrink-0 text-muted-foreground">{contact.primaryNumber || contact.numbers?.[0]?.number}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-[1fr_86px] gap-2">
        <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">Recent Contacts</div>
        <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">+1 (US)</div>
      </div>

      <div className="mt-3 relative min-w-0">
        <Input
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          placeholder="(214) 555-0198"
          className="h-10 truncate px-12 text-center text-lg text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label="Add plus"
          onClick={addPlus}
          className="absolute left-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-base font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Delete last digit"
          disabled={!number}
          onClick={deleteLastDigit}
          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
        >
          <Delete className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {keypad.map(([digit, letters]) => (
          <button
            key={digit}
            type="button"
            onClick={() => appendKey(digit)}
            className="h-10 rounded-lg border border-border bg-background text-center text-lg font-semibold text-foreground shadow-sm hover:border-primary/40 hover:bg-muted"
          >
            {digit}
            {letters && <span className="ml-1 align-middle text-[10px] font-normal text-muted-foreground">{letters}</span>}
          </button>
        ))}
      </div>

      <Button
        disabled={!canCall}
        onClick={() =>
          onConfirm({
            title: 'Start outbound call?',
            description: `Place a live Telnyx call from ${defaultFrom} to ${number}.`,
            confirmLabel: callMutation.isPending ? 'Calling...' : 'Start call',
            onConfirm: () => callMutation.mutate(),
          })
        }
        className="mt-3 h-10 w-full bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-500"
      >
        <Phone className="mr-2 h-5 w-5" /> Start Call
      </Button>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <Button type="button" variant="outline" disabled={!number.trim()} onClick={() => onSms(number.trim())} className="h-11">
          <MessageCircle className="mb-1 h-4 w-4" /> SMS
        </Button>
        <ScheduleVoiceCallDialog
          initialTargetPhone={number.trim()}
          initialFromPhone={defaultFrom}
          initialReason="manual_callback"
          trigger={
            <Button type="button" variant="outline" disabled={!number.trim()} className="h-11">
              <CalendarClock className="mb-1 h-4 w-4" /> Schedule
            </Button>
          }
        />
        <Button
          type="button"
          variant="outline"
          disabled={!selectedContact}
          onClick={() => setNoteOpen(true)}
          className="h-11"
        >
          <FileText className="mb-1 h-4 w-4" /> Add Note
        </Button>
      </div>

      <div className={`${subtlePanelClass} mt-3 p-3`}>
        <div className="mb-2 text-sm font-semibold text-foreground">Call Status</div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <Headphones className="h-6 w-6" />
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Ready to call</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> AI receptionist online</div>
          </div>
        </div>
        <div className="mt-2 flex h-6 items-center gap-1">
          {Array.from({ length: 28 }, (_, index) => (
            <span key={index} className="w-0.5 rounded bg-primary" style={{ height: `${6 + ((index * 7) % 18)}px` }} />
          ))}
        </div>
      </div>

      <div className={`${subtlePanelClass} mt-2.5 p-3`}>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><Bot className="h-4 w-4 text-primary" /> Robbie Suggests</div>
        <button type="button" className="flex w-full items-center justify-between rounded-md border border-border bg-background p-3 text-left text-sm text-muted-foreground hover:border-primary/40">
          Ask if this call is for a new listing shoot or an existing property.
          <ChevronRight className="ml-2 h-4 w-4 shrink-0" />
        </button>
      </div>

      <MakeTestCallDialog
        initialTo={number.trim()}
        initialFrom={defaultFrom}
        initialContext="Smart Dialer test call"
        trigger={
          <Button variant="outline" className="mt-3 hidden w-full">
            Make Test Call
          </Button>
        }
      />

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact Note</DialogTitle>
            <DialogDescription>Save an internal note for {selectedContact?.name || selectedContact?.primaryNumber}.</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button disabled={!selectedContact || noteMutation.isPending} onClick={() => noteMutation.mutate()}>
              {noteMutation.isPending ? 'Saving...' : 'Save note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

function SmsComposeDialog({
  state,
  sending,
  onOpenChange,
  onBodyChange,
  onSend,
}: {
  state: SmsDialogState;
  sending: boolean;
  onOpenChange: (open: boolean) => void;
  onBodyChange: (body: string) => void;
  onSend: () => void;
}) {
  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send SMS</DialogTitle>
          <DialogDescription>Send a follow-up text to {state.target}.</DialogDescription>
        </DialogHeader>
        <Textarea value={state.body} onChange={(event) => onBodyChange(event.target.value)} placeholder="Type your message..." className="min-h-28" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!state.target || !state.body.trim() || sending} onClick={onSend}>
            {sending ? 'Sending...' : 'Send SMS'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
