import { useCallback, useEffect, useRef, useState } from 'react';
import type { TravelConfirmation, TravelFeasibility, TravelPayload } from './types';

export function canConfirmForceSave(result: TravelFeasibility | null, payload: TravelPayload | null, requestedOnly: boolean) {
  const reasons = [...(result?.reason_codes ?? []), ...(result?.transitions ?? []).map(leg => leg.reason_code)];
  return Boolean(!requestedOnly && payload?.shoot_id && payload.action_mode === 'update'
    && result?.enabled && !result.available && result.can_force_save === true && result.force_save_confirmation_version
    && !reasons.some(reason => /overlap/.test(reason)));
}

/** A staff warning acknowledgement authorizes one save of the evaluated edit. */
export function useForceSaveConfirmation({ key, result, payload, loading, error, requestedOnly, confirmation }: {
  key: string; result: TravelFeasibility | null; payload: TravelPayload | null; loading: boolean;
  error: boolean; requestedOnly: boolean; confirmation: TravelConfirmation;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const pending = useRef<{ key: string; result: TravelFeasibility; resolve: (value: TravelConfirmation | null) => void } | null>(null);
  const latest = useRef({ key, result, payload, loading, error, requestedOnly, confirmation });
  latest.current = { key, result, payload, loading, error, requestedOnly, confirmation };
  const canForceSave = !loading && !error && canConfirmForceSave(result, payload, requestedOnly);
  const cancel = useCallback(() => {
    const request = pending.current; pending.current = null;
    setOpen(false); setReason(''); request?.resolve(null);
  }, []);
  useEffect(() => {
    const request = pending.current;
    if (request && (request.key !== key || request.result !== result || loading || error || requestedOnly)) cancel();
  }, [key, result, loading, error, requestedOnly, cancel]);
  useEffect(() => () => { pending.current?.resolve(null); pending.current = null; }, []);
  const confirmForceSave = useCallback(async (): Promise<TravelConfirmation | null> => {
    const current = latest.current;
    if (pending.current || current.loading || current.error
      || !canConfirmForceSave(current.result, current.payload, current.requestedOnly)) return null;
    setReason(''); setOpen(true);
    return new Promise(resolve => { pending.current = { key: current.key, result: current.result!, resolve }; });
  }, []);
  const complete = useCallback(() => {
    const request = pending.current; const current = latest.current;
    if (!request || request.key !== current.key || request.result !== current.result || current.loading || current.error
      || !canConfirmForceSave(current.result, current.payload, current.requestedOnly)
      || reason.trim().length < 5 || reason.trim().length > 500) return;
    pending.current = null; setOpen(false); setReason('');
    request.resolve({ ...current.confirmation, force_save: true, force_save_confirmed: true,
      force_save_reason: reason.trim(), force_save_confirmation_version: current.result!.force_save_confirmation_version });
  }, [reason]);
  return { canForceSave, confirmForceSave, forceSaveDialog: { open, reason, setReason, cancel, complete } };
}
