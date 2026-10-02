import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { TravelController } from './useTravelFeasibility';

function dateLabel(value: string, timezone?: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone || 'America/New_York', timeZoneName: 'short' }).format(date) : value;
}

export function TravelOverrideDialog({ travel }: { travel: TravelController }) {
  const { open, reason, setReason, cancel, complete } = travel.overrideDialog;
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const drag = useRef<{ start: number; width: number; pointerId: number } | null>(null);
  const updateProgress = (value: number) => { progressRef.current = value; setProgress(value); };
  const valid = reason.trim().length >= 5 && reason.trim().length <= 2000;
  useEffect(() => { progressRef.current = 0; setProgress(0); drag.current = null; }, [open, reason]);
  if (travel.requestedOnly || !travel.result?.can_override) return null;
  return <Dialog open={open} onOpenChange={value => { if (!value) cancel(); }}><DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto">
    <DialogHeader><DialogTitle>Review the travel warning</DialogTitle><DialogDescription>The photographer may not have enough time to travel between appointments. Confirm this exception only after reviewing the schedule.</DialogDescription></DialogHeader>
    <div className="space-y-3">
      {travel.proposedLocation && <p className="break-words text-sm"><span className="font-semibold">Proposed location: </span>{travel.proposedLocation}</p>}
      {travel.result.transitions.map(leg => <div key={leg.id} className="space-y-1 rounded-lg border p-3 text-sm">
        <p className="font-semibold">{leg.direction === 'incoming' ? 'Previous booking' : leg.direction === 'outgoing' ? 'Next booking' : 'Between proposed visits'}</p>
        {leg.neighbor?.can_view_details && leg.neighbor.photographer?.name && <p>Photographer: {leg.neighbor.photographer.name}</p>}
        {leg.neighbor?.can_view_details ? <><p>{leg.neighbor.services.map(service => service.name).join(', ') || 'Booked service'}</p><p>Start: {dateLabel(leg.neighbor.scheduled_at, leg.neighbor.timezone)}</p><p>End: {dateLabel(leg.neighbor.end_at, leg.neighbor.timezone)}</p></> : leg.direction === 'between_proposed' ? <p className="text-muted-foreground">Review the timing between the proposed visits.</p> : <p className="text-muted-foreground">Booking details are not available with your access.</p>}
        {leg.candidate_start && <p>Proposed start: {dateLabel(leg.candidate_start, travel.timezone)}</p>}
        {leg.candidate_end && <p>Proposed end: {dateLabel(leg.candidate_end, travel.timezone)}</p>}
        {leg.source === 'google_routes' && leg.drive_minutes != null ? <p>Approximate Google drive time {leg.direction === 'outgoing' ? 'to the next booking' : 'to the proposed location'}: {Math.ceil(leg.drive_minutes)} min.</p>
          : leg.source === 'same_building' ? <p>Same confirmed building; no travel between these units.</p>
            : leg.source === 'unknown' ? <p>Travel cannot be estimated reliably; staff review required.</p>
              : <p>Estimated travel based on distance; actual road travel may take longer. Google drive time is unavailable.</p>}
        <p>{leg.required_minutes == null ? 'Travel allowance is not yet known.' : `${leg.required_minutes} min needed · ${Math.max(0, leg.available_minutes)} min available`}{leg.shortfall_minutes != null && leg.shortfall_minutes > 0 ? ` · ${leg.shortfall_minutes} min short` : ''}</p>
        {leg.attribution && <p translate="no" className="whitespace-nowrap text-xs font-normal not-italic text-[#5E5E5E] dark:text-white">{leg.attribution}</p>}
      </div>)}
      <p className="font-semibold">Do you still want to book at this time?</p>
      <label className="block space-y-1 text-sm"><span>Travel exception reason</span><Textarea aria-label="Travel exception reason" value={reason} onChange={event => setReason(event.target.value)} required minLength={5} maxLength={2000} placeholder="Explain why this exception is appropriate" /></label>
      <p className="text-xs text-muted-foreground">Enter at least 5 characters. Confirming records your decision and saves the schedule.</p>
      <div className={`relative h-14 rounded-full border bg-muted ${valid ? '' : 'opacity-50'}`}>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 pr-3 text-xs font-medium">{progress === 100 ? 'Release or press Enter to confirm' : 'Swipe to confirm and save'}</span>
        <button type="button" role="slider" aria-label="Swipe to confirm travel exception" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${progress}%${progress === 100 ? ', press Enter to confirm' : ''}`} aria-describedby="travel-swipe-instructions" disabled={!valid}
          className="absolute top-1 flex h-12 w-12 touch-none items-center justify-center rounded-full bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          style={{ left: `calc(${progress}% - ${progress * 0.48}px)` }}
          onPointerDown={event => { if (!valid || drag.current) return; const width = event.currentTarget.parentElement!.getBoundingClientRect().width - 48; drag.current = { start: event.clientX, width, pointerId: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); updateProgress(0); }}
          onPointerMove={event => { if (drag.current?.pointerId === event.pointerId) updateProgress(Math.max(0, Math.min(100, Math.round((event.clientX - drag.current.start) / Math.max(1, drag.current.width) * 100)))); }}
          onPointerUp={event => { if (drag.current?.pointerId !== event.pointerId) return; drag.current = null; if (progressRef.current >= 95) complete(); else updateProgress(0); }}
          onPointerCancel={event => { if (drag.current?.pointerId === event.pointerId) { drag.current = null; updateProgress(0); } }}
          onLostPointerCapture={() => { drag.current = null; updateProgress(0); }}
          onKeyDown={event => { if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End', 'Enter', ' '].includes(event.key)) event.preventDefault();
            if (event.key === 'Enter' || event.key === ' ') { if (progress === 100 && !event.repeat) complete(); }
            else if (event.key === 'End') updateProgress(100); else if (event.key === 'Home') updateProgress(0);
            else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') updateProgress(Math.min(100, progressRef.current + 10));
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') updateProgress(Math.max(0, progressRef.current - 10));
          }}><ArrowRight aria-hidden="true" className="h-5 w-5" /></button>
      </div>
      <p id="travel-swipe-instructions" className="text-xs text-muted-foreground">Drag the arrow all the way right. With a keyboard, use the arrow keys or End, then press Enter to confirm.</p>
      <Button type="button" variant="outline" className="w-full" onClick={cancel}>Go back without saving</Button>
    </div>
  </DialogContent></Dialog>;
}
