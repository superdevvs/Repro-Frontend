import { useEffect, useRef, useState } from "react";

/**
 * Caps the desktop Availability calendar row so it cannot overflow the
 * viewport. Primary sizing is flex-1 min-h-0 from the layout shell; this
 * maxHeight is a safety net when a parent padding/footer changes after paint.
 */
export function useDesktopCalendarRowHeight(
  isMobile: boolean,
  deps: ReadonlyArray<unknown>
): { ref: React.RefObject<HTMLDivElement>; height: number | null } {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (isMobile) {
      setHeight(null);
      return;
    }

    const recalculate = () => {
      const rowElement = ref.current;
      if (!rowElement) return;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const topOffset = rowElement.getBoundingClientRect().top;
      // Leave a small bottom inset for page padding (pb-4 ≈ 16px) so the row
      // does not paint under the viewport edge when flex math rounds up.
      const availableHeight = Math.floor(viewportHeight - topOffset - 16);
      if (availableHeight > 240) {
        setHeight((previous) =>
          previous === availableHeight ? previous : availableHeight
        );
      }
    };

    recalculate();
    const rafId = window.requestAnimationFrame(recalculate);
    window.addEventListener("resize", recalculate);
    window.visualViewport?.addEventListener("resize", recalculate);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", recalculate);
      window.visualViewport?.removeEventListener("resize", recalculate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, ...deps]);

  return { ref, height };
}
