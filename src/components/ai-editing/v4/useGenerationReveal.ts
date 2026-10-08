import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';

export const GENERATION_REVEAL_MS = 4200;
export type GenerationPhase = 'working' | 'waiting' | 'revealing' | null;

/** Reveal a new, loaded result once; progress alone cannot finish a job. */
export function useGenerationReveal({ active, resultKey, resultReady, outcome, resultFailed = false }: {
  active: boolean; resultKey?: string; resultReady: boolean; outcome?: string; resultFailed?: boolean;
}): GenerationPhase {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [phase, setPhase] = useState<GenerationPhase>(active ? 'working' : null);
  const wasActive = useRef(false);
  const started = useRef(false);
  const originalResult = useRef(resultKey);

  useEffect(() => {
    if (active && !wasActive.current) {
      originalResult.current = resultKey;
      started.current = true;
    }
    wasActive.current = active;
    if (outcome === 'failed' || outcome === 'cancelled' || resultFailed) {
      started.current = false;
      setPhase(null);
      return;
    }
    if (active) { setPhase('working'); return; }
    if (!started.current || !resultKey || resultKey === originalResult.current) {
      started.current = false;
      setPhase(null);
      return;
    }
    if (!resultReady) { setPhase('waiting'); return; }
    if (reduced) { started.current = false; setPhase(null); return; }
    setPhase('revealing');
    const timer = window.setTimeout(() => { started.current = false; setPhase(null); }, GENERATION_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [active, resultKey, resultReady, outcome, resultFailed, reduced]);

  return phase;
}
