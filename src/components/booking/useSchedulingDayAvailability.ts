import { useEffect, type MutableRefObject } from 'react';
import { format } from 'date-fns';
import { getDayAvailability, type DayAvailability } from '@/utils/availabilityProvider';
import { derivePanelState, type AvailabilityPanelState } from '@/utils/availabilityPanelState';
import { CANONICAL_TIMEZONE } from '@/utils/timezone';
import type { SchedulingPhotographerView } from './schedulingModel';

interface Options {
  date?: Date;
  photographer?: string;
  canUseProtectedAvailability: boolean;
  availabilityDataDate: string;
  defaultServiceDate: string;
  photographerOptions: SchedulingPhotographerView[];
  latestRequestRef: MutableRefObject<number>;
  setAvailabilityPanel: (value: AvailabilityPanelState | null) => void;
  setDayAvailability: (value: DayAvailability | null) => void;
}

export function useSchedulingDayAvailability({
  date, photographer, canUseProtectedAvailability, availabilityDataDate,
  defaultServiceDate, photographerOptions, latestRequestRef,
  setAvailabilityPanel, setDayAvailability,
}: Options) {
  const dayKey = date ? format(date, 'yyyy-MM-dd') : '';

  // A staff day check is independent of roster enrichment and selected time.
  // Keeping these effects separate prevents background updates restarting it.
  useEffect(() => {
    if (!canUseProtectedAvailability) return;
    const requestId = ++latestRequestRef.current;
    setDayAvailability(null);
    if (!photographer || !dayKey) {
      setAvailabilityPanel(null);
      return;
    }
    const controller = new AbortController();
    setAvailabilityPanel({ kind: 'loading' });
    void getDayAvailability(photographer, new Date(`${dayKey}T12:00:00`), controller.signal)
      .then(result => {
        if (controller.signal.aborted || requestId !== latestRequestRef.current) return;
        setDayAvailability(result.day);
        setAvailabilityPanel(derivePanelState({ loading: false, aborted: false, error: null, result }));
      })
      .catch((error: Error) => {
        if (controller.signal.aborted || requestId !== latestRequestRef.current) return;
        setDayAvailability(null);
        setAvailabilityPanel(derivePanelState({ loading: false, aborted: false, error, result: null }));
      });
    return () => controller.abort();
  }, [canUseProtectedAvailability, dayKey, photographer, latestRequestRef, setAvailabilityPanel, setDayAvailability]);

  // Clients use the public booking response and must react to its slot updates.
  useEffect(() => {
    if (canUseProtectedAvailability) return;
    ++latestRequestRef.current;
    setDayAvailability(null);
    if (!photographer || !dayKey || availabilityDataDate !== defaultServiceDate) {
      setAvailabilityPanel(null);
      return;
    }
    const selected = photographerOptions.find(item => String(item.id) === String(photographer));
    const bookable = selected?.availabilitySlots ?? [];
    const blocked = [...(selected?.bookedSlots ?? []), ...(selected?.unavailableSlots ?? [])]
      .filter(slot => Boolean(slot.start_time && slot.end_time))
      .map(slot => ({ start: slot.start_time, end: slot.end_time }));
    const starts = bookable.map(slot => slot.start_time).filter(Boolean).sort();
    const ends = bookable.map(slot => slot.end_time).filter(Boolean).sort();
    const workingHours = starts.length && ends.length
      ? { start: starts[0], end: ends[ends.length - 1] } : null;
    const result = {
      status: workingHours ? 'success' as const : blocked.length ? 'empty' as const : 'not-configured' as const,
      day: { workingHours, blocked, fromConfig: workingHours !== null, timezone: CANONICAL_TIMEZONE },
    };
    setDayAvailability(result.day);
    setAvailabilityPanel(derivePanelState({ loading: false, aborted: false, error: null, result }));
  }, [availabilityDataDate, canUseProtectedAvailability, dayKey, defaultServiceDate,
    photographer, photographerOptions, latestRequestRef, setAvailabilityPanel, setDayAvailability]);
}
