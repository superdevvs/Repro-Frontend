import { useMemo, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ServiceTimePicker, buildServiceTimeOptions } from '@/components/shoots/ServiceSchedulePicker';
import { formatTimeForDisplay } from '@/utils/availabilityUtils';
import type { TravelController } from './useTravelFeasibility';
import { canConfirmTravelException } from './useTravelSaveConfirmation';
import { atMinute, localSchedule, overlaps, shiftTravelVisit, shiftTravelPayload, sameDayTransitions, type DayBooking } from './daySchedule';
import { useDaySchedule, useDayPreview } from './useDaySchedule';
import { DayScheduleTimeline } from './DayScheduleTimeline';
import { TravelNotifications } from './TravelNotifications';
import { TravelRouteSummary } from './TravelRouteSummary';
import type { ScheduleAdjustment } from './types';
import { useMediaQuery } from '@/hooks/use-media-query';
import '@/components/shoots/shootScheduleDialogs.css';

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
  const [targetIndex, setTargetIndex] = useState(0);
  const target = targets[scope ? 0 : targetIndex] ?? targets[0], timezone = target?.timezone || travel.timezone || 'America/New_York';
  const date = target ? localSchedule(target.start, timezone).date : '';
  const photographer = target?.photographer_id || Number(travel.payload?.photographer_id);
  const { data, error } = useDaySchedule(open && Boolean(target), photographer, date, timezone, travel.payload?.shoot_id);
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false), [moveError, setMoveError] = useState('');
  const [allowExisting, setAllowExisting] = useState(false), [editingId, setEditingId] = useState('target');
  const [notifications, setNotifications] = useState(travel.notifications);
  const isWideLayout = useMediaQuery('(min-width: 640px)');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const offset = target && moves.target ? (Date.parse(moves.target) - Date.parse(target.start)) / 60000 : 0;
  const change = { scheduledAt: moves.target || target?.start, offsetMinutes: offset, timezone, ...(scope ? { visitScope: scope } : { photographerId: photographer, fromStart: target?.start, fromEnd: target?.end }) };
  const bookings = useMemo(() => {
    const existing = (data?.bookings ?? []).map(row => {
      const previous = travel.scheduleAdjustments.find(item => item.shoot_id === row.shoot_id);
      const start = moves[row.id] || previous?.scheduled_at || row.start;
      return { ...row, can_adjust: row.can_adjust && allowExisting && !travel.requestedOnly, start, end: new Date(Date.parse(start) + row.duration_minutes * 60000).toISOString() };
    });
    const visits = targets.filter(row => row.photographer_id === photographer && localSchedule(row.start, timezone).date === date);
    return [...existing, ...visits.map((row, index): DayBooking => {
      const selected = row === target;
      return { id: selected ? 'target' : `other-visit-${index}`, target: selected, can_adjust: selected,
        start: scope ? new Date(Date.parse(row.start) + offset * 60000).toISOString() : selected && moves.target ? moves.target : row.start,
        end: scope || selected ? new Date(Date.parse(row.end) + offset * 60000).toISOString() : row.end,
        label: typeof travel.payload?.address === 'string' ? travel.payload.address : travel.proposedLocation || 'Selected property',
        duration_minutes: row.duration_minutes, photographer_id: row.photographer_id, shoot_id: Number(travel.payload?.shoot_id) || null, expected_edit_version: null };
    })];
  }, [data, moves, targets, target, scope, offset, photographer, date, timezone, allowExisting, travel]);
  const dayAdjustments: ScheduleAdjustment[] = (data?.bookings ?? []).flatMap(original => {
    const next = bookings.find(row => row.id === original.id);
    return next && next.start !== original.start && original.can_adjust && original.shoot_id && original.expected_edit_version
      ? [{ shoot_id: original.shoot_id, photographer_id: original.photographer_id, from_start: original.start, scheduled_at: next.start, expected_edit_version: original.expected_edit_version }] : [];
  });
  const adjustments = [...travel.scheduleAdjustments.filter(item => !dayAdjustments.some(row => row.shoot_id === item.shoot_id)), ...dayAdjustments];
  const payload = data && travel.payload && target ? { ...(scope ? shiftTravelPayload(travel.payload, offset, timezone, scope) : shiftTravelVisit(travel.payload, change)), schedule_adjustments: adjustments,
    ...(travel.locationConfirmed ? { travel_location_confirmed: true } : {}) } : null;
  const preview = useDayPreview(payload, dragging), conflict = overlaps(bookings);
  const outsideHours = preview.result?.reason_codes?.some(reason => /working_hours|outside_hours/.test(reason));
  const serverOverlap = preview.result?.reason_codes?.some(reason => /overlap/.test(reason));
  const canApply = !conflict && !moveError && !preview.loading && !preview.error && preview.result?.enabled
    && (preview.result.available || canConfirmTravelException(preview.result, travel.requestedOnly));
  const move = (id: string, start: string) => setMoves(current => ({ ...current, [id]: start }));
  const editing = bookings.find(row => row.id === editingId) ?? bookings.find(row => row.target);
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent data-shoot-dialog className="flex max-h-[94dvh] min-w-0 w-[calc(100vw-1rem)] max-w-5xl flex-col overflow-hidden rounded-2xl p-0">
    <DialogHeader data-shoot-header className="shrink-0 px-4 pb-3 pr-12 pt-4 text-left sm:px-5"><DialogTitle>Adjust this day</DialogTitle><DialogDescription>{data?.photographer.name || 'Photographer'} · {date} · {timezone}</DialogDescription></DialogHeader>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 sm:px-5">
    {selector}
    {!scope && targets.length > 1 && <label className="text-sm">Visit to review<select aria-label="Visit to review" className="mt-1 h-11 w-full rounded-lg border bg-background px-2" value={targetIndex} onChange={event => { setTargetIndex(Number(event.target.value)); setMoves({}); setEditingId('target'); setAllowExisting(false); setMoveError(''); }}>
      {targets.map((row, index) => <option key={index} value={index}>Photographer {row.photographer_id} · {localSchedule(row.start, timezone).date} · {formatTimeForDisplay(localSchedule(row.start, timezone).time)}</option>)}
    </select></label>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!data && !error && <p role="status" className="text-sm">Loading this day’s bookings…</p>}
    {data && <>
      <section aria-label="Edit booking time" className="min-w-0 space-y-2 rounded-lg border p-3">
        {(data.bookings.some(row => row.can_adjust) && !travel.requestedOnly) && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={allowExisting} onChange={event => { setAllowExisting(event.target.checked); if (!event.target.checked) { setMoves(current => ({ target: current.target })); setEditingId('target'); } }} />Allow changes to existing bookings</label>}
        <label className="block text-sm">Booking to adjust<select aria-label="Booking to adjust" className="mt-1 h-11 w-full rounded-lg border bg-background px-2" value={editing?.id || 'target'} onChange={event => setEditingId(event.target.value)}>
          {bookings.filter(row => row.target || row.can_adjust).map(row => <option key={row.id} value={row.id}>{row.target ? 'This shoot: ' : ''}{row.label} · {formatTimeForDisplay(localSchedule(row.start, timezone).time)}</option>)}
        </select></label>
        {editing && <><details className="text-sm"><summary className="cursor-pointer">Booking details</summary><p className="mt-1 break-words">{editing.label}</p><p>{formatTimeForDisplay(localSchedule(editing.start, timezone).time)}–{formatTimeForDisplay(localSchedule(editing.end, timezone).time)}</p></details>
          <div className="space-y-1"><span className="text-xs text-muted-foreground">New time</span><ServiceTimePicker value={localSchedule(editing.start, timezone).time} options={buildServiceTimeOptions(localSchedule(editing.start, timezone).time)} triggerClassName="h-11" onChange={value => {
            if (!value) return;
            try { const [hour, minute] = value.split(':').map(Number); move(editing.id, atMinute(date, hour * 60 + minute, timezone, editing.start)); setMoveError(''); } catch (caught) { setMoveError(caught instanceof Error ? caught.message : 'Choose another time.'); }
          }} /></div></>}
      </section>
      <details open={isWideLayout || timelineOpen} onToggle={event => { if (!isWideLayout) setTimelineOpen(event.currentTarget.open); }} className="rounded-lg border p-3 sm:border-0 sm:p-0"><summary className="cursor-pointer py-2 text-sm font-medium sm:hidden">View day timeline</summary><div className="pt-2 sm:pt-0"><DayScheduleTimeline key={`${photographer}:${date}:${targetIndex}`} bookings={bookings} date={date} timezone={timezone} onMove={move} onDragging={setDragging} onError={setMoveError} /></div></details>
      <div aria-live="polite" className="space-y-2 text-sm">
        {conflict ? <p className="text-amber-600 dark:text-amber-300">Bookings overlap. Move either shoot to a free time.</p> : preview.loading ? <p>Checking travel for this schedule…</p>
          : preview.error ? <p role="alert" className="text-destructive">{preview.error}</p> : preview.result?.available ? <p className="text-emerald-700 dark:text-emerald-300">This schedule has enough travel time.</p>
            : <p className="text-amber-600 dark:text-amber-300">{outsideHours ? 'This schedule is outside the photographer’s working hours. Move the bookings within their availability.' : serverOverlap ? 'The photographer has another booking at this time. Move either shoot to a free time.' : canApply ? 'You can use this schedule and explicitly confirm the shorter travel gap when saving.' : 'Travel for this schedule needs approval from an administrator or sales rep.'}</p>}
        {moveError && <p role="alert" className="text-destructive">{moveError}</p>}
        {sameDayTransitions(preview.result?.transitions ?? [], timezone).map(leg => <TravelRouteSummary key={leg.id} leg={leg} />)}
      </div>
      <TravelNotifications value={notifications} onChange={setNotifications} />
      <p className="text-xs text-muted-foreground">Changes to {adjustments.length ? `${adjustments.length} existing booking${adjustments.length === 1 ? '' : 's'} and ` : ''}this visit are saved together when you save or book the shoot. Calendar updates follow a successful save.</p>
    </>}
    </div>
    {data && <div data-shoot-footer className="flex shrink-0 gap-2 border-t px-4 py-3 sm:justify-end sm:px-5"><Button type="button" variant="outline" className="h-11 sm:h-10" onClick={onClose}>Cancel</Button><Button type="button" className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal sm:min-h-10 sm:flex-none" disabled={!canApply} onClick={() => {
        if (!canApply || !target || !travel.onScheduleChange) return;
        travel.onScheduleChange(change); travel.setScheduleAdjustments(adjustments); travel.setNotifications(notifications); onClose();
      }}>{canApply && !preview.result?.available ? 'Use schedule · review travel on save' : 'Use this schedule'}</Button></div>
    }
  </DialogContent></Dialog>;
}
