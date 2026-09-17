import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  countUnread,
  getReadIds,
  isNotificationRead,
  mergeNotificationLists,
  parseNotificationDate,
  saveReadIds,
  seedLastSeenAt,
} from './notificationReadState';

const STORAGE_KEY = 'repro_read_notifications_superadmin_1';

const daysAgo = (days: number, now: number) => now - days * 24 * 60 * 60 * 1000;

describe('seedLastSeenAt', () => {
  it('seeds to the newest feed timestamp when no watermark exists', () => {
    const newest = Date.parse('2026-09-01T12:00:00.000Z');

    expect(
      seedLastSeenAt(null, ['2026-08-01T00:00:00.000Z', '2026-09-01T12:00:00.000Z', '2026-07-15T00:00:00.000Z'], 1_800_000_000_000),
    ).toBe(newest);
  });

  it('seeds to now when the feed is empty', () => {
    const now = 1_800_000_000_000;
    expect(seedLastSeenAt(undefined, [], now)).toBe(now);
    expect(seedLastSeenAt(null, [null, '', 'not-a-date'], now)).toBe(now);
  });

  it('keeps an existing watermark', () => {
    const existing = Date.parse('2026-01-01T00:00:00.000Z');
    expect(
      seedLastSeenAt(existing, ['2026-09-01T12:00:00.000Z'], Date.parse('2026-09-17T00:00:00.000Z')),
    ).toBe(existing);
  });
});

describe('parseNotificationDate', () => {
  it('parses Laravel toDateTimeString values used by /api/notifications', () => {
    const laravel = '2026-09-10 14:30:00';
    const parsed = parseNotificationDate(laravel);

    expect(parsed).not.toBeNull();
    expect(new Date(parsed as number).getFullYear()).toBe(2026);
    expect(new Date(parsed as number).getMonth()).toBe(8);
    expect(new Date(parsed as number).getDate()).toBe(10);
  });
});

describe('isNotificationRead', () => {
  const lastSeenAt = Date.parse('2026-09-10T00:00:00.000Z');
  const readIds = new Set(['sa-read']);

  it('treats an id in readIds as read', () => {
    expect(isNotificationRead('sa-read', '2026-09-16T00:00:00.000Z', readIds, lastSeenAt)).toBe(true);
  });

  it('treats timestamps at or before the watermark as read', () => {
    expect(isNotificationRead('sa-old', '2026-09-10T00:00:00.000Z', new Set(), lastSeenAt)).toBe(true);
    expect(isNotificationRead('sa-older', '2026-01-01T00:00:00.000Z', new Set(), lastSeenAt)).toBe(true);
  });

  it('treats timestamps after the watermark as unread when not in readIds', () => {
    expect(isNotificationRead('sa-new', '2026-09-10T00:00:01.000Z', new Set(), lastSeenAt)).toBe(false);
  });

  it('compares Laravel activity timestamps against the watermark', () => {
    const laravel = '2026-09-10 14:30:00';
    const stamp = parseNotificationDate(laravel);

    expect(stamp).not.toBeNull();
    expect(isNotificationRead('sa-at-watermark', laravel, new Set(), stamp)).toBe(true);
    expect(isNotificationRead('sa-after-watermark', laravel, new Set(), (stamp as number) - 1)).toBe(false);
  });

  it('treats undated and unparseable items as read so they do not badge forever', () => {
    expect(isNotificationRead('sa-none', null, new Set(), lastSeenAt)).toBe(true);
    expect(isNotificationRead('sa-empty', '', new Set(), lastSeenAt)).toBe(true);
    expect(isNotificationRead('sa-bad', 'not-a-date', new Set(), lastSeenAt)).toBe(true);
  });
});

describe('countUnread', () => {
  it('does not badge historical feed items at or before a seeded watermark', () => {
    const lastSeenAt = Date.parse('2026-09-01T00:00:00.000Z');
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: `sa-${i}`,
      date: '2026-08-01T00:00:00.000Z',
    }));

    expect(countUnread(items, new Set(), lastSeenAt)).toBe(0);
  });

  it('counts only items newer than the watermark that are not marked read', () => {
    const lastSeenAt = Date.parse('2026-09-01T00:00:00.000Z');
    const items = [
      { id: 'sa-old', date: '2026-08-01T00:00:00.000Z' },
      { id: 'sa-new', date: '2026-09-02T00:00:00.000Z' },
      { id: 'sa-read', date: '2026-09-03T00:00:00.000Z' },
    ];

    expect(countUnread(items, new Set(['sa-read']), lastSeenAt)).toBe(1);
  });
});

