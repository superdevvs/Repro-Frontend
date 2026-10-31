import { beforeEach, describe, expect, it, vi } from 'vitest';
import { beginStudioPurchase, forgetStudioPurchase, readStudioPurchase, studioActionKey } from './listingStudioPurchase';

const quoteId = '00000000-0000-4000-8000-000000000001';
beforeEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });
describe('Studio purchase recovery', () => {
  it('recovers the same purchase key for dashboard-issued UUIDv7 quotes after reload', () => {
    const quote = '019a3adb-2c54-7f80-a3df-8c2ef86bd090';
    const first = beginStudioPurchase('client-a', quote, 'credits');
    expect(readStudioPurchase('client-a')).toEqual(first);
    expect(beginStudioPurchase('client-a', quoteId, 'card')).toEqual(first);
    forgetStudioPurchase('client-a', first.key);
    expect(readStudioPurchase('client-a')).toBeNull();
  });
  it('keeps the exact confirmed request across a reload and a changed selection', () => {
    const first = beginStudioPurchase('client-a', quoteId, 'credits');
    expect(readStudioPurchase('client-a')).toEqual(first);
    expect(beginStudioPurchase('client-a', '00000000-0000-4000-8000-000000000002', 'card')).toEqual(first);
    expect(readStudioPurchase('client-b')).toBeNull();
    forgetStudioPurchase('client-a', 'unrelated-key');
    expect(readStudioPurchase('client-a')).toEqual(first);
    forgetStudioPurchase('client-a', first.key);
    expect(readStudioPurchase('client-a')).toBeNull();
  });
  it('does not create an unpersisted purchase when session storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage is unavailable'); });
    expect(() => beginStudioPurchase('client-a', quoteId, 'credits')).toThrow();
  });
  it('isolates checkout keys by account and order', () => {
    const key = studioActionKey('client-a', 'checkout:order-a');
    expect(studioActionKey('client-a', 'checkout:order-a')).toBe(key);
    expect(studioActionKey('client-b', 'checkout:order-a')).not.toBe(key);
    expect(studioActionKey('client-a', 'checkout:order-b')).not.toBe(key);
  });
  it('ignores invalid or cross-account stored request data', () => {
    sessionStorage.setItem('repro:listing-studio:purchase:client-a', JSON.stringify({ accountId: 'client-b', quoteId, fundingMethod: 'card', key: crypto.randomUUID() }));
    expect(readStudioPurchase('client-a')).toBeNull();
    sessionStorage.setItem('repro:listing-studio:purchase:client-a', 'broken-json');
    expect(readStudioPurchase('client-a')).toBeNull();
  });
});
