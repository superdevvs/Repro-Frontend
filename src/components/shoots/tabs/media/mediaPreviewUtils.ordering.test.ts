import { expect, it } from 'vitest';
import { buildMediaFilesFingerprint } from './mediaPreviewUtils';

it.each([
  { sort_order: 3 },
  { captured_at: '2026-11-05T09:00:00Z' },
  { created_at: '2026-11-05T10:00:00Z' },
])('accepts an ordering-only file refresh: %o', change => {
  const original = { id: '10', filename: 'photo.jpg', sort_order: 1 };
  expect(buildMediaFilesFingerprint([original])).not.toBe(buildMediaFilesFingerprint([{ ...original, ...change }]));
});
