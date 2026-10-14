import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { updateVoiceNumber, uploadVoiceGreeting } from '@/services/voice';
import type { VoiceLinePolicy, VoiceNumberConfig } from '@/types/voice';
import PrivateVoiceAudio from './PrivateVoiceAudio';

const officeWeek = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => [day, ['sat', 'sun'].includes(day) ? [] : [{ start: '09:00', end: '18:00' }]]));
const checkNames: Record<string, string> = {
  recipients: 'Recipients', calling_permission: 'Calling permission', device_registration: 'Registered device',
  schedule: 'Schedule', greetings: 'Both greetings', webhook_configured: 'Webhook configuration', voice_application_configured: 'Voice application configuration',
};

export default function VoiceLinePolicyEditor({ number, staff, canManage }: { number: VoiceNumberConfig; staff: Array<{ id: number; name: string; role: string }>; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const existing = number.line_policy;
  const [expanded, setExpanded] = useState(false);
  const [policy, setPolicy] = useState<VoiceLinePolicy>(() => ({
    mode: existing?.mode ?? (number.phone_number.replace(/\D/g, '') === '18888041663' ? 'sms_only' : 'staff_voicemail'),
    recipient_role: existing?.recipient_role ?? null, recipient_roles: existing?.recipient_roles ?? (existing?.recipient_role ? [existing.recipient_role] : []), recipient_ids: existing?.recipient_ids ?? [],
    timezone: existing?.timezone ?? 'America/New_York', weekly_hours: existing?.weekly_hours ?? officeWeek,
  }));
  const saved = () => { void queryClient.invalidateQueries({ queryKey: ['voice-numbers'] }); };
  const update = useMutation({ mutationFn: () => updateVoiceNumber(number.id, { line_policy: policy }), onSuccess: () => { saved(); toast({ title: 'Line routing saved' }); }, onError: (e) => toast({ title: 'Could not save routing', description: e instanceof Error ? e.message : undefined, variant: 'destructive' }) });
  const upload = useMutation({ mutationFn: ({ kind, file }: { kind: 'office' | 'closed'; file: File }) => uploadVoiceGreeting(number.id, kind, file), onSuccess: saved, onError: () => toast({ title: 'Could not upload greeting', description: 'Use a complete MP3 file, 1–90 seconds and under 700 KB.', variant: 'destructive' }) });
  const disabled = !canManage || update.isPending || upload.isPending;
  return <div className="space-y-3 border-t pt-3 md:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm">{existing?.mode === 'sms_only' ? 'SMS-only · no voice ring group' : existing?.mode === 'robbie' ? 'Robbie · 24/7 · no staff ring group' : existing ? `Dashboard only · 45-second ring · ${existing.timezone} · ${existing.open_now ? 'Open now' : 'Closed now'}` : 'Line routing not configured'}</p>
      {canManage && <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>{expanded ? 'Close settings' : 'Configure routing'}</Button>}
    </div>
    {existing?.mode === 'staff_voicemail' && <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Line readiness">
        {Object.entries(checkNames).map(([key, label]) => <span key={key} className={existing.readiness?.[key] ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>{existing.readiness?.[key] ? '✓' : 'Needs attention:'} {label}</span>)}
      </div>
      <p className="text-xs text-muted-foreground">Provider number assignment and live audio testing still require verification. Last processed webhook: {typeof existing.readiness?.last_webhook_at === 'string' ? new Date(existing.readiness.last_webhook_at).toLocaleString() : 'None received'}.</p>
      <div className="text-sm">{existing.staff?.map(person => <p key={person.id}>{person.name} · {person.calling_permission ? 'Calling allowed' : 'Calling permission missing'} · {person.registered ? 'Device registered' : 'Connect Dashboard phone'}</p>)}</div>
    </>}
    {expanded && <fieldset disabled={disabled} className="space-y-4">
      <label className="block text-sm">Routing
        <select className="mt-1 block h-10 w-full rounded-md border bg-background px-3" value={policy.mode} onChange={e => setPolicy({ ...policy, mode: e.target.value as VoiceLinePolicy['mode'] })}>
          <option value="staff_voicemail">Dashboard staff, then voicemail</option><option value="robbie">Robbie, 24/7</option><option value="sms_only">SMS only</option>
        </select>
      </label>
      {policy.mode === 'staff_voicemail' && <>
        <label className="block text-sm">Timezone (daylight saving adjusts automatically)
          <select className="mt-1 block h-10 w-full rounded-md border bg-background px-3" value={policy.timezone} onChange={e => setPolicy({ ...policy, timezone: e.target.value })}>
            {Array.from(new Set(['Asia/Kolkata', 'America/New_York', 'Europe/London', 'UTC', policy.timezone])).map(zone => <option key={zone}>{zone}</option>)}
          </select>
        </label>
        <div className="space-y-2"><p className="text-sm">Ring all active members of these roles</p>{(['editing_manager', 'superadmin'] as const).map(role => <label key={role} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.recipient_roles?.includes(role) ?? false} onChange={e => { const roles = e.target.checked ? [...(policy.recipient_roles ?? []), role] : (policy.recipient_roles ?? []).filter(item => item !== role); setPolicy({ ...policy, recipient_roles: roles, recipient_role: roles[0] ?? null }); }} />{role === 'editing_manager' ? 'Editing managers' : 'Superadmins'}</label>)}</div>
        <div className="space-y-2"><p className="text-sm">Additional recipients</p>{staff.map(person => <label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.recipient_ids.includes(person.id)} onChange={e => setPolicy({ ...policy, recipient_ids: e.target.checked ? [...policy.recipient_ids, person.id] : policy.recipient_ids.filter(id => id !== person.id) })} />{person.name}</label>)}</div>
        <div className="space-y-2"><p className="text-sm font-medium">Weekly opening hours</p>{['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => {
          const slots = policy.weekly_hours[day] ?? [];
          const change = (windows: Array<{ start: string; end: string }>) => setPolicy({ ...policy, weekly_hours: { ...policy.weekly_hours, [day]: windows } });
          return <div key={day} className="flex flex-wrap items-center gap-2"><label className="flex w-20 items-center gap-2 text-sm"><input type="checkbox" checked={slots.length > 0} onChange={e => change(e.target.checked ? [{ start: '09:00', end: '18:00' }] : [])} />{day.toUpperCase()}</label>{slots.length === 0 ? <span className="text-sm text-muted-foreground">Closed · voicemail</span> : slots.map((slot, index) => <div key={index} className="flex items-center gap-2"><Input aria-label={`${day} start ${index + 1}`} className="w-32" type="time" value={slot.start} onChange={e => change(slots.map((s, i) => i === index ? { ...s, start: e.target.value } : s))} /><span>–</span><Input aria-label={`${day} end ${index + 1}`} className="w-32" type="time" value={slot.end} onChange={e => change(slots.map((s, i) => i === index ? { ...s, end: e.target.value } : s))} /></div>)}</div>;
        })}</div>
      </>}
      {policy.mode === 'robbie' && <p className="text-sm text-muted-foreground">Robbie answers around the clock. Staff devices do not ring. If Robbie cannot start, the caller reaches voicemail for superadmin follow-up.</p>}
      <Button onClick={() => update.mutate()} disabled={disabled}>{update.isPending ? 'Saving…' : 'Save routing'}</Button>
      {existing?.mode === 'staff_voicemail' && <div className="grid gap-4 sm:grid-cols-2">{(['office', 'closed'] as const).map(kind => <div key={kind} className="space-y-2"><label className="block text-sm font-medium">{kind === 'office' ? 'Unanswered during office hours' : 'After office hours'}<Input className="mt-2" type="file" accept="audio/mpeg,.mp3,.mpeg" onChange={e => { const file = e.target.files?.[0]; if (file) upload.mutate({ kind, file }); e.target.value = ''; }} /></label>{existing.greetings?.[`${kind}_greeting`] && <PrivateVoiceAudio path={`/voice/numbers/${number.id}/greeting/${kind}`} label="Preview greeting" />}</div>)}</div>}
    </fieldset>}
  </div>;
}
