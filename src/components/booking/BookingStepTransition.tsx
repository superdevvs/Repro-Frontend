import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scrollBookingPageToTop } from '@/pages/bookShootModel';

/** Animate the existing content node so shared form state survives step changes. */
export function BookingStepTransition({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const previousStep = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const initial = previousStep.current === null;
    const direction = step > (previousStep.current ?? step) ? 1 : -1;
    const changed = !initial && step !== previousStep.current;
    previousStep.current = step;
    if (!initial && !changed) return;

    scrollBookingPageToTop();
    if (!changed || !content.current) return;
    content.current.focus({ preventScroll: true });
    if (reducedMotion || typeof content.current.animate !== 'function') return;

    const animation = content.current.animate([
      { transform: `translateX(${direction * 48}px)`, opacity: 0.65 },
      { transform: 'translateX(0)', opacity: 1 },
    ], { duration: 240, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
    return () => animation.cancel();
  }, [step, reducedMotion]);

  return <div className="min-w-0 overflow-x-clip">
    <div ref={content} role="region" aria-label={title} tabIndex={-1} className="min-w-0 outline-none">
      {children}
    </div>
  </div>;
}
