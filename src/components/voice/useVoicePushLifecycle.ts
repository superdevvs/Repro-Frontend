import { useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/context/PermissionsContext';
import { syncVoicePushIdentity } from '@/services/voicePush';

export function useVoicePushLifecycle() {
  const { user, isAuthenticated, isImpersonating, isLoading } = useAuth();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const allowed = isAuthenticated && !isImpersonating && can('voice-calls', 'view') && can('voice-calls', 'operate');
  useEffect(() => {
    if (isLoading || permissionsLoading) return;
    void syncVoicePushIdentity(user?.id ? String(user.id) : null, allowed).catch(() => undefined);
  }, [allowed, isLoading, permissionsLoading, user?.id]);
}
