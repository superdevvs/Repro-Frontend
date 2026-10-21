import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMutating } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import { hasUploadsProtectedFromNavigation, subscribeUploadNavigationProtection } from '@/lib/uploadNavigationProtection';
import { watchDashboardResume, type ResumeRefreshReason } from '@/lib/dashboardResumeRefresh';

// These workspaces also store edits in button-driven React state (not just
// native form fields). Keep them intact even before the first input event.
const isDraftWorkspace = (path: string) => /^\/(book-shoot(?:\/|$|-)|ai-editing(?:\/|$)|chat-with-reproai(?:\/|$)|messaging\/email\/(compose|templates|automations\/[^/]+)(?:\/|$))/.test(path);

export function DashboardResumeRefresh() {
  const { isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();
  const phone = useBrowserPhone();
  const mutations = useIsMutating();
  const uploads = useSyncExternalStore(subscribeUploadNavigationProtection, hasUploadsProtectedFromNavigation);
  const busy = uploads || Boolean(phone.active || phone.busy || phone.outgoingPhase !== 'idle' || phone.session?.offers.length) || mutations > 0;
  const [reason, setReason] = useState<ResumeRefreshReason>(null);
  const monitor = useRef<ReturnType<typeof watchDashboardResume>>();
  const protection = useRef<() => boolean>(() => false);
  const draft = useRef<() => boolean>(() => false);
  protection.current = () => hasUploadsProtectedFromNavigation()
    || busy;
  draft.current = () => isDraftWorkspace(pathname)
    || Boolean(document.querySelector('[role="dialog"], [role="alertdialog"], form, [contenteditable="true"]'));

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const watcher = watchDashboardResume({
      isWorkProtected: () => protection.current(),
      hasDraft: () => draft.current(),
      onDeferred: setReason,
      reload: () => window.location.reload(),
    });
    monitor.current = watcher;
    return () => { watcher.stop(); monitor.current = undefined; };
  }, [isAuthenticated, user?.id]);

  useEffect(() => { monitor.current?.routeChanged(); }, [pathname]);

  if (!reason) return null;
  return <div role="status" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-3 py-2 text-xs">
    <span>{reason === 'offline'
      ? 'Welcome back. The dashboard will refresh when you are online.'
      : 'Welcome back. A refresh is ready. Save any changes and finish uploads or calls before refreshing.'}</span>
    {reason === 'work' && <button type="button" disabled={busy} className="shrink-0 font-medium underline underline-offset-2 disabled:opacity-50" onClick={() => {
      if (window.confirm('Refresh the dashboard? Save your changes first. Unsaved changes may be lost.')) monitor.current?.refreshNow();
    }}>Refresh dashboard</button>}
  </div>;
}
