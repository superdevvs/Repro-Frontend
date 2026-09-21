import type { VoiceCall, VoiceCallNote, VoiceRelatedShoot, VoiceWrapUp } from '@/types/voice';

export const LIVE_STATUSES = ['dialing', 'ringing', 'answered', 'in_progress', 'active', 'ai_active', 'tool_running', 'human_handoff'];

export const formatDuration = (seconds?: number | null) => {
  const total = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

export const formatClock = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const formatRelative = (value?: string | null) => {
  if (!value) return 'recently';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff)) return 'recently';
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

export const formatWhen = (value?: string | null) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not scheduled';
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const getCallPhone = (call?: VoiceCall | null) => {
  const direction = call?.direction?.toUpperCase();
  // The other leg is our business line, not a safe fallback recipient.
  if (direction === 'OUTBOUND') return (call?.to_phone || '').trim();
  if (direction === 'INBOUND') return (call?.from_phone || '').trim();
  return (call?.from_phone || call?.to_phone || '').trim();
};

export const callDirectionLabel = (call?: VoiceCall | null) => {
  if (call?.direction?.toUpperCase() === 'OUTBOUND') return 'Outbound';
  if (call?.direction?.toUpperCase() !== 'INBOUND') return 'Call';
  return call.ended_at && !call.answered_at ? 'Missed incoming' : 'Incoming';
};

export const callerName = (call?: VoiceCall | null) =>
  call?.caller_user?.name ||
  call?.callerUser?.name ||
  call?.caller_contact?.name ||
  call?.callerContact?.name ||
  getCallPhone(call) ||
  'Unknown caller';

export const callerInitials = (call?: VoiceCall | null) => {
  const name = callerName(call);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0 || /^\+?\d/.test(name)) return '•';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
};

export const relatedShoot = (call?: VoiceCall | null): VoiceRelatedShoot | null =>
  call?.related_shoot ?? call?.relatedShoot ?? null;

export const wrapUpOf = (call?: VoiceCall | null): VoiceWrapUp | null => {
  const metadata = (call?.metadata ?? {}) as Record<string, unknown>;
  return (metadata.wrap_up as VoiceWrapUp | undefined) ?? null;
};

export const notesOf = (call?: VoiceCall | null): VoiceCallNote[] => {
  const metadata = (call?.metadata ?? {}) as Record<string, unknown>;
  return Array.isArray(metadata.notes) ? (metadata.notes as VoiceCallNote[]) : [];
};

export const intelOf = (call?: VoiceCall | null) => {
  const metadata = (call?.metadata ?? {}) as Record<string, unknown>;
  const intel = metadata.intel_final ?? metadata.intel_live;
  return intel && typeof intel === 'object' ? (intel as Record<string, unknown>) : null;
};

export const isLiveCall = (call?: VoiceCall | null) =>
  !call?.ended_at && LIVE_STATUSES.includes(String(call?.status || '').toLowerCase());

export const needsReview = (call?: VoiceCall | null) => {
  if (!call) return false;
  if (wrapUpOf(call)?.saved_at) return Boolean(call.needs_follow_up);
  return Boolean(
    call.needs_follow_up ||
      call.disposition === 'handoff_to_staff' ||
      call.disposition === 'callback_needed' ||
      call.callback_status === 'scheduled'
  );
};

export const isVoicemail = (call?: VoiceCall | null) => {
  const metadata = (call?.metadata ?? {}) as Record<string, unknown>;
  return call?.disposition === 'voicemail' || call?.intent === 'voicemail' || metadata.voicemail === true;
};

export type InboxFilter = 'needs_attention' | 'all' | 'voicemail';

export const inboxFilterFor = (filter: InboxFilter) => (filter === 'all' ? undefined : filter);

export const callReason = (call?: VoiceCall | null) => {
  if (!call) return 'Conversation';
  if (isVoicemail(call)) return 'Voicemail';
  if (call.intent) return call.intent.replace(/_/g, ' ');
  if (relatedShoot(call)?.address) return relatedShoot(call)!.address as string;
  return call.direction === 'OUTBOUND' ? 'Outbound call' : 'Incoming call';
};

export const callOwnerLabel = (call?: VoiceCall | null) => {
  if (!call) return 'Unassigned';
  if (call.handled_by === 'ai') return 'Robbie';
  if (call.handled_by === 'human') return 'Team';
  if (call.handled_by === 'mixed') return 'Robbie + team';
  return 'Unassigned';
};

export const recapHeadline = (call?: VoiceCall | null) => {
  const wrap = wrapUpOf(call);
  if (wrap?.recap_title) return wrap.recap_title;
  const intel = intelOf(call);
  if (intel?.summary_text) return String(intel.summary_text).split('.')[0] + '.';
  if (call?.summary) return call.summary.split('.')[0] + (call.summary.includes('.') ? '.' : '');
  return 'A conversation worth a careful next step.';
};

