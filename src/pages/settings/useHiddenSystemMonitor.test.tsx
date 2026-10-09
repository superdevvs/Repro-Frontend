import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHiddenSystemMonitor } from './useHiddenSystemMonitor';

describe('hidden monitor session access', () => {
  afterEach(() => { cleanup(); sessionStorage.clear(); });
  it('keeps the unlock scoped to the authenticated user and browser session', () => {
    const unlocked = vi.fn();
    const { result, rerender, unmount } = renderHook(({ id, eligible }) => useHiddenSystemMonitor(id, eligible, unlocked),
      { initialProps: { id: '42', eligible: true } });
    act(() => { for (let i = 0; i < 5; i++) result.current.recordInteraction('account'); });
    expect(result.current.unlocked).toBe(true);
    expect(unlocked).toHaveBeenCalledTimes(1);
    rerender({ id: '43', eligible: true });
    expect(result.current.unlocked).toBe(false);
    rerender({ id: '42', eligible: false });
    expect(result.current.unlocked).toBe(false);
    unmount();
    const restored = renderHook(() => useHiddenSystemMonitor('42', true, unlocked));
    expect(restored.result.current.unlocked).toBe(true);
    restored.unmount();
    sessionStorage.clear();
    const nextSession = renderHook(() => useHiddenSystemMonitor('42', true, unlocked));
    expect(nextSession.result.current.unlocked).toBe(false);
  });
  it('does not carry a partial click sequence across an account switch', () => {
    const { result, rerender } = renderHook(({ id }) => useHiddenSystemMonitor(id, true, vi.fn()), { initialProps: { id: '42' } });
    act(() => { for (let i = 0; i < 4; i++) result.current.recordInteraction('account'); });
    rerender({ id: '43' });
    act(() => result.current.recordInteraction('account'));
    expect(result.current.unlocked).toBe(false);
  });
  it('never unlocks an ineligible role through clicks or a stored marker', () => {
    sessionStorage.setItem('settings.systemOverview.unlocked:42', 'true');
    const unlocked = vi.fn();
    const { result } = renderHook(() => useHiddenSystemMonitor('42', false, unlocked));
    act(() => { for (let i = 0; i < 6; i++) result.current.recordInteraction('account'); });
    expect(result.current.unlocked).toBe(false);
    expect(unlocked).not.toHaveBeenCalled();
  });
});
