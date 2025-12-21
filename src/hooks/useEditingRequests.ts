import { useEffect, useState } from 'react';
import { EditingRequest, fetchEditingRequests } from '@/services/editingRequestService';

export function useEditingRequests(enabled: boolean) {
  const [requests, setRequests] = useState<EditingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchEditingRequests()
      .then((data) => {
        if (!isMounted) return;
        setRequests(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load requests');
        setRequests([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  return {
    requests: enabled ? requests : [],
    loading: enabled ? loading : false,
    error,
  };
}

