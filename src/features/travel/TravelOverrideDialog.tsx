import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { TravelController } from './useTravelFeasibility';
import { TravelOverrideSchedule } from './TravelOverrideSchedule';
import { TravelNotifications } from './TravelNotifications';
import { TravelDurationAdjustment, type TravelDurationAdjuster } from './TravelDurationAdjustment';

export function TravelOverrideDialog({ travel, durationAdjuster }: { travel: TravelController; durationAdjuster?: TravelDurationAdjuster }) {
  const { open, reason, setReason, cancel, complete } = travel.overrideDialog;
  const hours = travel.canOverrideWorkingHours;
  const editing = Boolean(travel.payload?.shoot_id);
  const approving = travel.payload?.action_mode === 'approve';
  const [durationPending, setDurationPending] = useState(false);
  useEffect(() => { setDurationPending(false); }, [open]);
  const valid = !durationPending && reason.trim().length >= 5 && reason.trim().length <= (hours ? 500 : 2000);
  if (travel.requestedOnly || (!hours && !travel.result?.can_override)) return null;
  const short = (travel.result?.transitions ?? []).filter(leg => leg.shortfall_minutes != null && leg.shortfall_minutes > 0);
  const gap = short.length ? Math.min(...short.map(leg => Math.max(0, leg.available_minutes))) : null;
  return <Dialog open={open} onOpenChange={value => { if (!value) cancel(); }}><DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-4xl gap-0 overflow-y-auto rounded-2xl p-0 shadow-2xl">
    <div className="space-y-4 p-4 sm:p-5"><DialogHeader className="flex-row items-start gap-3 space-y-0 pr-5 text-left"><TriangleAlert aria-hidden="true" className="h-6 w-6 shrink-0 text-amber-500" /><div><DialogTitle>{hours ? (approving ? 'Approve outside working hours' : editing ? 'Save outside working hours' : 'Book outside working hours') : 'Confirm travel exception'}</DialogTitle><DialogDescription>{hours ? 'This appointment falls outside the photographer’s available hours. Review the appointment and any travel warnings, then enter a reason to approve this one booking.' : 'Review this date’s schedule. Your acknowledgement is saved with the booking.'}</DialogDescription></div></DialogHeader>
      <TravelOverrideSchedule travel={travel} />
      {travel.result?.radius_checks?.filter(check => !check.eligible).map((check, index) => <p key={index} className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{check.distance_miles != null && check.radius_miles != null ? `${check.distance_miles} mi from ${check.origin === 'previous_shoot' ? 'the previous shoot' : 'home'}; profile travel radius ${check.radius_miles} mi.` : 'Location or travel radius is unverified.'} Your confirmation applies to this booking only. Photographer category capability cannot be overridden.</p>)}
      {hours && <section aria-label="Appointment outside working hours" className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
        <p className="font-semibold">Appointments to approve</p>
        {travel.result?.visits?.filter(visit => visit.is_target !== false).map((visit, index) => {
          const format = (instant: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: visit.timezone }).format(new Date(instant));
          return <p key={index}>{format(visit.start)} – {format(visit.end)} · {visit.duration_minutes} min</p>;
        })}
      </section>}
      {open && travel.canOverride && durationAdjuster?.items.length ? <TravelDurationAdjustment key={JSON.stringify(durationAdjuster.items)} adjuster={durationAdjuster} cancelSave={cancel} onPendingChange={setDurationPending} /> : null}
    </div>
    <div className="space-y-3 border-t bg-muted/30 p-4 sm:px-5">
      <label className="block space-y-1 text-xs font-medium"><span>{hours ? 'Working-hours exception reason' : 'Travel exception reason'}</span><Textarea rows={2} className="min-h-[64px] bg-background text-sm" aria-label={hours ? 'Working-hours exception reason' : 'Travel exception reason'} value={reason} onChange={event => setReason(event.target.value)} required minLength={5} maxLength={hours ? 500 : 2000} placeholder="Why is this exception appropriate?" /></label>
      {travel.notificationsSupported && <TravelNotifications value={travel.notifications} onChange={travel.setNotifications} />}
      <p className="text-xs text-muted-foreground">{hours ? 'Your reason and scheduling warnings are recorded with this booking. Regular availability stays unchanged. Overlapping bookings remain blocked.' : 'Calendar updates follow a successful save. Bookings cannot overlap or fall outside working hours.'}</p>
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={cancel}>Go back without saving</Button><Button type="button" disabled={!valid} onClick={complete}>{hours ? (approving ? 'Confirm and approve outside hours' : editing ? 'Confirm and save outside hours' : 'Confirm and book outside hours') : gap == null ? (approving ? 'Confirm travel exception and approve' : 'Confirm travel exception and save') : `Confirm with ${gap}-min travel gap`}</Button></div>
    </div>
  </DialogContent></Dialog>;
}
