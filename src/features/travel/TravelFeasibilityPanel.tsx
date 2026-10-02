import { Button } from '@/components/ui/button';
import { TravelOverrideDialog } from './TravelOverrideDialog';
import type { TravelController } from './useTravelFeasibility';
import type { TravelAlternative } from './types';

const reasonText: Record<string, string> = {
  insufficient_travel_time: 'There is not enough travel time.', travel_time_conflict: 'There is not enough travel time.',
  location_unknown: 'Confirm the building address so travel can be checked.', unknown_location: 'Confirm the building address so travel can be checked.',
  route_unavailable: 'A route could not be confirmed.', overlap: 'The appointment overlaps another booking.',
  outside_working_hours: 'The appointment is outside working hours.',
  capture_overlap: 'The shoot overlaps another appointment. Choose another time or photographer.',
  travel_review_required: 'Travel needs a staff review before this schedule can be confirmed.',
  location_unverified: 'The building location has not been verified. Confirm the address before scheduling.',
};
function travelDateLabel(value: string, timezone?: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone || 'America/New_York', timeZoneName: 'short' }).format(date);
}
export function TravelFeasibilityPanel({ travel, onAlternative }: { travel: TravelController; onAlternative?: (alternative: TravelAlternative) => void }) {
  if (!travel.visible) return null;
  const result = travel.result;
  const hasIssue = result && !result.available;
  const unknownLocation = result?.transitions?.some(transition => transition.source === 'unknown')
    || result?.reason_codes?.some(code => /location|building|geocod|address/.test(code));
  const canConfirm = Boolean(result?.can_confirm_location || result?.can_override);
  const labels = { incoming: 'From previous appointment', outgoing: 'To next appointment', between_proposed: 'Between these visits' };
  return <><section aria-label="Travel feasibility" className="min-w-0 space-y-3 rounded-xl border bg-muted/30 p-3 text-sm sm:p-4">
    <div role="status" aria-live="polite">
      <p className="font-semibold">{travel.loading ? 'Checking travel · time is provisional' : travel.error ? 'Travel check unavailable' : result?.available ? 'Travel time checked' : 'Travel needs attention'}</p>
      {travel.error && <p className="mt-1 break-words text-muted-foreground">{travel.error}</p>}
      {travel.requestedOnly && (hasIssue || travel.error || travel.loading) && <p className="mt-1 text-muted-foreground">You can submit your request. Our team will review the schedule before confirming it.</p>}
    </div>
    {!travel.loading && result?.transitions?.map(transition => <div key={transition.id} className="space-y-1 border-t pt-2">
      <p className="font-medium">{labels[transition.direction]}</p>
      <p>{transition.required_minutes == null ? 'Travel allowance is not yet known.' : `${transition.required_minutes} min needed · ${Math.max(0, transition.available_minutes)} min available`}
        {transition.shortfall_minutes != null && transition.shortfall_minutes > 0 ? ` · ${transition.shortfall_minutes} min short` : ''}</p>
      {transition.source === 'same_building' && <p className="text-xs text-muted-foreground">Same confirmed building · no travel allowance between units.</p>}
      {transition.source === 'mileage_band' && <p className="text-xs text-muted-foreground">Estimated travel based on distance; actual road travel may take longer.</p>}
      {transition.source !== 'same_building' && transition.drive_minutes != null && <p className="text-xs text-muted-foreground">Estimated drive: {Math.ceil(transition.drive_minutes)} min{transition.distance_miles != null ? ` · ${transition.distance_miles.toFixed(1)} miles` : ''}</p>}
      {transition.earliest_start && <p className="text-xs">Earliest start: {travelDateLabel(transition.earliest_start, travel.timezone)}</p>}
      {transition.latest_start && <p className="text-xs">Latest start: {travelDateLabel(transition.latest_start, travel.timezone)}</p>}
      {transition.attribution && <p translate="no" className="whitespace-nowrap text-xs font-normal not-italic text-[#5E5E5E] dark:text-white">{transition.attribution}</p>}
    </div>)}
    {!travel.loading && hasIssue && result.reason_codes?.map(code => <p key={code} className="text-muted-foreground">{reasonText[code] || code.replace(/_/g, ' ')}</p>)}
    {canConfirm && (unknownLocation || travel.locationConfirmed) && <label className="flex items-start gap-2">
      <input type="checkbox" className="mt-1" checked={travel.locationConfirmed} onChange={event => travel.setLocationConfirmed(event.target.checked)} />
      <span>I confirm this is the correct building address, including the street number. Units at this building share its location.</span>
    </label>}
    {!travel.loading && hasIssue && travel.canOverride && <p className="text-muted-foreground">Saving will ask you to review the neighboring bookings, explain the travel exception, and swipe to confirm.</p>}
    {travel.error && <Button type="button" variant="outline" size="sm" onClick={() => void travel.retry()}>Retry travel check</Button>}
    {hasIssue && !travel.error && <Button type="button" variant="outline" size="sm" disabled={travel.loading} onClick={() => void travel.loadAlternatives()}>{travel.loading ? 'Checking…' : 'Find up to 3 alternatives'}</Button>}
    {!travel.loading && result?.alternatives?.slice(0, 3).map((alternative, index) => <div key={`${alternative.scheduled_at}-${alternative.photographer_id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
      <span>{travelDateLabel(alternative.scheduled_at, travel.timezone)}{alternative.shifted_visits && alternative.shifted_visits.length > 1 ? ` · ${alternative.shifted_visits.length} visits` : ''}</span>
      {onAlternative ? <Button type="button" size="sm" variant="outline" onClick={() => onAlternative(alternative)}>Use this time</Button> : <span className="text-xs text-muted-foreground">Adjust the visit times above to use this option.</span>}
    </div>)}
    {!travel.loading && travel.alternativesRequested && !result?.alternatives?.length && <p className="text-muted-foreground">No verified alternatives found. Choose another date or photographer.</p>}
    {result?.budget && result.budget.alert_level > 0 && <p role="status" className="rounded-lg border border-amber-500/40 p-2 text-xs">Route lookup budget: {result.budget.alert_level}% threshold reached ({result.budget.used_elements.toLocaleString()} of {result.budget.limit_elements.toLocaleString()} elements).{result.budget.alert_level === 100 ? ' Distance estimates will be used when routes are unavailable.' : ''}</p>}
    {result?.enabled && !travel.loading && !travel.error && <p className="text-xs text-muted-foreground">Availability is checked again when you save.</p>}
  </section><TravelOverrideDialog travel={travel} /></>;
}
