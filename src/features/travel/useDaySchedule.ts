import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { readTravelFeasibility, type TravelFeasibility, type TravelPayload } from './types';
import type { DaySchedule } from './daySchedule';

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json', Accept: 'application/json' });

export function useDaySchedule(open: boolean, photographer: number, date: string, timezone: string, shootId: unknown) {
  const [state, setState] = useState<{ data?: DaySchedule; error?: string }>({});
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController(); setState({});
    const query = new URLSearchParams({ photographer_id: String(photographer), date, timezone, ...(shootId ? { shoot_id: String(shootId) } : {}) });
    void fetch(`${API_BASE_URL}/api/photographer/availability/day-schedule?${query}`, { headers: headers(), signal: abort.signal })
      .then(async response => {
        const json = await response.json();
        if (!response.ok || !Array.isArray(json.data?.bookings)) throw new Error(json.message || 'Could not load this day. Close and try again.');
        if (!abort.signal.aborted) setState({ data: json.data });
      }).catch(error => { if (!abort.signal.aborted) setState({ error: error.message }); });
    return () => abort.abort();
  }, [open, photographer, date, timezone, shootId]);
  return state;
}

export function useDayPreview(payload: TravelPayload | null, dragging: boolean) {
  const key = payload ? JSON.stringify(payload) : '';
  const [state, setState] = useState<{ key: string; result?: TravelFeasibility; error?: string }>({ key: '' });
  useEffect(() => {
    if (!key || dragging) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`${API_BASE_URL}/api/photographer/availability/feasibility`, { method: 'POST', headers: headers(), signal: abort.signal, body: key })
        .then(async response => {
          const json = await response.json(), result = readTravelFeasibility(json);
          if (!response.ok || !result) throw new Error(json.message || 'Unable to check this schedule.');
          if (!abort.signal.aborted) setState({ key, result });
        }).catch(error => { if (!abort.signal.aborted) setState({ key, error: error.message }); });
    }, 450);
    return () => { abort.abort(); window.clearTimeout(timer); };
  }, [key, dragging]);
  return { result: state.key === key ? state.result : null, error: state.key === key ? state.error : null, loading: Boolean(key && state.key !== key) || dragging };
}