export const recapBody = (call?: VoiceCall | null) => {
  const wrap = wrapUpOf(call);
  if (wrap?.recap_body) return wrap.recap_body;
  return call?.summary || call?.live_transcript_preview || call?.transcript || 'No recap has been captured yet.';
};

export const recapOutcome = (call?: VoiceCall | null) =>
  wrapUpOf(call)?.outcome || (needsReview(call) ? 'Follow-up required' : 'Resolved');

export const suggestedSms = (call?: VoiceCall | null) => {
  const wrap = wrapUpOf(call);
  if (wrap?.sms?.body) return wrap.sms.body;
  const name = callerName(call).split(' ')[0] || 'there';
  const shoot = relatedShoot(call)?.address;
  const issue = recapBody(call);
  const first = issue.split('.')[0];
  return `Hi ${name} — I’ll follow up on ${shoot ? `${shoot}. ` : ''}${first}.`.slice(0, 320);
};

export const suggestedTaskTitle = (call?: VoiceCall | null) =>
  wrapUpOf(call)?.task?.title ||
  (relatedShoot(call)?.address ? `Follow up on ${relatedShoot(call)?.address}` : `Follow up with ${callerName(call)}`);

export type RecordingMoment = { at: string; seconds: number; label: string };

export const recordingMoments = (call?: VoiceCall | null): RecordingMoment[] => {
  const stored = call?.metadata?.recording_moments;
  if (!Array.isArray(stored)) return [];
  // Only explicit recording-relative offsets are safe to seek to. A summary
  // or a transcript's wall-clock timestamp cannot establish that offset.
  return stored.flatMap((value): RecordingMoment[] => {
    if (!value || typeof value !== 'object') return [];
    const { seconds, label } = value as Record<string, unknown>;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || typeof label !== 'string' || !label.trim()) return [];
    if (call?.duration_seconds != null && seconds > call.duration_seconds) return [];
    return [{ seconds, at: formatDuration(Math.floor(seconds)), label }];
  });
};

export const smsSegmentCount = (body: string) => {
  const basic = new Set('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà');
  const extended = new Set('^{}\\[~]|€\f');
  let units = 0;
  for (const character of body) {
    if (basic.has(character)) units += 1;
    else if (extended.has(character)) units += 2;
    else return body.length <= 70 ? 1 : Math.ceil(body.length / 67);
  }
  return units <= 160 ? 1 : Math.ceil(units / 153);
};

export const toolLabel = (tool: string) => {
  const words = tool.replace(/_/g, ' ').trim();
  if (words === '') return tool;
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const availabilityLabel = (
  liveCount: number,
  canPlace: boolean | undefined,
  outboundMode?: string | null,
) => {
  if (outboundMode === 'none') return 'Outbound off';
  if (canPlace === false) return 'Outbound not ready';
  if (liveCount > 0) return `${liveCount} live`;
  return canPlace ? 'Ready to call' : 'Checking…';
};

export const inboxDetail = (call?: VoiceCall | null) => {
  const shoot = relatedShoot(call)?.address;
  const reason = callReason(call);
  if (shoot && reason && shoot !== reason) return `${shoot} · ${reason}`;
  return shoot || reason || 'Conversation';
};

export const inboxStatusLine = (call?: VoiceCall | null) => {
  if (!call) return '';
  if (isLiveCall(call)) return `Live · ${formatDuration(call.duration_seconds)}`;
  if (isVoicemail(call)) return `Voicemail · ${callOwnerLabel(call)}`;
  if (needsReview(call)) {
    const due = call.preferred_callback_at || call.scheduled_callback?.next_attempt_at || call.scheduledCallback?.next_attempt_at;
    return due ? `Callback due ${formatWhen(due)}` : 'Needs attention';
  }
  const outcome = (call.disposition || call.status || 'completed').replace(/_/g, ' ');
  return `${outcome} · ${callOwnerLabel(call)}`;
};

export const briefingText = (call?: VoiceCall | null) => {
  const intel = intelOf(call);
  if (intel?.summary_text) return String(intel.summary_text);
  return recapBody(call);
};

export const nextStepText = (call?: VoiceCall | null) => {
  const intel = intelOf(call);
  if (intel?.next_best_action) return String(intel.next_best_action);
  if (needsReview(call)) return 'Follow up with the caller.';
  return null;
};

export const toLocalInput = (value?: string | Date | null) => {
  const date = value ? new Date(value) : new Date(Date.now() + 4 * 60 * 60 * 1000);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatDelta = (value: number | null | undefined, unit = '') => {
  if (value == null) return null;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${unit}`;
};

export const waveBars = (count = 28) =>
  Array.from({ length: count }, (_, index) => 10 + ((index * 17) % 26));
