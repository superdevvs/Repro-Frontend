import { ArrowDownLeft, ArrowUpRight, Clock3, MapPin, UserRound } from 'lucide-react';
import type { TravelController } from './useTravelFeasibility';
import type { TravelTransition } from './types';
import { sameDayTransitions } from './daySchedule';
import { TravelRouteSummary } from './TravelRouteSummary';

function scheduleRange(start: string, end?: string, timezone = 'America/New_York') {
  const first = new Date(start), last = end ? new Date(end) : null;
  if (!Number.isFinite(first.getTime()) || (last && !Number.isFinite(last.getTime()))) return [start, end].filter(Boolean).join(' – ');
  const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: timezone });
  const time = (value: Date, zone = false) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone, ...(zone ? { timeZoneName: 'short' as const } : {}) }).format(value);
  const zoneLabel = (value: Date, timeZoneName: 'short' | 'shortOffset') => new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName }).formatToParts(value).find(part => part.type === 'timeZoneName')?.value;
  const zoneChanges = last && (zoneLabel(first, 'short') !== zoneLabel(last, 'short') || zoneLabel(first, 'shortOffset') !== zoneLabel(last, 'shortOffset'));
  return `${day.format(first)} · ${time(first, !last || Boolean(zoneChanges))}${last ? ` – ${day.format(first) === day.format(last) ? '' : `${day.format(last)} · `}${time(last, true)}` : ''}`;
}

function NeighborCard({ leg, timezone, showProposedTime }: { leg: TravelTransition; timezone?: string; showProposedTime: boolean }) {
  const neighbor = leg.neighbor?.can_view_details ? leg.neighbor : null;
  const shortfall = leg.shortfall_minutes != null && leg.shortfall_minutes > 0;
  const unknown = leg.required_minutes == null;
  const label = leg.direction === 'incoming' ? 'Previous booking' : leg.direction === 'outgoing' ? 'Next booking' : 'Between proposed visits';
  const DirectionIcon = leg.direction === 'outgoing' ? ArrowUpRight : ArrowDownLeft;
  return <section aria-label={label} data-testid="travel-neighbor-card" className={`min-w-0 rounded-xl border p-3 sm:p-4 ${shortfall || unknown ? 'border-amber-300/70 bg-amber-50/40 dark:border-amber-600/40 dark:bg-amber-950/10' : 'border-border bg-background'}`}>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><DirectionIcon aria-hidden="true" className="h-3.5 w-3.5" />{label}</p>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${shortfall || unknown ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>{shortfall ? `${leg.shortfall_minutes} min short` : unknown ? 'Review needed' : 'Enough time'}</span>
    </div>
    {neighbor ? <div className="space-y-1 text-sm">
      <p className="break-words font-semibold">{neighbor.services.map(service => service.name).join(', ') || 'Booked service'}</p>
      {neighbor.photographer?.name && <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><UserRound aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" /><span>Photographer: {neighbor.photographer.name}</span></p>}
      <p className="flex items-start gap-1.5 text-xs"><Clock3 aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" /><span>{scheduleRange(neighbor.scheduled_at, neighbor.end_at, neighbor.timezone)}</span></p>
    </div> : <p className="text-xs text-muted-foreground">{leg.direction === 'between_proposed' ? 'Review the timing between the proposed visits.' : 'Booking details are not available with your access.'}</p>}
    {showProposedTime && leg.candidate_start && <p className="mt-2 text-xs"><span className="font-medium">Proposed: </span>{scheduleRange(leg.candidate_start, leg.candidate_end, timezone)}</p>}
    <TravelRouteSummary leg={leg} />
  </section>;
}

export function TravelOverrideSchedule({ travel }: { travel: TravelController }) {
  const legs = sameDayTransitions(travel.result?.transitions ?? [], travel.timezone || travel.result?.visits?.[0]?.timezone || 'America/New_York');
  const first = legs[0];
  const sharedTime = first?.candidate_start && legs.every(leg => leg.candidate_start === first.candidate_start && leg.candidate_end === first.candidate_end);
  return <div className="space-y-3 sm:space-y-4">
    <section aria-label="Proposed booking" className="flex flex-col justify-between gap-2 rounded-xl bg-muted/60 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
      <div className="min-w-0"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Proposed booking</p><p className="flex items-start gap-2 text-sm font-medium"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="break-words">{travel.proposedLocation || 'Selected property'}</span></p></div>
      {sharedTime && <p className="flex shrink-0 items-center gap-1.5 text-xs sm:max-w-[45%] sm:shrink sm:text-right"><Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span>{scheduleRange(first.candidate_start!, first.candidate_end, travel.timezone)}</span></p>}
    </section>
    <div className={`grid gap-3 ${legs.length > 1 ? 'md:grid-cols-2' : ''}`}>
      {legs.map(leg => <NeighborCard key={leg.id} leg={leg} timezone={travel.timezone} showProposedTime={!sharedTime} />)}
    </div>
  </div>;
}
