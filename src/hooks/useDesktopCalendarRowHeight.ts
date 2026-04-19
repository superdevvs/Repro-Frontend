import { useEffect, useRef, useState } from "react";

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
      const availableHeight = Math.floor(viewportHeight - topOffset - 2);
      if (availableHeight > 240) {
        setHeight((previous) =>
          previous === availableHeight ? previous : availableHeight
        );
      }
    };

    recalculate();
    const rafId = window.requestAnimationFrame(recalculate);
    window.addEventListener("resize", recalculate);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", recalculate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, ...deps]);

  return { ref, height };
}
