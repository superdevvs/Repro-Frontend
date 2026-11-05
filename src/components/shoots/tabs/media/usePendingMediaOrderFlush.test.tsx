import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePendingMediaOrderFlush } from './usePendingMediaOrderFlush';

afterEach(cleanup);

it('flushes the latest drag when the pane closes and prevents its late response from updating that pane', () => {
  const mounted = { current: true };
  const oldFlush = vi.fn();
  const finalFlush = vi.fn(() => expect(mounted.current).toBe(false));
  const view = renderHook(({ flush }) => usePendingMediaOrderFlush(flush, mounted), { initialProps: { flush: oldFlush } });
  view.rerender({ flush: finalFlush });
  view.unmount();
  expect(oldFlush).not.toHaveBeenCalled();
  expect(finalFlush).toHaveBeenCalledOnce();
});

it('flushes on page exit and unregisters the listener when the pane unmounts', () => {
  const flush = vi.fn();
  const view = renderHook(() => usePendingMediaOrderFlush(flush, { current: true }));
  window.dispatchEvent(new Event('pagehide'));
  expect(flush).toHaveBeenCalledOnce();
  view.unmount();
  expect(flush).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new Event('pagehide'));
  expect(flush).toHaveBeenCalledTimes(2);
});
