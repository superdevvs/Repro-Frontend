import { describe, expect, it, vi } from 'vitest';
import { EDITED_UPLOAD_CONCURRENCY, runUploadConcurrencyPool } from './mediaUploadConcurrency';

describe('runUploadConcurrencyPool', () => {
  it('runs items with bounded concurrency and preserves order', async () => {
    expect(EDITED_UPLOAD_CONCURRENCY).toBeGreaterThanOrEqual(2);
    let inFlight = 0;
    let maxInFlight = 0;
    const results = await runUploadConcurrencyPool({
      items: [1, 2, 3, 4, 5],
      concurrency: 2,
      run: async (item) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return item * 10;
      },
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('stops when the abort signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runUploadConcurrencyPool({
        items: [1],
        concurrency: 2,
        signal: controller.signal,
        run: async () => 1,
      }),
    ).rejects.toThrow(/cancelled/i);
  });

  it('drains existing requests on failure and leaves later files unsent', async () => {
    let finishSecond!: (value: number) => void;
    let settled = false;
    const run = vi.fn((item: number) => item === 1 ? Promise.resolve(-1) : new Promise<number>((resolve) => { finishSecond = resolve; }));
    const pending = runUploadConcurrencyPool({ items: [1, 2, 3, 4], concurrency: 2, run, stopWhen: (result) => result < 0, onSkipped: () => 0 }).then((results) => { settled = true; return results; });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(run).toHaveBeenCalledTimes(2);
    finishSecond(2);
    expect(await pending).toEqual([-1, 2, 0, 0]);
  });

  it('runs large files exclusively between concurrent ordinary groups', async () => {
    const active = new Set<number>();
    const pairs: number[][] = [];
    await runUploadConcurrencyPool({ items: [1, 2, 99, 3, 4], concurrency: 3, exclusive: (item) => item === 99,
      run: async (item) => {
        active.add(item);
        pairs.push([...active]);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active.delete(item);
        return item;
      },
    });
    expect(pairs.filter((pair) => pair.includes(99))).toEqual([[99]]);
    expect(pairs).toContainEqual([1, 2]);
    expect(pairs).toContainEqual([3, 4]);
  });

  it('keeps active confirmations when cancelled and fills skipped results after draining', async () => {
    const controller = new AbortController();
    let finish!: (value: number) => void;
    const run = vi.fn(() => new Promise<number>((resolve) => { finish = resolve; }));
    const result = runUploadConcurrencyPool({ items: [1, 2], concurrency: 1, signal: controller.signal, run, onSkipped: () => 0 });
    controller.abort();
    finish(1);
    expect(await result).toEqual([1, 0]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('waits for the other request before propagating an unexpected rejection', async () => {
    let finish!: (value: number) => void;
    let rejected = false;
    const result = runUploadConcurrencyPool({ items: [1, 2, 3], concurrency: 2,
      run: (item) => item === 1 ? Promise.reject(new Error('unexpected')) : new Promise<number>((resolve) => { finish = resolve; }),
    }).catch((error) => { rejected = true; throw error; });
    await Promise.resolve();
    await Promise.resolve();
    expect(rejected).toBe(false);
    finish(2);
    await expect(result).rejects.toThrow('unexpected');
  });
});
