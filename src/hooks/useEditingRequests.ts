import { useCallback, useEffect, useState } from 'react';
import { registerEditingRequestsRefresh } from '@/realtime/realtimeRefreshBus';
import { 
  EditingRequest, 
  fetchEditingRequests, 
  updateEditingRequest,
  deleteEditingRequest,
  EditingRequestUpdatePayload 
} from '@/services/editingRequestService';

export function useEditingRequests(enabled: boolean) {
  const [requests, setRequests] = useState<EditingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchEditingRequests();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load requests');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      refresh();
    }
    // Only depend on enabled, not refresh, to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    return registerEditingRequestsRefresh(() => refresh());
  }, [enabled, refresh]);

  const updateRequest = useCallback(async (id: number, payload: EditingRequestUpdatePayload): Promise<void> => {
    try {
      const updated = await updateEditingRequest(id, payload);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
      );
    } catch (err) {
      throw err;
    }
  }, []);

  const removeRequest = useCallback(async (id: number) => {
    try {
      await deleteEditingRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      throw err;
    }
  }, []);

  return {
    requests: enabled ? requests : [],
    loading: enabled ? loading : false,
    error,
    refresh,
    updateRequest,
    removeRequest,
  };
}
