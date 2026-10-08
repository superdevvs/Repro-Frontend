import { useAuth } from '@/components/auth/AuthProvider';
import {
  flushTelemetry,
  setTelemetryAuthState,
  setTelemetryRoute,
  startTelemetryHeartbeat,
  stopTelemetryHeartbeat,
  trackTelemetryError,
  trackTelemetryRouteChange,
  trackTelemetrySessionEnd,
  trackTelemetrySessionStart,
} from '@/features/system-overview/telemetryClient';
import { useEffect, type PropsWithChildren } from 'react';
import { useLocation } from 'react-router-dom';

export function SystemTelemetryProvider({ children }: PropsWithChildren) {
  const location = useLocation();
  const { isAuthenticated, user, role } = useAuth();

  useEffect(() => {
    setTelemetryAuthState({
      isAuthenticated,
      userId: user?.id ?? null,
      role,
      name: user?.name ?? null,
    });

    if (!isAuthenticated) {
      stopTelemetryHeartbeat();
      return;
    }

    trackTelemetrySessionStart();
    startTelemetryHeartbeat();

    const handleBeforeUnload = () => {
      trackTelemetrySessionEnd();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void flushTelemetry(true);
    };

    const handleError = (event: ErrorEvent) => {
      trackTelemetryError(event.message, 'ErrorEvent', {
        kind: 'ErrorEvent',
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      trackTelemetryError(
        event.reason instanceof Error ? event.reason.message : 'Unhandled promise rejection',
        event.reason?.name ?? 'PromiseRejection',
        { kind: typeof event.reason?.name === 'string' ? event.reason.name : 'PromiseRejection' },
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      stopTelemetryHeartbeat();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      void flushTelemetry();
    };
  }, [isAuthenticated, role, user?.id, user?.name]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const nextRoute = `${location.pathname}${location.search}`;
    setTelemetryRoute(nextRoute);
    trackTelemetryRouteChange(nextRoute);
  }, [isAuthenticated, location.pathname, location.search]);

  return children;
}
