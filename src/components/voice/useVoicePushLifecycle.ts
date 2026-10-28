import { useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/context/PermissionsContext';
import { syncVoicePushIdentity } from '@/services/voicePush';

export function useVoicePushLifecycle() {
  const { user, isAuthenticated, isImpersonating, isLoading } = useAuth();
  const { can, isLoading: permissionsLoading, hasError: permissionsUnavailable } = usePermissions();
  const allowed = isAuthenticated && !isImpersonating && can('voice-calls', 'view') && can('voice-calls', 'operate');
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || isImpersonating) {
      void syncVoicePushIdentity(null, false).catch(() => undefined);
      return;
    }
    if (permissionsLoading) return;
    // A failed lookup must not unsubscribe an enrolled device. Identity sync
    // still clears a different account; restoration rechecks server permissions.
    const reconcile = () => { void syncVoicePushIdentity(user?.id ? String(user.id) : null, allowed || permissionsUnavailable).catch(() => undefined); };
    const reconnect = (event: MessageEvent) => { if (event.data?.type === 'VOICE_PUSH_RECONNECT') reconcile(); };
    reconcile();
    window.addEventListener('online', reconcile);
    navigator.serviceWorker?.addEventListener('message', reconnect);
    return () => {
      window.removeEventListener('online', reconcile);
      navigator.serviceWorker?.removeEventListener('message', reconnect);
    };
  }, [allowed, isAuthenticated, isImpersonating, isLoading, permissionsLoading, permissionsUnavailable, user?.id]);
}
