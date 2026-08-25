import { describe, expect, it } from 'vitest';

import type { MediaFile } from '@/hooks/useShootFiles';

import {
  buildManualBaselineIds,
  getSortedMediaIds,
  hasSavedManualOrder,
  normalizeManualOrder,
  sortMediaFiles,
} from './mediaSort';

/** Minimal MediaFile stub — only the fields the comparators read. */
const file = (id: string, overrides: Partial<MediaFile> = {}): MediaFile =>
  ({
    id,
    filename: `${id}.jpg`,
    ...overrides,
  }) as MediaFile;

describe('sortMediaFiles — name', () => {
  it('orders a camera counter numerically, not lexicographically', () => {
    const files = [
      file('a', { filename: 'IMG_10.jpg' }),
      file('b', { filename: 'IMG_2.jpg' }),
      file('c', { filename: 'IMG_1.jpg' }),
    ];

    expect(sortMediaFiles(files, 'name').map((f) => f.filename)).toEqual([
      'IMG_1.jpg',
      'IMG_2.jpg',
      'IMG_10.jpg',
    ]);
  });

  it('handles a sequence that does not start at 1', () => {
    const files = [
      file('a', { filename: 'DSC_100.jpg' }),
      file('b', { filename: 'DSC_50.jpg' }),
      file('c', { filename: 'DSC_9.jpg' }),
    ];

    expect(sortMediaFiles(files, 'name').map((f) => f.filename)).toEqual([
      'DSC_9.jpg',
      'DSC_50.jpg',
      'DSC_100.jpg',
    ]);
  });

  it('is idempotent', () => {
    const files = [
      file('a', { filename: 'IMG_10.jpg' }),
      file('b', { filename: 'IMG_2.jpg' }),
    ];

    const once = sortMediaFiles(files, 'name');
    const twice = sortMediaFiles(once, 'name');

    expect(twice.map((f) => f.id)).toEqual(once.map((f) => f.id));
  });

  it('does not mutate the input array', () => {
    const files = [
      file('a', { filename: 'IMG_10.jpg' }),
      file('b', { filename: 'IMG_2.jpg' }),
    ];
    const original = [...files];

    sortMediaFiles(files, 'name');

    expect(files).toEqual(original);
  });
});

