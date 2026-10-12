import { describe, expect, it } from 'vitest';
import { buildServiceTimeOptions } from './ServiceSchedulePicker';
import { buildFullDayServiceTimeOptions } from './fullDayServiceTimeOptions';

describe('approval time options', () => {
  it('supports early, late, and existing exact-minute bookings without changing normal booking hours', () => {
    const options = buildFullDayServiceTimeOptions('07:33');
    expect(options.map(row => row.value)).toContain('00:00');
    expect(options.map(row => row.value)).toContain('23:55');
    expect(options.find(row => row.value === '07:33')?.label).toBe('7:33 AM');
    expect(options.map(row => row.value)).toContain('13:33');
    expect(options).toHaveLength(1440);
    expect(buildServiceTimeOptions()[0].value).toBe('08:00');
    expect(buildServiceTimeOptions().at(-1)?.value).toBe('19:00');
  });
});
