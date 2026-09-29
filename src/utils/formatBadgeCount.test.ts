import { describe, expect, it } from 'vitest';
import { formatBadgeCount } from './formatBadgeCount';

describe('formatBadgeCount', () => {
  it('returns null for empty or non-positive values', () => {
    expect(formatBadgeCount(null)).toBeNull();
    expect(formatBadgeCount(undefined)).toBeNull();
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(-3)).toBeNull();
    expect(formatBadgeCount(Number.NaN)).toBeNull();
  });

  it('shows exact counts through 999', () => {
    expect(formatBadgeCount(1)).toBe('1');
    expect(formatBadgeCount(99)).toBe('99');
    expect(formatBadgeCount(100)).toBe('100');
    expect(formatBadgeCount(999)).toBe('999');
    expect(formatBadgeCount(42.9)).toBe('42');
  });

  it('caps above 999 as 999+', () => {
    expect(formatBadgeCount(1000)).toBe('999+');
    expect(formatBadgeCount(12345)).toBe('999+');
  });
});
