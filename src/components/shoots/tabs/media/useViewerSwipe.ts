import { useRef, type TouchEvent } from 'react';

/** Horizontal single-finger navigation only at fit zoom; zoomed gestures remain pan. */
export function useViewerSwipe(enabled: boolean, previous: () => void, next: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart(event: TouchEvent) {
      start.current = enabled && event.touches.length === 1
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    },
    onTouchCancel() { start.current = null; },
    onTouchEnd(event: TouchEvent) {
      const from = start.current;
      start.current = null;
      if (!enabled || !from || event.touches.length || !event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - from.x;
      const dy = event.changedTouches[0].clientY - from.y;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx > 0) previous(); else next();
    },
  };
}
