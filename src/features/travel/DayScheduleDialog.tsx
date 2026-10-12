import { useMemo, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TravelController } from './useTravelFeasibility';
import { canConfirmTravelException } from './useTravelSaveConfirmation';
import { atMinute, localSchedule, overlaps, shiftTravelPayload, sameDayTransitions, type DayBooking } from './daySchedule';
import { useDaySchedule, useDayPreview } from './useDaySchedule';
import { DayScheduleTimeline } from './DayScheduleTimeline';
import { TravelNotifications } from './TravelNotifications';
import { TravelRouteSummary } from './TravelRouteSummary';
import type { ScheduleAdjustment } from './types';

export function DayScheduleDialog({ travel, open, onClose }: { travel: TravelController; open: boolean; onClose: () => void }) {
  const visits = (travel.result?.visits ?? []).filter(visit => visit.is_target !== false);
  const groups = [...new Map(visits.map(visit => {
    const date = localSchedule(visit.start, visit.timezone).date;
    return [`${visit.photographer_id}:${date}`, { photographerId: visit.photographer_id, date, timezone: visit.timezone }] as const;
  })).entries()];
  const [selection, setSelection] = useState('');
  const selected = groups.find(([key]) => key === selection) ?? groups[0];
  const scope = travel.dayScheduleScope ? selected?.[1] : undefined;
  return <DayScheduleEditor key={selected?.[0] ?? 'itinerary'} travel={travel} open={open} onClose={onClose}
    visits={scope ? visits.filter(visit => visit.photographer_id === scope.photographerId
      && localSchedule(visit.start, scope.timezone).date === scope.date) : visits}
    scope={scope} selector={travel.dayScheduleScope && groups.length > 1 ? <label className="text-xs font-medium">Photographer and date<select aria-label="Photographer and date" value={selected?.[0] ?? ''} onChange={event => setSelection(event.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2">{groups.map(([key, group]) => <option key={key} value={key}>{travel.photographerNames?.[String(group.photographerId)] ?? `Photographer ${group.photographerId}`} · {group.date}</option>)}</select></label> : null} />;
}

function DayScheduleEditor({ travel, open, onClose, visits: targets, scope, selector }: {
  travel: TravelController; open: boolean; onClose: () => void;
  visits: NonNullable<NonNullable<TravelController['result']>['visits']>; scope?: import('./daySchedule').VisitScope; selector: ReactNode;
}) {
  const target = targets[0], timezone = target?.timezone || travel.timezone || 'America/New_York';
  const date = target ? localSchedule(target.start, timezone).date : '';
  const photographer = target?.photographer_id || Number(travel.payload?.photographer_id);
  const { data, error } = useDaySchedule(open && Boolean(target), photographer, date, timezone, travel.payload?.shoot_id);
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false), [moveError, setMoveError] = useState('');
  const [notifications, setNotifications] = useState(travel.notifications);
  const offset = target && moves.target ? (Date.parse(moves.target) - Date.parse(target.start)) / 60000 : 0;
  const bookings = useMemo(() => {
    const existing = (data?.bookings ?? []).map(row => {
      const previous = travel.scheduleAdjustments.find(change => change.shoot_id === row.shoot_id);
      const start = moves[row.id] || previous?.scheduled_at || row.start;
      return { ...row, start, end: new Date(Date.parse(start) + row.duration_minutes * 60000).toISOString() };
    });
    return [...existing, ...targets.map((row, index): DayBooking => ({ id: index ? `target-${index}` : 'target', target: true,
      start: new Date(Date.parse(row.start) + offset * 60000).toISOString(), end: new Date(Date.parse(row.end) + offset * 60000).toISOString(),
      label: typeof travel.payload?.address === 'string' ? travel.payload.address : travel.proposedLocation || 'Selected property', duration_minutes: row.duration_minutes, photographer_id: row.photographer_id,
      shoot_id: Number(travel.payload?.shoot_id) || null, expected_edit_version: null, can_adjust: true }))];
  }, [data, moves, targets, offset, travel.scheduleAdjustments, travel.proposedLocation, travel.payload?.shoot_id, travel.payload?.address]);
  const adjustments: ScheduleAdjustment[] = [...travel.scheduleAdjustments.filter(change => !(data?.bookings ?? []).some(row => row.shoot_id === change.shoot_id)), ...(data?.bookings ?? []).flatMap(original => {
    const next = bookings.find(row => row.id === original.id);
    return next && next.start !== original.start && original.can_adjust && original.shoot_id && original.expected_edit_version
      ? [{ shoot_id: original.shoot_id, photographer_id: original.photographer_id, from_start: original.start,
        scheduled_at: next.start, expected_edit_version: original.expected_edit_version }] : [];
  })];
  const payload = data && travel.payload ? { ...shiftTravelPayload(travel.payload, offset, timezone, scope), schedule_adjustments: adjustments,
    ...(travel.locationConfirmed ? { travel_location_confirmed: true } : {}) } : null;
  const preview = useDayPreview(payload, dragging);
  const conflict = overlaps(bookings);
  const outsideHours = preview.result?.reason_codes?.some(reason => /working_hours|outside_hours/.test(reason));
  const serverOverlap = preview.result?.reason_codes?.some(reason => /overlap/.test(reason));
  const canApply = !conflict && !moveError && !preview.loading && !preview.error && preview.result?.enabled
    && (preview.result.available || canConfirmTravelException(preview.result, travel.requestedOnly));
  const move = (id: string, start: string) => {
    // All visits in this draft move together, preserving their relative timing.
    const index = id.startsWith('target-') ? Number(id.slice(7)) : 0;
    const value = id.startsWith('target') && index ? new Date(Date.parse(start) - (Date.parse(targets[index].start) - Date.parse(target.start))).toISOString() : start;
    setMoves(current => ({ ...current, [id.startsWith('target') ? 'target' : id]: value }));
  };
  const changeTime = (id: string, time: string, original: string) => {
    if (!/^\d{2}:\d{2}$/.test(time)) return;
    try {
      const [hours, minutes] = time.split(':').map(Number);
      move(id, atMinute(date, hours * 60 + minutes, timezone, original)); setMoveError('');
    } catch (caught) { setMoveError(caught instanceof Error ? caught.message : 'Choose a valid time.'); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="max-h-[94dvh] min-w-0 w-[calc(100vw-1rem)] max-w-5xl grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto rounded-2xl p-4 sm:p-5">
    <DialogHeader className="pr-5 text-left"><DialogTitle>Adjust this day</DialogTitle><DialogDescription>{data?.photographer.name || 'Photographer'} · {date} · {timezone}</DialogDescription></DialogHeader>
    {selector}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!data && !error && <p role="status" className="text-sm">Loading this day’s bookings…</p>}
    {data && <>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className="rounded-lg border border-violet-500/40 bg-violet-500/5 p-3 text-xs"><span className="font-semibold">This shoot start time</span><Input aria-label="This shoot start time" type="time" className="mt-1 h-9" value={localSchedule(moves.target || target.start, timezone).time} onChange={event => changeTime('target', event.target.value, target.start)} /><span className="mt-1 block text-muted-foreground">Services move together, keeping their spacing.</span></label>
        {bookings.filter(row => !row.target).map(row => <label key={row.id} className="min-w-0 rounded-lg border p-3 text-xs"><span className="block truncate font-medium" title={row.label}>{row.label}</span><Input aria-label={`Start time for ${row.label}`} type="time" className="mt-1 h-9" disabled={!row.can_adjust} value={localSchedule(row.start, timezone).time} onChange={event => changeTime(row.id, event.target.value, row.start)} />{!row.can_adjust && <span className="mt-1 block text-muted-foreground">Open this booking separately to edit.</span>}</label>)}
      </div>
      <DayScheduleTimeline bookings={bookings} date={date} timezone={timezone} onMove={move} onDragging={setDragging} onError={setMoveError} />
      <div aria-live="polite" className="space-y-2 text-sm">
        {conflict ? <p className="text-amber-600 dark:text-amber-300">Bookings overlap. Move either shoot to a free time.</p> : preview.loading ? <p>Checking travel for this schedule…</p>
          : preview.error ? <p role="alert" className="text-destructive">{preview.error}</p> : preview.result?.available ? <p className="text-emerald-700 dark:text-emerald-300">This schedule has enough travel time.</p>
            : <p className="text-amber-600 dark:text-amber-300">{outsideHours
              ? 'This schedule is outside the photographer’s working hours. Move the bookings within their availability.'
              : serverOverlap ? 'The photographer has another booking at this time. Move either shoot to a free time.'
                : canApply ? 'You can use this schedule and explicitly confirm the shorter travel gap when saving.'
                  : 'Travel for this schedule needs approval from an administrator or sales rep.'}</p>}
        {moveError && <p role="alert" className="text-destructive">{moveError}</p>}
        {sameDayTransitions(preview.result?.transitions ?? [], timezone).map(leg => <TravelRouteSummary key={leg.id} leg={leg} />)}
      </div>
      <TravelNotifications value={notifications} onChange={setNotifications} />
      <p className="text-xs text-muted-foreground">Changes to {adjustments.length ? `${adjustments.length} existing booking${adjustments.length === 1 ? '' : 's'} and ` : ''}this shoot are saved together when you save or book the shoot. Calendar updates follow a successful save.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" className="h-auto min-h-10 min-w-0 whitespace-normal" disabled={!canApply} onClick={() => {
        if (!canApply || !target || !travel.onScheduleChange) return;
        travel.onScheduleChange({ scheduledAt: moves.target || target.start, offsetMinutes: offset, timezone, ...(scope ? { visitScope: scope } : {}) });
        travel.setScheduleAdjustments(adjustments); travel.setNotifications(notifications); onClose();
      }}>{canApply && !preview.result?.available ? 'Use schedule · review travel on save' : 'Use this schedule'}</Button></div>
    </>}
  </DialogContent></Dialog>;
}
