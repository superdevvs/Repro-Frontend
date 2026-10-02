import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { readTravelFeasibility, type TravelConfirmation, type TravelFeasibility, type TravelPayload } from './types';

/** One preview for the selected itinerary, never one Routes lookup per time option. */
export function useTravelFeasibility({ payload, requestedOnly = false }: { payload: TravelPayload | null; requestedOnly?: boolean }) {
  const key = payload ? JSON.stringify(payload, (field, value: unknown) => payload.shoot_id && field === 'service_lines' && Array.isArray(value) ? value.map(line => line.shoot_service_id ? line : { ...line, client_key: undefined }) : value) : '';
  const requestPayload = useRef(payload);
  requestPayload.current = payload;
  const [preview, setPreview] = useState<{ key: string; result: TravelFeasibility } | null>(null);
  const [loadingKey, setLoadingKey] = useState('');
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [override, setOverride] = useState<{ key: string; reason: string; checked: boolean }>({ key: '', reason: '', checked: false });
  const [location, setLocation] = useState<{ key: string; confirmed: boolean }>({ key: '', confirmed: false });
  const [alternativesRequested, setAlternativesRequested] = useState('');
  const active = useRef<{ key: string; controller: AbortController } | null>(null);
  const currentKey = useRef(key);
  currentKey.current = key;
  const locationConfirmed = location.key === key && location.confirmed;
  const result = preview?.key === key ? preview.result : null;
  const enabled = result?.enabled ?? featureEnabled;
  const request = useCallback(async (includeAlternatives = false, confirmed = false) => {
    if (!key || currentKey.current !== key) return;
    active.current?.controller.abort();
    const controller = new AbortController();
    active.current = { key, controller };
    setLoadingKey(key); setError(null);
    setOverride({ key: '', reason: '', checked: false });
    if (includeAlternatives) setAlternativesRequested(key);
    try {
      const response = await fetch(`${API_BASE_URL}/api/photographer/availability/feasibility`, {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...requestPayload.current, include_alternatives: includeAlternatives, ...(confirmed ? { travel_location_confirmed: true } : {}) }),
      });
      const data: unknown = await response.json();
      const next = readTravelFeasibility(data);
      if (!next || (!response.ok && response.status !== 422 && response.status !== 409)) throw new Error('Travel could not be checked. Retry before confirming the schedule.');
      if (!controller.signal.aborted && currentKey.current === key) {
        setPreview({ key, result: next }); setFeatureEnabled(next.enabled);
      }
    } catch (caught) {
      if (!controller.signal.aborted && currentKey.current === key) setError({ key, message: caught instanceof Error ? caught.message : 'Unable to check travel.' });
    } finally {
      if (active.current?.controller === controller && !controller.signal.aborted) setLoadingKey('');
    }
  }, [key]);
  useEffect(() => {
    setPreview(null); setError(null); setAlternativesRequested('');
    setOverride({ key: '', reason: '', checked: false });
    active.current?.controller.abort();
    if (!key) { setLoadingKey(''); return; }
    setLoadingKey(key);
    const timer = window.setTimeout(() => void request(false, locationConfirmed), 350);
    return () => { window.clearTimeout(timer); active.current?.controller.abort(); };
  }, [key, locationConfirmed, request]);
  const loading = Boolean(key && (loadingKey === key || (!result && error?.key !== key)));
  const overrideChecked = override.key === key && override.checked;
  const overrideReason = override.key === key ? override.reason : '';
  const validOverride = Boolean(result?.can_override && overrideChecked && overrideReason.trim().length >= 5);
  const confirmation = useMemo<TravelConfirmation>(() => ({
    ...(locationConfirmed ? { travel_location_confirmed: true } : {}),
    ...(validOverride ? { travel_override: true, travel_override_reason: overrideReason.trim() } : {}),
  }), [locationConfirmed, validOverride, overrideReason]);
  const acceptServerError = useCallback((data: unknown) => {
    if (currentKey.current !== key) return false;
    const next = readTravelFeasibility(data);
    if (!next) return false;
    active.current?.controller.abort(); setLoadingKey(''); setError(null); setPreview({ key, result: next }); setFeatureEnabled(next.enabled);
    setOverride({ key: '', checked: false, reason: '' });
    return true;
  }, [key]);
  return {
    result, enabled, loading, requestedOnly, timezone: typeof payload?.timezone === 'string' ? payload.timezone : undefined,
    error: error?.key === key ? error.message : null,
    visible: Boolean(key && (enabled || loading || error?.key === key)),
    blocked: !requestedOnly && enabled && (loading || Boolean(error?.key === key) || Boolean(result && !result.available && !validOverride)),
    confirmation, overrideChecked, overrideReason, locationConfirmed,
    setOverrideChecked: (checked: boolean) => setOverride({ key, checked, reason: overrideReason }),
    setOverrideReason: (reason: string) => setOverride({ key, checked: overrideChecked, reason }),
    setLocationConfirmed: (confirmed: boolean) => setLocation({ key, confirmed }),
    retry: () => request(false, locationConfirmed),
    loadAlternatives: () => request(true, locationConfirmed),
    alternativesRequested: alternativesRequested === key, acceptServerError,
  };
}
export type TravelController = ReturnType<typeof useTravelFeasibility>;
