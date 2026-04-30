import { useLayoutEffect, useRef, useState } from "react";

export const useClientDashboardLayoutMeasure = (role: string, isMobile: boolean) => {
  const clientDesktopLeftColumnRef = useRef<HTMLDivElement | null>(null);
  const [clientDesktopShootsHeight, setClientDesktopShootsHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (role !== "client" || isMobile) {
      setClientDesktopShootsHeight(null);
      return;
    }

    const leftColumn = clientDesktopLeftColumnRef.current;
    if (!leftColumn) {
      setClientDesktopShootsHeight(null);
      return;
    }

    const updateHeight = () => {
      const nextHeight = Math.ceil(leftColumn.getBoundingClientRect().height);
      setClientDesktopShootsHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    updateHeight();

    let observer: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        updateHeight();
      });
      observer.observe(leftColumn);
    }

    window.addEventListener("resize", updateHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [isMobile, role]);

  return {
    clientDesktopLeftColumnRef,
    clientDesktopShootsHeight,
  };
};
