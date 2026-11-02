import { useEffect, useState } from 'react';
import type { PickerCheckStatus } from './usePhotographerPickerAvailability';

export function usePhotographerRoster<T>(active: boolean, scope: string, load: (signal?: AbortSignal) => Promise<T[]>) {
  const [attempt, setAttempt] = useState(0);
  const key = active ? `${scope}:${attempt}` : '';
  const [result, setResult] = useState<{ key: string; scope: string; data: T[]; status: PickerCheckStatus; error?: string }>({ key: '', scope: '', data: [], status: 'idle' });
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let current = true;
    setResult(previous => ({ key, scope, data: previous.scope === scope ? previous.data : [], status: 'loading' }));
    const timeout = window.setTimeout(() => {
      current = false;
      controller.abort();
      setResult(previous => ({ key, scope, data: previous.key === key ? previous.data : [], status: 'error', error: 'Photographer lookup timed out. Please retry.' }));
    }, 25000);
    void load(controller.signal).then(data => {
      if (current) setResult({ key, scope, data, status: 'ready' });
    }).catch(() => {
      if (current) setResult(previous => ({ key, scope, data: previous.key === key ? previous.data : [], status: 'error', error: 'Unable to load photographers. Please retry.' }));
    }).finally(() => window.clearTimeout(timeout));
    return () => { current = false; controller.abort(); window.clearTimeout(timeout); };
  }, [key, scope, load]);
  const status: PickerCheckStatus = !key ? 'idle' : result.key === key ? result.status : 'loading';
  return { photographers: result.key === key ? result.data : [], status, error: result.error, retry: () => setAttempt(value => value + 1) };
}
