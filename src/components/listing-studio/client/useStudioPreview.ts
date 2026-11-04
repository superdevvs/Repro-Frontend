import { useEffect, useState } from 'react';
import { listingStudioClient } from '@/services/listingStudioClientService';

/** Protected media stays in revocable object URLs, scoped to the signed-in client. */
export function useStudioPreview(accountId: string, orderId: string, variant: 'original' | 'result', available: boolean, attempt = 0, version?: string) {
  const [state, setState] = useState({ url: '', failed: false });
  useEffect(() => {
    const abort = new AbortController(); let url = ''; let active = true;
    setState({ url: '', failed: false });
    if (available) void listingStudioClient.preview(orderId, variant, abort.signal, version).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob); setState({ url, failed: false });
    }).catch(() => { if (active) setState({ url: '', failed: true }); });
    return () => { active = false; abort.abort(); if (url) URL.revokeObjectURL(url); };
  }, [accountId, orderId, variant, available, attempt, version]);
  return state;
}
