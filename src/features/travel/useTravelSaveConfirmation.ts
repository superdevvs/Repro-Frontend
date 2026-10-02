import { useCallback, useEffect, useRef, useState } from 'react';
import type { TravelConfirmation, TravelFeasibility } from './types';

export function canConfirmTravelException(result: TravelFeasibility | null, requestedOnly: boolean) {
  const reasons = [...(result?.reason_codes ?? []), ...(result?.transitions ?? []).map(leg => leg.reason_code)];
  return Boolean(!requestedOnly && result?.enabled && !result.available && result.can_override && result.confirmation_version
    && !reasons.some(reason => /overlap|working_hours|outside_hours/.test(reason)));
}

/** Confirmation belongs to one evaluated itinerary and resumes exactly one pending save. */
export function useTravelSaveConfirmation({ key, result, loading, blocked, requestedOnly, confirmation }: {
  key: string; result: TravelFeasibility | null; loading: boolean; blocked: boolean;
  requestedOnly: boolean; confirmation: TravelConfirmation;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const pending = useRef<{ key: string; result: TravelFeasibility; resolve: (value: TravelConfirmation | null) => void } | null>(null);
  const latest = useRef({ key, result, loading, blocked, requestedOnly, confirmation });
  latest.current = { key, result, loading, blocked, requestedOnly, confirmation };
  const cancel = useCallback(() => {
    const request = pending.current; pending.current = null;
    setOpen(false); setReason(''); request?.resolve(null);
  }, []);
  useEffect(() => { cancel(); }, [key, result, loading, blocked, requestedOnly, cancel]);
  useEffect(() => () => { pending.current?.resolve(null); pending.current = null; }, []);
  const confirmSave = useCallback(async (): Promise<TravelConfirmation | null> => {
    const current = latest.current;
    if (pending.current || current.blocked) return null;
    if (!canConfirmTravelException(current.result, current.requestedOnly)) return current.confirmation;
    setReason(''); setOpen(true);
    return new Promise(resolve => { pending.current = { key: current.key, result: current.result!, resolve }; });
  }, []);
  const complete = useCallback(() => {
    const request = pending.current; const current = latest.current;
    if (!request || request.key !== current.key || request.result !== current.result || current.loading || current.blocked
      || !canConfirmTravelException(current.result, current.requestedOnly) || reason.trim().length < 5 || reason.trim().length > 2000) return;
    pending.current = null; setOpen(false); setReason('');
    request.resolve({ ...current.confirmation, travel_override: true, travel_override_reason: reason.trim(), travel_override_confirmed: true, travel_override_confirmation_version: current.result!.confirmation_version });
  }, [reason]);
  return { confirmSave, overrideDialog: { open, reason, setReason, cancel, complete } };
}
