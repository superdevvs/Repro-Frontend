import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ShootData } from '@/types/shoots';
import { reviewServiceAdditions, type ServiceAdditionDraft } from './serviceAdditionReview';

type Conflict = {
  draft?: ServiceAdditionDraft;
  latest?: ShootData;
  loading?: boolean;
  message?: string;
};

export function useShootEditConflict(sessionKey: string | null, readLatest: () => Promise<ShootData | null>) {
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useLayoutEffect(() => {
    setConflict(null);
    return invalidate;
  }, [invalidate, sessionKey]);

  const review = async () => {
    if (!conflict || !sessionKey) return;
    const request = ++generation.current;
    setConflict({ draft: conflict.draft, loading: true });
    try {
      const latest = await readLatest();
      if (request !== generation.current) return;
      if (!latest || String(latest.id) !== sessionKey) throw new Error('Could not load this booking');
      setConflict({ draft: conflict.draft, latest });
    } catch {
      if (request === generation.current) {
        setConflict({ draft: conflict.draft, message: 'Could not load the latest booking. Your draft is still here.' });
      }
    }
  };
  const clear = () => {
    generation.current++;
    setConflict(null);
  };
  return {
    conflict, review, clear, generation,
    start: (draft?: ServiceAdditionDraft, message?: string) => setConflict({ draft, message }),
    comparison: conflict?.latest ? reviewServiceAdditions(conflict.draft, conflict.latest) : undefined,
  };
}
