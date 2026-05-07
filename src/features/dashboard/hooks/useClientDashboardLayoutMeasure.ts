import { useLayoutEffect, useRef, useState } from "react";

export const useClientDashboardLayoutMeasure = (role: string, isMobile: boolean) => {
  const clientDesktopLeftColumnRef = useRef<HTMLDivElement | null>(null);
  const [clientDesktopShootsHeight, setClientDesktopShootsHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (role !== "client" || isMobile) {
      setClientDesktopShootsHeight(null);
      return;
    }

    let frameId = 0;
    let observer: ResizeObserver | null = null;
    let observedElement: HTMLDivElement | null = null;
    let disposed = false;

    const updateHeight = () => {
      const leftColumn = clientDesktopLeftColumnRef.current;
      if (!leftColumn) {
        if (!disposed) {
          frameId = window.requestAnimationFrame(updateHeight);
        }
        return;
      }

      if (observer && observedElement !== leftColumn) {
        observer.disconnect();
        observedElement = null;
      }

      if (!observer && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => {
          updateHeight();
        });
      }

      if (observer && observedElement !== leftColumn) {
        observer.observe(leftColumn);
        observedElement = leftColumn;
      }

      const nextHeight = Math.ceil(leftColumn.getBoundingClientRect().height);
      setClientDesktopShootsHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    updateHeight();

    window.addEventListener("resize", updateHeight);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [isMobile, role]);

  return {
    clientDesktopLeftColumnRef,
    clientDesktopShootsHeight,
  };
};
