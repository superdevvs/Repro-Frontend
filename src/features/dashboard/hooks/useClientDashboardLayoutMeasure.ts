import { useLayoutEffect, useRef, useState } from "react";

const DESKTOP_SHOOTS_BOTTOM_PADDING = 24;
const DESKTOP_SHOOTS_MIN_HEIGHT = 360;

export const useClientDashboardLayoutMeasure = (role: string, isMobile: boolean) => {
  const clientDesktopLeftColumnRef = useRef<HTMLDivElement | null>(null);
  const clientDesktopShootsContainerRef = useRef<HTMLDivElement | null>(null);
  const [clientDesktopShootsHeight, setClientDesktopShootsHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (role !== "client" || isMobile) {
      setClientDesktopShootsHeight(null);
      return;
    }

    let frameId = 0;
    let observer: ResizeObserver | null = null;
    const observedElements = new Set<Element>();
    let disposed = false;

    const ensureObserver = () => {
      if (!observer && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => {
          updateHeight();
        });
      }
      return observer;
    };

    const observeElement = (element: Element | null) => {
      if (!element) return;
      const obs = ensureObserver();
      if (obs && !observedElements.has(element)) {
        obs.observe(element);
        observedElements.add(element);
      }
    };

    const updateHeight = () => {
      const leftColumn = clientDesktopLeftColumnRef.current;
      const shootsContainer = clientDesktopShootsContainerRef.current;
      if (!leftColumn || !shootsContainer) {
        if (!disposed) {
          frameId = window.requestAnimationFrame(updateHeight);
        }
        return;
      }

      observeElement(leftColumn);
      observeElement(shootsContainer);

      const viewportHeight = window.innerHeight;
      const containerTop = shootsContainer.getBoundingClientRect().top;
      const availableHeight = Math.floor(
        viewportHeight - containerTop - DESKTOP_SHOOTS_BOTTOM_PADDING,
      );
      const nextHeight = Math.max(availableHeight, DESKTOP_SHOOTS_MIN_HEIGHT);
      setClientDesktopShootsHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    updateHeight();

    window.addEventListener("resize", updateHeight);
    window.addEventListener("scroll", updateHeight, { passive: true });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      observedElements.clear();
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("scroll", updateHeight);
    };
  }, [isMobile, role]);

  return {
    clientDesktopLeftColumnRef,
    clientDesktopShootsContainerRef,
    clientDesktopShootsHeight,
  };
};
