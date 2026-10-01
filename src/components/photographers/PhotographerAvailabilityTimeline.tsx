import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AvailabilityTimelineSlot } from '@/components/booking/AvailabilityTimelineSlot';
import { BookedAppointmentDetails } from '@/components/booking/BookedAppointmentDetails';
import type { BookingAvailabilitySlot } from '@/types/availability';
import { cn } from '@/lib/utils';
import { formatTimeForDisplay, to12Hour, to24Hour } from '@/utils/availabilityUtils';

export type PhotographerTimelineSlot = BookingAvailabilitySlot;
type TimelineSegment = PhotographerTimelineSlot & { visibleStart: number; visibleEnd: number };

export const PHOTOGRAPHER_TIMELINE_START_MINUTES = 8 * 60;
export const PHOTOGRAPHER_TIMELINE_END_MINUTES = 20 * 60;
export const PHOTOGRAPHER_TIMELINE_TOTAL_MINUTES =
  PHOTOGRAPHER_TIMELINE_END_MINUTES - PHOTOGRAPHER_TIMELINE_START_MINUTES;
export const PHOTOGRAPHER_TIMELINE_TICK_COUNT = 11;

type PhotographerAvailabilityTimelineProps = {
  availableSlots?: PhotographerTimelineSlot[] | null;
  bookedSlots?: PhotographerTimelineSlot[] | null;
  unavailableSlots?: PhotographerTimelineSlot[] | null;
  /** When true, booked-slot tooltips include location initials from address fields. */
  showLocationInitials?: boolean;
  /** Timeline window start (minutes from midnight). Defaults to 8:00. */
  startMinutes?: number;
  /** Timeline window end (minutes from midnight). Defaults to 20:00. */
  endMinutes?: number;
  tickCount?: number;
  className?: string;
  trackClassName?: string;
  loadingHint?: string | null;
};

const normalizeSlotTime = (value?: string | null) => {
  if (!value) return '';
  const converted = to24Hour(String(value).trim());
  const [hours, minutes] = converted.split(':');
  if (!hours || !minutes) return converted;
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
};

const timeToMinutes = (time: string) => {
  const normalized = normalizeSlotTime(time);
  const [hours, minutes] = normalized.split(':').map(Number);
  if (!Number.isFinite(hours)) return 0;
  return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const minutesToTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const prepareSlots = (slots?: PhotographerTimelineSlot[] | null): PhotographerTimelineSlot[] =>
  (slots || [])
    .map((slot) => ({
      ...slot,
      start_time: normalizeSlotTime(slot.start_time),
      end_time: normalizeSlotTime(slot.end_time),
    }))
    .filter((slot) => slot.start_time && slot.end_time);

const getLocationInitials = (slot: PhotographerTimelineSlot) => {
  const parts = [slot.address, slot.city, slot.state]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/\s+/))
    .map((part) => part.replace(/[^a-z0-9]/gi, ''))
    .filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
};

/**
 * Shared Select-Photographer day timeline: green Available / blue Booked / red N/A
 * labeled pills, hour ticks, tap popover + desktop hover via AvailabilityTimelineSlot.
 */
