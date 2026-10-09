import { useEffect, useRef, useState } from 'react';

function sessionKey(userId: string | number | undefined) {
  return userId == null ? null : `settings.systemOverview.unlocked:${userId}`;
}

export function isSystemMonitorUnlocked(userId: string | number | undefined) {
  const key = sessionKey(userId);
  try {
    return !!key && window.sessionStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function useHiddenSystemMonitor(userId: string | number | undefined, eligible: boolean, onUnlock: () => void) {
  const key = sessionKey(userId);
  const [session, setSession] = useState(() => ({ key, unlocked: isSystemMonitorUnlocked(userId) }));
  const clicks = useRef({ key, count: 0 });
  useEffect(() => { clicks.current = { key, count: 0 }; }, [key, eligible]);
  const unlocked = eligible && !!key && (session.key === key ? session.unlocked : isSystemMonitorUnlocked(userId));

  const recordInteraction = (tab: string) => {
    if (clicks.current.key !== key || tab !== 'account' || !eligible) clicks.current = { key, count: 0 };
    if (tab !== 'account' || !eligible || !key || unlocked) return;
    clicks.current.count += 1;
    if (clicks.current.count < 5) return;
    clicks.current.count = 0;
    try {
      window.sessionStorage.setItem(key, 'true');
    } catch {
      // Keep the current-page unlock usable when browser storage is unavailable.
    }
    setSession({ key, unlocked: true });
    onUnlock();
  };

  return { unlocked, recordInteraction };
}
