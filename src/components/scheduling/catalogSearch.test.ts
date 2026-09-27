import { describe, expect, it } from 'vitest';
import { serviceMatchesSearch } from './catalogSearch';

describe('scheduling catalog search', () => {
  it('matches a service name or description and ignores blank queries', () => {
    expect(serviceMatchesSearch('30 HDR Photos + floor plans', '2D floor plans', '')).toBe(true);
    expect(serviceMatchesSearch('30 HDR Photos + floor plans', '2D floor plans', 'floor')).toBe(true);
    expect(serviceMatchesSearch('30 HDR Photos + floor plans', '2D floor plans', 'twilight')).toBe(false);
  });
});
