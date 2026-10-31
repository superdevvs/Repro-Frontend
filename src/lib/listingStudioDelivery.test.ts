import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginStudioDelivery, forgetStudioDelivery, readStudioDelivery } from './listingStudioDelivery';

function photo(bytes: number[]) {
  return { arrayBuffer: async () => new Uint8Array(bytes).buffer } as File;
}
beforeEach(() => { sessionStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('team delivery recovery', () => {
  it('preserves the original file hash, request key and expected version across retries', async () => {
    const first = await beginStudioDelivery('editor-1', 'task-1', 4, photo([1, 2, 3]));
    expect(readStudioDelivery('editor-1', 'task-1')).toEqual(first);
    expect(await beginStudioDelivery('editor-1', 'task-1', 9, photo([1, 2, 3]))).toEqual(first);
    expect(readStudioDelivery('editor-2', 'task-1')).toBeNull();
    expect(readStudioDelivery('editor-1', 'task-2')).toBeNull();
    forgetStudioDelivery('editor-1', 'task-1'); expect(readStudioDelivery('editor-1', 'task-1')).toBeNull();
  });
  it('refuses changed bytes while an earlier delivery is unconfirmed', async () => {
    const original = await beginStudioDelivery('editor-1', 'task-1', 2, photo([1, 2, 3]));
    await expect(beginStudioDelivery('editor-1', 'task-1', 3, photo([3, 2, 1]))).rejects.toThrow('same photo');
    expect(readStudioDelivery('editor-1', 'task-1')).toEqual(original);
  });
  it('fails before upload when browser recovery storage cannot be written', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    await expect(beginStudioDelivery('editor-1', 'task-1', 2, photo([1]))).rejects.toThrow('cannot save delivery recovery');
  });
});
