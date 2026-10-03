import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { requestDashboardOnboardingReplay } from '@/lib/dashboardOnboardingEvents';
import { PhotographerHelpHub } from './PhotographerHelpHub';
import { usePhotographerHelpChat } from './PhotographerHelpChat';
import { getPhotographerGuide, PhotographerHelpContext, type PhotographerGuideId, type PhotographerHelpState } from './photographerHelpContext';

const UploadGuide = lazy(() => import('./PhotographerUploadGuide').then(module => ({ default: module.PhotographerUploadGuide })));
const CubiCasaGuide = lazy(() => import('./PhotographerCubiCasaGuide').then(module => ({ default: module.PhotographerCubiCasaGuide })));

interface PhotographerHelpProviderProps {
  children: ReactNode;
  enabled: boolean;
  userId?: string | number;
  bottomInset?: number;
}

/** Mount once in the authenticated shell; other roles never mount chat or guides. */
export function PhotographerHelpProvider({ children, enabled, userId, bottomInset = 0 }: PhotographerHelpProviderProps) {
  if (!enabled || userId == null) return <>{children}</>;
  return <PhotographerHelpSession key={userId} userId={userId} bottomInset={bottomInset}>{children}</PhotographerHelpSession>;
}

function PhotographerHelpSession({ children, userId, bottomInset }: { children: ReactNode; userId: string | number; bottomInset: number }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedGuide = getPhotographerGuide(params.get('guide'));
  const [active, setActive] = useState<PhotographerHelpState>(requestedGuide);
  const [tourActive, setTourActive] = useState(false);
  const previousGuide = useRef(requestedGuide);
  const chat = usePhotographerHelpChat(userId);

  useEffect(() => {
    if (requestedGuide) setActive(requestedGuide);
    else if (previousGuide.current) setActive(current => current === 'library' ? current : null);
    previousGuide.current = requestedGuide;
  }, [requestedGuide]);

  const clearGuideQuery = useCallback(() => {
    setParams(current => {
      const next = new URLSearchParams(current);
      if (getPhotographerGuide(next.get('guide'))) next.delete('guide');
      return next;
    }, { replace: true });
  }, [setParams]);

  const openHelp = useCallback(() => setActive('library'), []);
  const openGuide = useCallback((guide: PhotographerGuideId) => {
    setActive(guide);
    setParams(current => {
      const next = new URLSearchParams(current);
      next.set('guide', guide);
      return next;
    }, { replace: true });
  }, [setParams]);

  const closeHelp = () => { setActive(null); clearGuideQuery(); };
  const returnToHelp = (open: boolean) => {
    if (open) return;
    setActive('library');
    clearGuideQuery();
  };
  const startTour = () => {
    setActive(null);
    clearGuideQuery();
    requestDashboardOnboardingReplay('photographer');
    if (location.pathname !== '/dashboard') navigate('/dashboard');
  };
  const context = useMemo(() => ({ overlayOpen: active !== null, openHelp, openGuide, setTourActive }), [active, openHelp, openGuide]);

  return <PhotographerHelpContext.Provider value={context}>
    {children}
    <PhotographerHelpHub active={active} tourActive={tourActive} bottomInset={bottomInset}
      onOpen={openHelp} onClose={closeHelp} onGuide={openGuide} onTour={startTour} chat={chat} />
    <Suspense fallback={active && active !== 'library' ? <div role="status" className="fixed bottom-24 right-6 z-[70] rounded-xl border bg-background p-4 shadow-lg">Loading guide…</div> : null}>
      {active === 'uploads' && <UploadGuide open onOpenChange={returnToHelp} />}
      {active === 'cubicasa' && <CubiCasaGuide open onOpenChange={returnToHelp} />}
    </Suspense>
  </PhotographerHelpContext.Provider>;
}
