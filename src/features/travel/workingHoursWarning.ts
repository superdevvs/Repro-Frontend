import { formatTimeForDisplay } from '@/utils/availabilityUtils';
import type { TravelFeasibility } from './types';

export type WorkingHoursFact = NonNullable<TravelFeasibility['working_hours']>[number];

export const WORKING_HOURS_FALLBACK = 'The appointment is outside the photographer’s working hours.';
/** Shown where no exception can be confirmed for this change. */
export const WORKING_HOURS_FIT_HINT = 'Move the booking or shorten the service durations so it fits these hours.';

const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
const span = (value: number) => value >= 60 ? `${Math.floor(value / 60)} hr${value % 60 ? ` ${value % 60} min` : ''}` : `${value} min`;
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** One sentence of facts: what was requested, the working hours, and by how much it misses. */
export function describeWorkingHours(fact: WorkingHoursFact): string {
  const who = fact.photographer_name?.trim() || 'the photographer';
  const range = `${formatTimeForDisplay(fact.start)}–${formatTimeForDisplay(fact.end)}`;
  if (fact.ends_next_day) return `${range} runs past midnight; a booking must end on the day it starts.`;
  if (fact.blocked) return `${range} overlaps time ${who} has blocked off on ${fact.day}.`;
  if (!fact.windows.length) return `${capital(who)} has no working hours on ${fact.day}.`;
  const works = `${who} works ${fact.windows.map(window => `${formatTimeForDisplay(window.start)}–${formatTimeForDisplay(window.end)}`).join(', ')} on ${fact.day}`;
  const start = minutes(fact.start), end = minutes(fact.end);
  const current = fact.windows.find(window => minutes(window.start) <= start && start < minutes(window.end));
  if (current && end > minutes(current.end)) return `Ends ${formatTimeForDisplay(fact.end)}; ${works} (${span(end - minutes(current.end))} over).`;
  const next = fact.windows.find(window => start < minutes(window.start) && minutes(window.start) < end && end <= minutes(window.end));
  if (next) return `Starts ${formatTimeForDisplay(fact.start)}; ${works} (${span(minutes(next.start) - start)} early).`;
  return `${range} is outside these hours; ${works}.`;
}

/** Empty unless the result is outside working hours; the plain sentence when the server sent no detail. */
export function workingHoursWarnings(result: TravelFeasibility | null | undefined): string[] {
  if (!result?.reason_codes?.some(reason => /working_hours|outside_hours/.test(reason))) return [];
  const lines = [...new Set((result.working_hours ?? []).map(describeWorkingHours))];
  return lines.length ? lines : [WORKING_HOURS_FALLBACK];
}
