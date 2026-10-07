import { describe, expect, it } from 'vitest';
import { canNotifyDistinctPhotographer } from './shootEditNotificationRecipients';
describe('approval notification recipients', () => {
  it('excludes missing emails', () => expect(canNotifyDistinctPhotographer(null, 1, 2)).toBe(false));
  it('avoids duplicate client and photographer recipients', () => expect(canNotifyDistinctPhotographer('fixture@example.test', '1', 1)).toBe(false));
  it('includes a distinct assigned photographer', () => expect(canNotifyDistinctPhotographer('fixture@example.test', 2, 1)).toBe(true));
});
