export const DASHBOARD_IDLE_REFRESH_MS = 30 * 60 * 1000;

export type ResumeRefreshReason = 'work' | 'offline' | null;

interface ResumeRefreshOptions {
  isWorkProtected: () => boolean;
  hasDraft?: () => boolean;
  onDeferred: (reason: ResumeRefreshReason) => void;
  reload: () => void;
}

// Wall-clock gaps survive suspended timers, closed lids, and mobile app switching.
// No polling: a foreground event or the next interaction checks the elapsed time.
export function watchDashboardResume({ isWorkProtected, hasDraft = () => false, onDeferred, reload }: ResumeRefreshOptions) {
  let lastActivity = Date.now();
  let awaySince: number | null = null;
  let edited = false;
  let pending = false;
  let reloading = false;

  const isForeground = () => document.visibilityState !== 'hidden';
  const workProtected = () => edited || hasDraft() || isWorkProtected();

  const refresh = (allowEdited = false) => {
    if (reloading || !isForeground()) return false;
    if (!navigator.onLine) {
      pending = true;
      onDeferred('offline');
      return false;
    }
    if (allowEdited ? isWorkProtected() : workProtected()) {
      pending = true;
      onDeferred('work');
      return false;
    }
    reloading = true;
    onDeferred(null);
    reload();
    return true;
  };

  const resume = () => {
    if (!isForeground() || reloading) return false;
    const now = Date.now();
    const idleSince = Math.min(lastActivity, awaySince ?? lastActivity);
    const due = pending || now - idleSince >= DASHBOARD_IDLE_REFRESH_MS;
    awaySince = null;
    lastActivity = now;
    return due && refresh();
  };
  const leave = () => { awaySince ??= Date.now(); };
  const visibility = () => { if (isForeground()) resume(); else leave(); };
  const activity = (event: Event) => {
    if (event.type === 'pointermove' && Date.now() - lastActivity < 1000) return;
    // Don't let the first click/keystroke submit an old screen as it reloads.
    if (resume() && event.cancelable) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const edit = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="slider"]')) {
      edited = true;
    }
  };

  const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const;
  activityEvents.forEach(name => window.addEventListener(name, activity, { capture: true, passive: false }));
  document.addEventListener('input', edit, true);
  document.addEventListener('change', edit, true);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', leave);
  window.addEventListener('focus', resume);
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', resume);
  window.addEventListener('online', resume);

  return {
    // Route navigation discards the previous view's edit state. Query changes
    // deliberately don't: closing a picker must not discard a page's draft.
    routeChanged: () => { edited = false; if (pending) resume(); },
    refreshNow: () => refresh(true),
    stop: () => {
      activityEvents.forEach(name => window.removeEventListener(name, activity, true));
      document.removeEventListener('input', edit, true);
      document.removeEventListener('change', edit, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', leave);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('online', resume);
    },
  };
}
