import React from 'react';
import { useLocation } from 'react-router-dom';

type ViewportState = {
  width: number;
  height: number;
};

const HIDE_DELAY_MS = 3000;

const getViewportState = (): ViewportState => ({
  width: typeof window === 'undefined' ? 0 : window.innerWidth,
  height: typeof window === 'undefined' ? 0 : window.innerHeight,
});

const getBreakpointLabel = (width: number) => {
  if (width < 768) {
    return 'Mobile';
  }

  if (width < 1280) {
    return 'Tablet';
  }

  return 'Desktop';
};

export const ResponsiveResizeIndicator: React.FC = () => {
  const [viewport, setViewport] = React.useState<ViewportState>(() => getViewportState());
  const [isVisible, setIsVisible] = React.useState(false);
  const lastWidthRef = React.useRef(viewport.width);
  const hideTimerRef = React.useRef<number | null>(null);
  const location = useLocation();
  const isDashboardRoute =
    location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/');
  const [hasOpenOverlay, setHasOpenOverlay] = React.useState(false);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const computeOverlayState = () => {
      const openDialog = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      );
      setHasOpenOverlay(Boolean(openDialog));
    };

    computeOverlayState();

    const observer = new MutationObserver(() => computeOverlayState());
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
      childList: true,
    });

    return () => observer.disconnect();
  }, [location.pathname]);

  React.useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const handleResize = () => {
      const nextViewport = getViewportState();
      const widthChanged = nextViewport.width !== lastWidthRef.current;

      setViewport(nextViewport);

      if (!widthChanged) {
        return;
      }

      lastWidthRef.current = nextViewport.width;
      setIsVisible(true);
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        setIsVisible(false);
        hideTimerRef.current = null;
      }, HIDE_DELAY_MS);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      clearHideTimer();
    };
  }, []);

  const label = getBreakpointLabel(viewport.width);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed right-6 z-[90] text-right font-sans text-[11px] leading-tight text-muted-foreground transition-all duration-300 ease-out sm:right-9 ${
        isDashboardRoute && !hasOpenOverlay
          ? 'top-20 sm:top-24'
          : 'bottom-24 sm:bottom-1'
      } ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : isDashboardRoute && !hasOpenOverlay
            ? '-translate-y-1 opacity-0'
            : 'translate-y-1 opacity-0'
      }`}
    >
      <div className="font-medium">
        <span>{label}</span>
        <span className="mx-1.5">/</span>
        <span className="tabular-nums">
          {viewport.width} × {viewport.height}
        </span>
      </div>
    </div>
  );
};

export default ResponsiveResizeIndicator;
