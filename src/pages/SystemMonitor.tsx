import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { hasMonitorRole } from '@/features/server-monitor/client';
import { isSystemMonitorUnlocked } from '@/pages/settings/useHiddenSystemMonitor';

export default function SystemMonitor() {
  const { user, role, isImpersonating } = useAuth();
  const [searchParams] = useSearchParams();
  if (isImpersonating || !hasMonitorRole(role || user?.role, user?.secondary_roles)) return <Navigate to="/settings" replace />;
  const destination = new URLSearchParams(searchParams);
  destination.set('tab', isSystemMonitorUnlocked(user?.id) ? 'overview' : 'account');
  return <Navigate to={`/settings?${destination}`} replace />;
}
