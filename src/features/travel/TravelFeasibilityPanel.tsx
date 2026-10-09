import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TravelOverrideDialog } from './TravelOverrideDialog';
import { DayScheduleDialog } from './DayScheduleDialog';
import { TravelNotifications } from './TravelNotifications';
import { TravelRouteSummary } from './TravelRouteSummary';
import { sameDayTransitions } from './daySchedule';
import type { TravelController } from './useTravelFeasibility';
import type { TravelDurationAdjuster } from './TravelDurationAdjustment';

export function TravelFeasibilityPanel({ travel, durationAdjuster, issuesOnly = false }: { travel: TravelController; durationAdjuster?: TravelDurationAdjuster; issuesOnly?: boolean }) {
  const [adjusting, setAdjusting] = useState(false);
  if (!travel.visible) return null;
  const result = travel.result, timezone = travel.timezone || result?.visits?.[0]?.timezone || 'America/New_York';
  const issue = result && !result.available;
  const hasError = !travel.loading && Boolean(issue || travel.error);
  const overlap = result?.reason_codes?.some(reason => /overlap/.test(reason));
  const unknownLocation = result?.transitions?.some(leg => leg.source === 'unknown') || result?.reason_codes?.some(code => /location|building|geocod|address/.test(code));
  const canAdjust = Boolean(travel.onScheduleChange && result?.enabled && result.visits?.length);
  return <>{(!issuesOnly || hasError) && <section aria-label="Travel feasibility" className={`min-w-0 space-y-3 rounded-xl border p-3 text-sm ${hasError ? 'border-red-500 dark:border-red-400 bg-red-500/5' : 'bg-muted/30'}`}>
    <div role={hasError ? 'alert' : 'status'} aria-live="polite"><p className={`font-semibold ${hasError ? 'text-red-600 dark:text-red-400' : ''}`}>{travel.loading ? 'Checking travel · time is provisional' : travel.error ? 'Travel check unavailable' : result?.available ? 'Travel time checked' : overlap ? 'Already booked at this time' : 'Review travel time'}</p>
      {travel.error && <p className="mt-1 text-muted-foreground">{travel.error}</p>}
      {overlap && <p className="mt-1 text-muted-foreground">See the booking on this date and move either shoot to a free time.</p>}
      {result?.reason_codes?.some(reason => /working_hours|outside_hours/.test(reason)) && <p className="mt-1 text-muted-foreground">The appointment is outside the photographer’s working hours.</p>}
      {issue && travel.requestedOnly && <p className="mt-1 text-muted-foreground">You can submit your request. Our team will review the schedule before confirming it.</p>}
    </div>
    {!travel.loading && sameDayTransitions(result?.transitions ?? [], timezone).map(leg => <TravelRouteSummary key={leg.id} leg={leg} />)}
    {(result?.can_confirm_location || result?.can_override) && (unknownLocation || travel.locationConfirmed) && <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={travel.locationConfirmed} onChange={event => travel.setLocationConfirmed(event.target.checked)} /><span>I confirm this is the correct building address, including the street number. Units at this building share its location.</span></label>}
    <div className="flex flex-wrap gap-2">
      {canAdjust && <Button type="button" variant="outline" size="sm" disabled={travel.loading} onClick={() => setAdjusting(true)}>Adjust this day</Button>}
      {travel.error && <Button type="button" variant="outline" size="sm" onClick={() => void travel.retry()}>Retry travel check</Button>}
    </div>
    {issue && travel.canOverride && <p className="text-xs text-muted-foreground">You can confirm a shorter travel gap with an explicit acknowledgement when saving.</p>}
    {travel.notificationsSupported && !travel.requestedOnly && <TravelNotifications value={travel.notifications} onChange={travel.setNotifications} />}
    {travel.scheduleAdjustments?.length > 0 && <p className="text-xs text-violet-600 dark:text-violet-300">{travel.scheduleAdjustments.length} existing booking(s) will move with this shoot when you save.</p>}
    {result?.budget && result.budget.alert_level > 0 && <p role="status" className="rounded-lg border border-amber-500/40 p-2 text-xs">Route lookup budget: {result.budget.alert_level}% threshold reached ({result.budget.used_elements.toLocaleString()} of {result.budget.limit_elements.toLocaleString()} elements).{result.budget.alert_level === 100 ? ' Google route lookups are paused until usage drops below the limit.' : ''}</p>}
    {result?.enabled && !travel.loading && <p className="text-xs text-muted-foreground">Availability is checked again when you save.</p>}
  </section>}{adjusting && <DayScheduleDialog travel={travel} open onClose={() => setAdjusting(false)} />}<TravelOverrideDialog travel={travel} durationAdjuster={durationAdjuster} /></>;
}