describe('sortMediaFiles — manual', () => {
  it('round-trips a saved order including the first position', () => {
    const files = [file('a'), file('b'), file('c')];
    const manualOrder = ['c', 'a', 'b'];

    expect(sortMediaFiles(files, 'manual', manualOrder).map((f) => f.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('appends files that are missing from the saved order', () => {
    const files = [file('a'), file('b'), file('c')];

    expect(sortMediaFiles(files, 'manual', ['c']).map((f) => f.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('normalizeManualOrder', () => {
  it('drops unknown ids and de-duplicates', () => {
    const files = [file('a'), file('b')];

    expect(normalizeManualOrder(['b', 'b', 'zzz', 'a'], files)).toEqual(['b', 'a']);
  });

  it('is stable once normalized', () => {
    const files = [file('a'), file('b'), file('c')];
    const once = normalizeManualOrder(['c', 'a'], files);

    expect(normalizeManualOrder(once, files)).toEqual(once);
  });
});

describe('sortMediaFiles — time (the default)', () => {
  it('orders by capture time rather than upload time', () => {
    const files = [
      file('late', { captured_at: '2026-05-01T10:30:00Z', created_at: '2026-05-02T08:00:00Z' }),
      file('early', { captured_at: '2026-05-01T09:00:00Z', created_at: '2026-05-02T09:00:00Z' }),
    ];

    expect(sortMediaFiles(files, 'time').map((f) => f.id)).toEqual(['early', 'late']);
  });

  it('falls back to upload time when a file has no capture time', () => {
    const files = [
      file('b', { created_at: '2026-05-01T12:00:00Z' }),
      file('a', { captured_at: '2026-05-01T09:00:00Z' }),
    ];

    expect(sortMediaFiles(files, 'time').map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('breaks ties on the filename counter so a shared timestamp is not shuffled', () => {
    // A folder copied off a card can land with one identical timestamp on every
    // file. Without a tie-breaker these came out in whatever order the API
    // returned, which changed between refetches.
    const stamp = '2026-05-01T09:00:00Z';
    const files = [
      file('c', { filename: 'IMG_10.jpg', captured_at: stamp }),
      file('a', { filename: 'IMG_2.jpg', captured_at: stamp }),
      file('b', { filename: 'IMG_1.jpg', captured_at: stamp }),
    ];

    expect(sortMediaFiles(files, 'time').map((f) => f.filename)).toEqual([
      'IMG_1.jpg',
      'IMG_2.jpg',
      'IMG_10.jpg',
    ]);
  });

  it('is idempotent when every timestamp is identical', () => {
    const stamp = '2026-05-01T09:00:00Z';
    const files = [
      file('c', { filename: 'IMG_10.jpg', captured_at: stamp }),
      file('a', { filename: 'IMG_2.jpg', captured_at: stamp }),
    ];

    const once = sortMediaFiles(files, 'time');

    expect(sortMediaFiles(once, 'time').map((f) => f.id)).toEqual(once.map((f) => f.id));
  });
});

describe('switching into manual sort', () => {
  it('preserves the order that is currently on screen', () => {
    // This is what changeSortOrder now seeds the manual order with: the ids in
    // the order the active sort is displaying. Selecting Manual must not move a
    // single tile.
    const files = [
      file('c', { filename: 'IMG_10.jpg', captured_at: '2026-05-01T11:00:00Z' }),
      file('a', { filename: 'IMG_2.jpg', captured_at: '2026-05-01T09:00:00Z' }),
      file('b', { filename: 'IMG_1.jpg', captured_at: '2026-05-01T10:00:00Z' }),
    ];

    const onScreen = sortMediaFiles(files, 'time').map((f) => f.id);
    const seeded = normalizeManualOrder(getSortedMediaIds(files, 'time'), files);

    expect(seeded).toEqual(onScreen);
    expect(sortMediaFiles(files, 'manual', seeded).map((f) => f.id)).toEqual(onScreen);
  });

  it('ignores stale saved positions that would have reshuffled the grid', () => {
    // Files never reordered carry sort_order 0, which used to sort them ahead of
    // everything else and made Manual look random.
    const files = [
      file('a', { filename: 'IMG_1.jpg', captured_at: '2026-05-01T09:00:00Z', sort_order: 7 }),
      file('b', { filename: 'IMG_2.jpg', captured_at: '2026-05-01T10:00:00Z', sort_order: 0 }),
    ];

    const seeded = normalizeManualOrder(getSortedMediaIds(files, 'time'), files);

    expect(seeded).toEqual(['a', 'b']);
  });
});

describe('buildManualBaselineIds', () => {
  it('restores a saved arrangement so leaving and re-entering manual is not destructive', () => {
    const files = [
      file('a', { filename: 'IMG_1.jpg', captured_at: '2026-05-01T09:00:00Z', sort_order: 3 }),
      file('b', { filename: 'IMG_2.jpg', captured_at: '2026-05-01T10:00:00Z', sort_order: 1 }),
      file('c', { filename: 'IMG_3.jpg', captured_at: '2026-05-01T11:00:00Z', sort_order: 2 }),
    ];

    expect(buildManualBaselineIds(files, 'time')).toEqual(['b', 'c', 'a']);
  });

  it('falls back to exactly the visible order when nothing was ever saved', () => {
    const files = [
      file('c', { filename: 'IMG_3.jpg', captured_at: '2026-05-01T11:00:00Z' }),
      file('a', { filename: 'IMG_1.jpg', captured_at: '2026-05-01T09:00:00Z' }),
      file('b', { filename: 'IMG_2.jpg', captured_at: '2026-05-01T10:00:00Z' }),
    ];

    const visible = sortMediaFiles(files, 'time').map((f) => f.id);

    expect(buildManualBaselineIds(files, 'time')).toEqual(visible);
  });

  it('trails never-placed files behind the arranged block instead of leading with them', () => {
    // sort_order 0 sorting first is what made entering manual look like a shuffle:
    // every new upload jumped to the top of a curated set.
    const files = [
      file('new', { filename: 'IMG_9.jpg', captured_at: '2026-05-01T08:00:00Z', sort_order: 0 }),
      file('first', { filename: 'IMG_1.jpg', captured_at: '2026-05-01T09:00:00Z', sort_order: 1 }),
      file('second', { filename: 'IMG_2.jpg', captured_at: '2026-05-01T10:00:00Z', sort_order: 2 }),
    ];

    expect(buildManualBaselineIds(files, 'time')).toEqual(['first', 'second', 'new']);
  });

  it('breaks duplicate saved positions by id, matching the backend delivery order', () => {
    const files = [
      file('20', { sort_order: 1 }),
      file('3', { sort_order: 1 }),
      file('11', { sort_order: 1 }),
    ];

    expect(buildManualBaselineIds(files, 'time')).toEqual(['3', '11', '20']);
  });

  it('is idempotent', () => {
    const files = [
      file('a', { sort_order: 2 }),
      file('b', { sort_order: 1 }),
      file('c', { sort_order: 0 }),
    ];

    const once = buildManualBaselineIds(files, 'time');

    expect(sortMediaFiles(files, 'manual', once).map((f) => f.id)).toEqual(once);
  });
});

describe('hasSavedManualOrder', () => {
  it('is false when no file was ever placed', () => {
    expect(hasSavedManualOrder([file('a'), file('b', { sort_order: 0 })])).toBe(false);
  });

  it('is true as soon as one file carries a 1-based position', () => {
    expect(hasSavedManualOrder([file('a', { sort_order: 0 }), file('b', { sort_order: 1 })])).toBe(true);
  });
});
