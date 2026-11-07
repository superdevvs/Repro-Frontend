import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppPreloader } from '@/app/AppPreloader';
import { PageLoadingContext, usePageLoading } from '@/hooks/use-page-loading';

export function DashboardStartupBoundary({ active, children }: { active: boolean; children: ReactNode }) {
  const pending = useRef(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [ready, setReady] = useState(false);
  const registry = useMemo(() => ({
    register() {
      setPendingCount(++pending.current);
      return () => setPendingCount(--pending.current);
    },
  }), []);
  const starting = active && !ready;

  useEffect(() => {
    // Descendant layout effects can register work before their state updates commit.
    if (starting && pendingCount === 0 && pending.current === 0) setReady(true);
  }, [pendingCount, starting]);

  return (
    <PageLoadingContext.Provider value={starting ? registry : null}>
      {starting && <AppPreloader />}
      {children}
    </PageLoadingContext.Provider>
  );
}

function PendingDashboardSection({ children }: { children: ReactNode }) {
  usePageLoading(true);
  return children;
}

export function DashboardSectionSuspense({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return <Suspense fallback={<PendingDashboardSection>{fallback}</PendingDashboardSection>}>{children}</Suspense>;
}
