import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShootPageOverview } from './useShootPageOverview';

type ShootId = Parameters<typeof useShootPageOverview>[0];
const advance = (milliseconds: number) => act(() => vi.advanceTimersByTime(milliseconds));

describe('full shoot page overview', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('waits for the shoot to load, then opens after two seconds', () => {
    const { result, rerender } = renderHook(({ id }: { id: ShootId }) => useShootPageOverview(id), {
      initialProps: { id: undefined as ShootId },
    });
    advance(5000);
    expect(result.current.isOverviewModalOpen).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    rerender({ id: 156 });
    advance(1999);
    expect(result.current.isOverviewModalOpen).toBe(false);
    advance(1);
    expect(result.current.isOverviewModalOpen).toBe(true);
  });

  it('does not reopen a closed automatic overview when the same shoot refreshes', () => {
    const { result, rerender } = renderHook(({ id }: { id: ShootId }) => useShootPageOverview(id), {
      initialProps: { id: 156 as ShootId },
    });
    advance(2000);
    act(() => result.current.closeOverviewModal());
    rerender({ id: 156 });
    advance(5000);
    expect(result.current.isOverviewModalOpen).toBe(false);

    // A temporary loading state must not turn a refreshed shoot into a new visit.
    rerender({ id: undefined });
    rerender({ id: 156 });
    advance(5000);
    expect(result.current.isOverviewModalOpen).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('opens immediately from the button and cancels the pending automatic launch', () => {
    const { result } = renderHook(() => useShootPageOverview('156'));
    advance(700);
    act(() => result.current.openOverviewModal());
    expect(result.current.isOverviewModalOpen).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    act(() => result.current.closeOverviewModal());
    advance(5000);
    expect(result.current.isOverviewModalOpen).toBe(false);
    act(() => result.current.openOverviewModal());
    expect(result.current.isOverviewModalOpen).toBe(true);
  });

  it('allows the button to reopen the overview after its automatic opening was closed', () => {
    const { result } = renderHook(() => useShootPageOverview(156));
    advance(2000);
    act(() => result.current.closeOverviewModal());
    expect(result.current.isOverviewModalOpen).toBe(false);
    act(() => result.current.openOverviewModal());
    expect(result.current.isOverviewModalOpen).toBe(true);
  });

  it('opens automatically for the next shoot after closing the previous overview', () => {
    const { result, rerender } = renderHook(({ id }) => useShootPageOverview(id), {
      initialProps: { id: 156 },
    });
    advance(2000);
    act(() => result.current.closeOverviewModal());
    rerender({ id: 157 });
    advance(1999);
    expect(result.current.isOverviewModalOpen).toBe(false);
    advance(1);
    expect(result.current.isOverviewModalOpen).toBe(true);
  });

  it('restarts the delay when the shoot changes before the pending launch', () => {
    const { result, rerender } = renderHook(({ id }) => useShootPageOverview(id), {
      initialProps: { id: 156 },
    });
    advance(1500);
    rerender({ id: 157 });
    expect(vi.getTimerCount()).toBe(1);
    advance(500);
    expect(result.current.isOverviewModalOpen).toBe(false);
    advance(1500);
    expect(result.current.isOverviewModalOpen).toBe(true);
  });

  it('cleans up the pending launch when the page unmounts', () => {
    const { unmount } = renderHook(() => useShootPageOverview(156));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(5000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
