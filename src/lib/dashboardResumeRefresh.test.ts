import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DASHBOARD_IDLE_REFRESH_MS, watchDashboardResume } from './dashboardResumeRefresh';

describe('dashboard return refresh', () => {
  let watcher: ReturnType<typeof watchDashboardResume>;
  const reload = vi.fn();
  const onDeferred = vi.fn();
  let busy = false;
  let draft = false;
  const advance = (ms = DASHBOARD_IDLE_REFRESH_MS) => vi.setSystemTime(Date.now() + ms);
  const focus = () => window.dispatchEvent(new Event('focus'));
  const visibility = (state: DocumentVisibilityState) => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T03:00:00Z'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    busy = false; draft = false;
    watcher = watchDashboardResume({ isWorkProtected: () => busy, hasDraft: () => draft, onDeferred, reload });
  });
  afterEach(() => {
    watcher.stop(); document.body.innerHTML = '';
    vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks();
  });

  it('waits 30 minutes and reloads only once for a burst of return events', () => {
    advance(DASHBOARD_IDLE_REFRESH_MS - 1); focus(); expect(reload).not.toHaveBeenCalled();
    advance(); focus(); visibility('visible'); window.dispatchEvent(new Event('pageshow'));
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('does not reload an unattended hidden tab; reloads when it becomes visible', () => {
    visibility('hidden'); advance(); focus(); expect(reload).not.toHaveBeenCalled();
    visibility('visible'); expect(reload).toHaveBeenCalledTimes(1);
  });
  it('handles browser back/forward restoration and device sleep without running timers', () => {
    window.dispatchEvent(new Event('pagehide')); advance();
    window.dispatchEvent(new Event('pageshow')); expect(reload).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('detects a sleep gap on the next interaction even without a focus event', () => {
    advance();
    const event = new Event('pointerdown', { cancelable: true });
    window.dispatchEvent(event);
    expect(reload).toHaveBeenCalledTimes(1); expect(event.defaultPrevented).toBe(true);
  });
  it('keeps an actively used session open', () => {
    for (let index = 0; index < 10; index++) {
      advance(10 * 60 * 1000); window.dispatchEvent(new Event('pointermove'));
    }
    expect(reload).not.toHaveBeenCalled();
  });
  it('does not forget time away due to repeated hidden or blur events', () => {
    window.dispatchEvent(new Event('blur')); advance(); visibility('hidden');
    visibility('visible'); expect(reload).toHaveBeenCalledTimes(1);
  });
  it('waits for connectivity instead of navigating to an offline error', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    advance(); focus(); expect(reload).not.toHaveBeenCalled(); expect(onDeferred).toHaveBeenLastCalledWith('offline');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    window.dispatchEvent(new Event('online')); expect(reload).toHaveBeenCalledTimes(1);
  });
  it.each(['input', 'change'])('protects an unfinished %s edit until explicit refresh or route navigation', eventName => {
    document.body.innerHTML = '<input value="original">';
    document.querySelector('input')!.dispatchEvent(new Event(eventName, { bubbles: true }));
    advance(); focus(); expect(reload).not.toHaveBeenCalled(); expect(onDeferred).toHaveBeenLastCalledWith('work');
    watcher.routeChanged(); expect(reload).toHaveBeenCalledTimes(1);
  });
  it('keeps editor state when connectivity returns', () => {
    draft = true; vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    advance(); focus(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    window.dispatchEvent(new Event('online')); expect(reload).not.toHaveBeenCalled();
    watcher.refreshNow(); expect(reload).toHaveBeenCalledTimes(1);
  });
  it('never bypasses uploads, mutations or calls, even for an explicit refresh', () => {
    busy = true; advance(); focus(); watcher.refreshNow(); expect(reload).not.toHaveBeenCalled();
    busy = false; focus(); expect(reload).toHaveBeenCalledTimes(1);
  });
  it('does not let focus while hidden clear an overdue refresh', () => {
    visibility('hidden'); advance(); focus(); advance(500);
    visibility('visible'); expect(reload).toHaveBeenCalledTimes(1);
  });
  it('removes listeners on sign-out or unmount', () => {
    watcher.stop(); advance(); focus(); visibility('visible'); window.dispatchEvent(new Event('pointerdown'));
    expect(reload).not.toHaveBeenCalled();
  });
});
