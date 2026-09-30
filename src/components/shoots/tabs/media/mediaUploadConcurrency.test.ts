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
});
