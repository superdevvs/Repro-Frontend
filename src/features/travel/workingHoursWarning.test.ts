import { expect, it } from 'vitest';
import { describeWorkingHours, workingHoursWarnings } from './workingHoursWarning';
import type { TravelFeasibility } from './types';

const fact = { photographer_id: 1106, photographer_name: 'KK - Kumnith Keo', date: '2026-11-19', day: 'Thursday', start: '14:00', end: '17:15',
  ends_next_day: false, blocked: false, windows: [{ start: '09:00', end: '17:00' }] };

it('states the finish time, the working hours and the overrun', () => {
  expect(describeWorkingHours(fact)).toBe('Ends 5:15 PM; KK - Kumnith Keo works 9:00 AM–5:00 PM on Thursday (15 min over).');
});
it('states an early start and a longer overrun in hours', () => {
  expect(describeWorkingHours({ ...fact, start: '08:30', end: '10:00' })).toBe('Starts 8:30 AM; KK - Kumnith Keo works 9:00 AM–5:00 PM on Thursday (30 min early).');
  expect(describeWorkingHours({ ...fact, end: '18:30' })).toContain('(1 hr 30 min over)');
});
it('names blocked time, a day with no hours, split hours and a booking past midnight', () => {
  expect(describeWorkingHours({ ...fact, blocked: true })).toBe('2:00 PM–5:15 PM overlaps time KK - Kumnith Keo has blocked off on Thursday.');
  expect(describeWorkingHours({ ...fact, windows: [], photographer_name: null })).toBe('The photographer has no working hours on Thursday.');
  expect(describeWorkingHours({ ...fact, start: '12:15', end: '12:45', windows: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] }))
    .toBe('12:15 PM–12:45 PM is outside these hours; KK - Kumnith Keo works 9:00 AM–12:00 PM, 1:00 PM–5:00 PM on Thursday.');
  expect(describeWorkingHours({ ...fact, start: '23:30', end: '00:30', ends_next_day: true })).toBe('11:30 PM–12:30 AM runs past midnight; a booking must end on the day it starts.');
});
it('falls back to the plain sentence when the server sent no hours, and stays quiet otherwise', () => {
  const base = { enabled: true, status: 'conflict', available: false, transitions: [], alternatives: [], can_override: false, policy_version: 'p', schedule_version: 's' } as TravelFeasibility;
  expect(workingHoursWarnings({ ...base, reason_codes: ['outside_working_hours'] })).toEqual(['The appointment is outside the photographer’s working hours.']);
  expect(workingHoursWarnings({ ...base, reason_codes: ['outside_working_hours'], working_hours: [fact, fact] })).toEqual([describeWorkingHours(fact)]);
  expect(workingHoursWarnings({ ...base, reason_codes: ['capture_overlap'] })).toEqual([]);
  expect(workingHoursWarnings(null)).toEqual([]);
});
