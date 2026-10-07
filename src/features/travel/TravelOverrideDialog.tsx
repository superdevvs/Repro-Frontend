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
  const [durationPending, setDurationPending] = useState(false);
  useEffect(() => { setDurationPending(false); }, [open]);
  const valid = !durationPending && reason.trim().length >= 5 && reason.trim().length <= 2000;
  if (travel.requestedOnly || !travel.result?.can_override) return null;
  const short = travel.result.transitions.filter(leg => leg.shortfall_minutes != null && leg.shortfall_minutes > 0);
  const gap = short.length ? Math.min(...short.map(leg => Math.max(0, leg.available_minutes))) : null;
  return <Dialog open={open} onOpenChange={value => { if (!value) cancel(); }}><DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-4xl gap-0 overflow-y-auto rounded-2xl p-0 shadow-2xl">
    <div className="space-y-4 p-4 sm:p-5"><DialogHeader className="flex-row items-start gap-3 space-y-0 pr-5 text-left"><TriangleAlert aria-hidden="true" className="h-6 w-6 shrink-0 text-amber-500" /><div><DialogTitle>Confirm travel exception</DialogTitle><DialogDescription>Review this date’s schedule. Your acknowledgement is saved with the booking.</DialogDescription></div></DialogHeader>
      <TravelOverrideSchedule travel={travel} />
      {open && travel.canOverride && durationAdjuster?.items.length ? <TravelDurationAdjustment key={JSON.stringify(durationAdjuster.items)} adjuster={durationAdjuster} cancelSave={cancel} onPendingChange={setDurationPending} /> : null}
    </div>
    <div className="space-y-3 border-t bg-muted/30 p-4 sm:px-5">
      <label className="block space-y-1 text-xs font-medium"><span>Travel exception reason</span><Textarea rows={2} className="min-h-[64px] bg-background text-sm" aria-label="Travel exception reason" value={reason} onChange={event => setReason(event.target.value)} required minLength={5} maxLength={2000} placeholder="Why is this exception appropriate?" /></label>
      {travel.notificationsSupported && <TravelNotifications value={travel.notifications} onChange={travel.setNotifications} />}
      <p className="text-xs text-muted-foreground">Calendar updates follow a successful save. Bookings cannot overlap or fall outside working hours.</p>
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={cancel}>Go back without saving</Button><Button type="button" disabled={!valid} onClick={complete}>{gap == null ? 'Confirm travel exception and save' : `Confirm with ${gap}-min travel gap`}</Button></div>
    </div>
  </DialogContent></Dialog>;
}
