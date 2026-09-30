import { describe, expect, it } from 'vitest';
import { applyServiceScheduleToAllIds } from './applyServiceScheduleToAll';

describe('applyServiceScheduleToAllIds', () => {
  it('copies source date+time onto every target id and keeps unrelated keys', () => {
    expect(
      applyServiceScheduleToAllIds(
        {
          '1': { date: '2026-09-30', time: '10:00' },
          '2': { date: '2026-10-01', time: '11:00' },
          '9': { date: '2026-01-01', time: '09:00' },
        },
        ['1', '2'],
        { date: '2026-09-30', time: '15:10' },
      ),
    ).toEqual({
      '1': { date: '2026-09-30', time: '15:10' },
      '2': { date: '2026-09-30', time: '15:10' },
      '9': { date: '2026-01-01', time: '09:00' },
    });
  });

  it('creates missing target ids', () => {
    expect(
      applyServiceScheduleToAllIds({}, ['7', '8'], { date: '2026-09-30', time: '15:10' }),
    ).toEqual({
      '7': { date: '2026-09-30', time: '15:10' },
      '8': { date: '2026-09-30', time: '15:10' },
    });
  });
});
