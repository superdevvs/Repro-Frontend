import { useEffect, useRef, useState } from 'react';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { TravelController } from './useTravelFeasibility';
import { TravelOverrideSchedule } from './TravelOverrideSchedule';
import { TravelDurationAdjustment, type TravelDurationAdjuster } from './TravelDurationAdjustment';

export function TravelOverrideDialog({ travel, durationAdjuster }: { travel: TravelController; durationAdjuster?: TravelDurationAdjuster }) {
  const { open, reason, setReason, cancel, complete } = travel.overrideDialog;
  const [progress, setProgress] = useState(0);
  const [durationPending, setDurationPending] = useState(false);
  const progressRef = useRef(0);
  const drag = useRef<{ start: number; width: number; pointerId: number } | null>(null);
  const updateProgress = (value: number) => { progressRef.current = value; setProgress(value); };
  const valid = !durationPending && reason.trim().length >= 5 && reason.trim().length <= 2000;
  useEffect(() => { setDurationPending(false); }, [open]);
  useEffect(() => { progressRef.current = 0; setProgress(0); drag.current = null; }, [open, reason, durationPending]);
  if (travel.requestedOnly || !travel.result?.can_override) return null;
  return <Dialog open={open} onOpenChange={value => { if (!value) cancel(); }}><DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-4xl gap-0 overflow-y-auto rounded-2xl p-0 shadow-2xl">
    <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
      <DialogHeader className="flex-row items-start gap-3 space-y-0 pr-5 text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"><TriangleAlert aria-hidden="true" className="h-5 w-5" /></span><div className="space-y-1.5"><DialogTitle className="text-lg leading-tight sm:text-xl">Review the travel warning</DialogTitle><DialogDescription className="text-xs sm:text-sm">Check the photographer’s travel time before confirming this exception.</DialogDescription></div></DialogHeader>
      <TravelOverrideSchedule travel={travel} />
      {open && travel.canOverride && durationAdjuster?.items.length ? <TravelDurationAdjustment key={JSON.stringify(durationAdjuster.items)}
        adjuster={durationAdjuster} cancelSave={cancel} onPendingChange={setDurationPending} /> : null}
    </div>
    <div className="space-y-3 border-t bg-muted/30 p-4 sm:px-6 sm:py-4">
      <p className="text-sm font-semibold sm:text-base">Do you still want to book at this time?</p>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-start">
        <div className="space-y-1.5"><label className="block space-y-1.5 text-xs font-medium"><span>Travel exception reason</span><Textarea className="min-h-[72px] bg-background text-sm" rows={2} aria-label="Travel exception reason" value={reason} onChange={event => setReason(event.target.value)} required minLength={5} maxLength={2000} placeholder="Why is this exception appropriate?" /></label><p className="text-[11px] text-muted-foreground">At least 5 characters. Your reason is saved with this decision.</p></div>
        <div className="space-y-2 md:pt-6"><div className={`relative h-14 rounded-full border bg-background ${valid ? 'border-primary/25 shadow-sm' : 'opacity-50'}`}>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 pr-3 text-xs font-medium">{progress === 100 ? 'Release or press Enter to confirm' : 'Swipe to confirm and save'}</span>
        <button type="button" role="slider" aria-label="Swipe to confirm travel exception" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${progress}%${progress === 100 ? ', press Enter to confirm' : ''}`} aria-describedby="travel-swipe-instructions" disabled={!valid}
          className="absolute top-1 flex h-12 w-12 touch-none items-center justify-center rounded-full bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          style={{ left: `calc(${progress}% - ${progress * 0.48}px)` }}
          onPointerDown={event => { if (!valid || drag.current) return; const width = event.currentTarget.parentElement!.getBoundingClientRect().width - 48; drag.current = { start: event.clientX, width, pointerId: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); updateProgress(0); }}
          onPointerMove={event => { if (drag.current?.pointerId === event.pointerId) updateProgress(Math.max(0, Math.min(100, Math.round((event.clientX - drag.current.start) / Math.max(1, drag.current.width) * 100)))); }}
          onPointerUp={event => { if (drag.current?.pointerId !== event.pointerId) return; drag.current = null; if (valid && progressRef.current >= 95) complete(); else updateProgress(0); }}
          onPointerCancel={event => { if (drag.current?.pointerId === event.pointerId) { drag.current = null; updateProgress(0); } }}
          onLostPointerCapture={() => { drag.current = null; updateProgress(0); }}
          onKeyDown={event => { if (!valid) return; if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End', 'Enter', ' '].includes(event.key)) event.preventDefault();
            if (event.key === 'Enter' || event.key === ' ') { if (progress === 100 && !event.repeat) complete(); }
            else if (event.key === 'End') updateProgress(100); else if (event.key === 'Home') updateProgress(0);
            else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') updateProgress(Math.min(100, progressRef.current + 10));
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') updateProgress(Math.max(0, progressRef.current - 10));
          }}><ArrowRight aria-hidden="true" className="h-5 w-5" /></button>
        </div><p id="travel-swipe-instructions" className="text-[11px] leading-relaxed text-muted-foreground">Drag right and release to save. Keyboard: arrows or End, then Enter.</p></div>
      </div>
      <Button type="button" variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-xs text-muted-foreground" onClick={cancel}>Go back without saving</Button>
    </div>
  </DialogContent></Dialog>;
}