export function PhotographerAvailabilityTimeline({
  availableSlots,
  bookedSlots,
  unavailableSlots,
  showLocationInitials = false,
  startMinutes = PHOTOGRAPHER_TIMELINE_START_MINUTES,
  endMinutes = PHOTOGRAPHER_TIMELINE_END_MINUTES,
  tickCount = PHOTOGRAPHER_TIMELINE_TICK_COUNT,
  className,
  trackClassName,
  loadingHint = null,
}: PhotographerAvailabilityTimelineProps) {
  const scaleStart = Number.isFinite(startMinutes) ? startMinutes : PHOTOGRAPHER_TIMELINE_START_MINUTES;
  const scaleEnd = Number.isFinite(endMinutes) && endMinutes > scaleStart
    ? endMinutes
    : PHOTOGRAPHER_TIMELINE_END_MINUTES;
  const scaleTotal = Math.max(1, scaleEnd - scaleStart);
  const scaleTicks = tickCount > 0 ? tickCount : PHOTOGRAPHER_TIMELINE_TICK_COUNT;

  const clampForWindow = (slot: PhotographerTimelineSlot): TimelineSegment | null => {
    const slotStart = Math.max(scaleStart, timeToMinutes(slot.start_time));
    const slotEnd = Math.min(scaleEnd, timeToMinutes(slot.end_time));
    if (slotEnd <= slotStart) return null;
    return {
      ...slot,
      visibleStart: slotStart,
      visibleEnd: slotEnd,
    };
  };

  const availability = prepareSlots(availableSlots).map(clampForWindow).filter(Boolean) as TimelineSegment[];
  const booked = prepareSlots(bookedSlots).map(clampForWindow).filter(Boolean) as TimelineSegment[];
  const unavailable = prepareSlots(unavailableSlots).map(clampForWindow).filter(Boolean) as TimelineSegment[];
  const hasSegments = availability.length > 0 || booked.length > 0 || unavailable.length > 0;

  const renderTimelineSlot = (
    slot: TimelineSegment,
    key: string,
    classNameForSlot: string,
    label: string,
  ) => {
    const startMins = slot.visibleStart;
    const endMins = slot.visibleEnd;
    if (endMins <= startMins) return null;
    const leftPercent = ((startMins - scaleStart) / scaleTotal) * 100;
    const widthPercent = ((endMins - startMins) / scaleTotal) * 100;
    const clampedLeft = Math.max(0, Math.min(100, leftPercent));
    const clampedWidth = Math.max(2, Math.min(100 - clampedLeft, widthPercent));
    if (clampedWidth <= 0) return null;
    const content = (
      <>
        {label}
        {showLocationInitials && slot.address ? ` · ${getLocationInitials(slot)}` : ''}
        {' · '}
        {to12Hour(slot.start_time)}-{to12Hour(slot.end_time)}
      </>
    );
    const showPillLabel = clampedWidth >= 8;
    return (
      <AvailabilityTimelineSlot
        key={key}
        className={classNameForSlot}
        style={{ left: `${clampedLeft}%`, width: `${clampedWidth}%` }}
        label={`${label} ${to12Hour(slot.start_time)}-${to12Hour(slot.end_time)}`}
        content={label === 'Booked' ? <BookedAppointmentDetails slot={slot} /> : content}
        interaction={label === 'Booked' ? 'popover' : 'adaptive'}
        contentClassName={label === 'Booked' ? 'w-72 p-3' : undefined}
      >
        {showPillLabel ? (
          <span className="pointer-events-none truncate px-1 text-[9px] font-semibold leading-none tracking-wide text-white">
            {label}
          </span>
        ) : null}
      </AvailabilityTimelineSlot>
    );
  };

  return (
    <div className={cn('space-y-1', className)}>
      <TooltipProvider delayDuration={100}>
        <div
          className={cn(
            'relative h-5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700',
            trackClassName,
          )}
        >
          {availability.map((slot, index) =>
            renderTimelineSlot(
              slot,
              `available-${index}-${slot.start_time}`,
              'absolute top-0 bottom-0 rounded-full bg-emerald-500 dark:bg-emerald-500',
              'Available',
            ),
          )}
          {booked.map((slot, index) =>
            renderTimelineSlot(
              slot,
              `booked-${index}-${slot.start_time}`,
              'absolute top-0 bottom-0 rounded-full bg-blue-500 dark:bg-blue-500',
              'Booked',
            ),
          )}
          {unavailable.map((slot, index) =>
            renderTimelineSlot(
              slot,
              `unavailable-${index}-${slot.start_time}`,
              'absolute top-0 bottom-0 rounded-full bg-red-500 dark:bg-red-500',
              'N/A',
            ),
          )}
        </div>
        {hasSegments ? (
          <div className="mt-1 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            <span className="shrink-0">
              {formatTimeForDisplay(minutesToTime(scaleStart))}
            </span>
            <div className="flex flex-1 items-center justify-between px-1">
              {Array.from({ length: scaleTicks }).map((_, index) => {
                const tickMinutes =
                  scaleStart +
                  Math.round(((index + 1) * scaleTotal) / (scaleTicks + 1));
                return (
                  <Tooltip key={`tick-${index}-${tickMinutes}`}>
                    <TooltipTrigger asChild>
                      <span className="h-1.5 w-px bg-slate-300/80 dark:bg-slate-600/80" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="px-2 py-1 text-xs">
                      {to12Hour(minutesToTime(tickMinutes))}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <span className="shrink-0">
              {formatTimeForDisplay(minutesToTime(scaleEnd))}
            </span>
          </div>
        ) : null}
      </TooltipProvider>
      {loadingHint && !hasSegments ? (
        <div className="text-[10px] text-slate-500 dark:text-slate-400">{loadingHint}</div>
      ) : null}
    </div>
  );
}
