import { afterEach, describe, expect, it, vi } from 'vitest';
import { startPaymentStatusPolling } from './paymentStatusPolling';

afterEach(() => vi.useRealTimers());

describe('payment status polling', () => {
  it('never overlaps requests and ignores a result after stopping', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const applied = vi.fn();
    const poll = vi.fn(async (active: () => boolean) => {
      await new Promise<void>((resolve) => { finish = resolve; });
      if (active()) applied();
    });
    const stop = startPaymentStatusPolling(poll);
    await vi.advanceTimersByTimeAsync(15000);
    expect(poll).toHaveBeenCalledTimes(1);
    stop();
    finish();
    await vi.advanceTimersByTimeAsync(15000);
    expect(applied).not.toHaveBeenCalled();
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('continues checking after a temporary confirmation error', async () => {
    vi.useFakeTimers();
    const poll = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
    const stop = startPaymentStatusPolling(poll);
    await vi.advanceTimersByTimeAsync(6000);
    expect(poll).toHaveBeenCalledTimes(2);
    stop();
  });
});
