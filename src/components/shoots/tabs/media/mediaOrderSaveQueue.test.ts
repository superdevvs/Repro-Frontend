import { describe, expect, it, vi } from 'vitest';
import { createMediaOrderSaveQueue } from './mediaOrderSaveQueue';

describe('media order saves', () => {
  it('finishes an earlier write before starting the latest arrangement', async () => {
    const enqueue = createMediaOrderSaveQueue();
    let finish!: () => void;
    const first = enqueue(() => new Promise<void>(resolve => { finish = resolve; }));
    const writeLatest = vi.fn().mockResolvedValue('latest');
    const latest = enqueue(writeLatest);
    await Promise.resolve();
    expect(writeLatest).not.toHaveBeenCalled();
    finish(); await first;
    expect(await latest).toBe('latest');
    expect(writeLatest).toHaveBeenCalledTimes(1);
  });
  it('allows retry after a failed request', async () => {
    const enqueue = createMediaOrderSaveQueue();
    await expect(enqueue(() => Promise.reject(new Error('offline')))).rejects.toThrow('offline');
    await expect(enqueue(() => Promise.resolve('saved'))).resolves.toBe('saved');
  });
});