describe('getReadIds / saveReadIds prune', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does not drop IDs still in the current feed after 7 days', () => {
    const now = Date.parse('2026-09-17T00:00:00.000Z');
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'sa-1': daysAgo(8, now),
        'email-2': daysAgo(20, now),
      }),
    );

    const ids = getReadIds(STORAGE_KEY, new Set(['sa-1', 'email-2']), now);

    expect(ids.has('sa-1')).toBe(true);
    expect(ids.has('email-2')).toBe(true);
  });

  it('prunes IDs that left the feed and are older than 30 days', () => {
    const now = Date.parse('2026-09-17T00:00:00.000Z');
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'sa-stale': daysAgo(31, now),
        'sa-recent-gone': daysAgo(10, now),
        'sa-still-here': daysAgo(40, now),
      }),
    );

    const ids = getReadIds(STORAGE_KEY, new Set(['sa-still-here']), now);

    expect(ids.has('sa-stale')).toBe(false);
    expect(ids.has('sa-recent-gone')).toBe(true);
    expect(ids.has('sa-still-here')).toBe(true);
  });

  it('preserves existing timestamps so feed IDs are not restamped into a 7-day wipe', () => {
    const now = Date.parse('2026-09-17T00:00:00.000Z');
    const original = daysAgo(20, now);
    saveReadIds(new Set(['sa-1']), STORAGE_KEY, { currentFeedIds: new Set(['sa-1']), now: original });
    saveReadIds(new Set(['sa-1', 'sa-2']), STORAGE_KEY, { currentFeedIds: new Set(['sa-1', 'sa-2']), now });

    const later = now + 8 * 24 * 60 * 60 * 1000;
    const ids = getReadIds(STORAGE_KEY, new Set(['sa-1', 'sa-2']), later);

    expect(ids.has('sa-1')).toBe(true);
    expect(ids.has('sa-2')).toBe(true);
  });
});

describe('mergeNotificationLists', () => {
  const now = Date.parse('2026-09-17T18:00:00.000Z');

  it('lets the current activity feed replace previous activity items', () => {
    const previous = [
      { id: 'sa-old-1', date: '2026-08-01T00:00:00.000Z', title: 'Gone' },
      { id: 'sa-keep', date: '2026-08-02T00:00:00.000Z', title: 'Stale title' },
    ];
    const activity = [
      { id: 'sa-keep', date: '2026-08-02T00:00:00.000Z', title: 'Updated' },
      { id: 'sa-new', date: '2026-09-17T12:00:00.000Z', title: 'New' },
    ];

    const merged = mergeNotificationLists(previous, activity, now);
    const ids = merged.map((item) => item.id);

    expect(ids).toEqual(['sa-new', 'sa-keep']);
    expect(merged.find((item) => item.id === 'sa-keep')?.title).toBe('Updated');
  });

  it('keeps recent realtime extras such as sms-* and items from the last 2 hours', () => {
    const previous = [
      { id: 'sa-dropped', date: '2026-08-01T00:00:00.000Z' },
      { id: 'sms-thread-1', date: new Date(now - 30 * 60 * 1000).toISOString() },
      { id: 'email-live', date: new Date(now - 90 * 60 * 1000).toISOString() },
      { id: 'sa-stale-extra', date: new Date(now - 3 * 60 * 60 * 1000).toISOString() },
    ];
    const activity = [{ id: 'sa-feed', date: '2026-09-17T12:00:00.000Z' }];

    const merged = mergeNotificationLists(previous, activity, now);
    const ids = merged.map((item) => item.id);

    expect(ids).toContain('sa-feed');
    expect(ids).toContain('sms-thread-1');
    expect(ids).toContain('email-live');
    expect(ids).not.toContain('sa-dropped');
    expect(ids).not.toContain('sa-stale-extra');
  });
});
