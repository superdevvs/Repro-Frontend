import { useRef, useState, type MutableRefObject } from 'react';
import type { Call, TelnyxRTC } from '@telnyx/webrtc';
import type { BrowserPhoneActiveCall, BrowserPhoneContextValue } from '@/context/BrowserPhoneContext';
import type { VoiceBrowserSession } from '@/types/voiceBrowser';
import * as api from '@/services/voiceBrowser';
import { claimIncomingVoiceOffer } from '@/services/voice';
import { closeVoicePushOffer } from '@/services/voicePush';
import { matchesBrowserOffer } from './browserPhoneIdentity';

interface Runtime {
  rtc: MutableRefObject<TelnyxRTC | null>;
  sdkCall: MutableRefObject<Call | null>;
  sessionRef: MutableRefObject<VoiceBrowserSession | null>;
  activeRef: MutableRefObject<BrowserPhoneActiveCall | null>;
  eligibleRef: MutableRefObject<boolean>;
  epoch: MutableRefObject<number>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  run: <T>(operation: () => Promise<T>) => Promise<T>;
  sync: () => Promise<VoiceBrowserSession | null>;
  invalidate: () => void;
  playAudio: () => Promise<void>;
  inputId: string;
  outputId: string;
  setError: (error: string | null) => void;
}
interface Pending { key: string; kind: 'outbound' | 'incoming'; cancelled: boolean; dispatched: boolean; callId?: number; offerId?: string; epoch?: number }
const delay = () => new Promise<void>((resolve) => window.setTimeout(resolve, 150));

export function useBrowserPhoneStart(runtime: Runtime): Pick<BrowserPhoneContextValue, 'startHuman' | 'answerIncoming' | 'cancelPending' | 'outgoingPhase'> {
  const [outgoingPhase, setPhase] = useState<BrowserPhoneContextValue['outgoingPhase']>('idle');
  const pending = useRef<Pending | null>(null);
  const check = (operation: Pending) => {
    if (operation.cancelled || pending.current !== operation || !runtime.eligibleRef.current || (operation.epoch !== undefined && operation.epoch !== runtime.epoch.current)) throw new Error('The call request was cancelled.');
  };
  const ready = async (operation: Pending) => {
    setPhase('connecting');
    await runtime.connect();
    operation.epoch = runtime.epoch.current;
    const until = Date.now() + 30000;
    while (!runtime.sessionRef.current?.registered || !runtime.rtc.current?.connected) {
      check(operation);
      if (Date.now() >= until) throw new Error('Could not verify the browser phone connection. Try again when the phone is ready.');
      await delay();
    }
    check(operation);
    if (runtime.activeRef.current || runtime.sessionRef.current.offers.length) throw new Error('Finish the current call invitation before starting another.');
    return runtime.sessionRef.current;
  };
  const acceptMatching = async (operation: Pending, id: number) => {
    operation.callId = id;
    setPhase('answering');
    const until = Date.now() + 30000;
    await runtime.sync();
    while (Date.now() < until) {
      check(operation);
      const active = runtime.activeRef.current;
      const call = runtime.sdkCall.current;
      if (active && active.offer.voice_call_id !== id) throw new Error('Another call is already on this browser phone.');
      if (active?.offer.voice_call_id === id && active.offer.role === 'agent' && call && matchesBrowserOffer(active.offer, call.telnyxIDs.telnyxCallControlId)) {
        const latest = await runtime.sync();
        check(operation);
        if (!latest?.registered || !latest.offers.some((offer) => offer.voice_call_id === id && offer.role === 'agent' && matchesBrowserOffer(offer, call.telnyxIDs.telnyxCallControlId))) throw new Error('This call invitation is no longer available.');
        if (runtime.inputId) await runtime.rtc.current?.setAudioSettings({ micId: runtime.inputId });
        if (runtime.outputId && runtime.rtc.current) runtime.rtc.current.speaker = runtime.outputId;
        check(operation);
        if (call.state !== 'active') await call.answer();
        await runtime.playAudio();
        runtime.invalidate();
        return;
      }
      await delay();
    }
    throw new Error('The call did not reach this browser. Your pending call is being cancelled.');
  };
  const cancel = async (operation: Pending) => {
    operation.cancelled = true;
    setPhase('cancelling');
    try {
      if (operation.dispatched && operation.kind === 'outbound') await api.cancelHumanVoiceCall(operation.key);
      else if (operation.dispatched && operation.offerId) await api.cancelIncomingVoiceClaim(operation.offerId, operation.key);
    } catch (cause) {
      const http = cause as { response?: { status?: number } };
      if (operation.kind === 'incoming' && http.response?.status === 409 && operation.callId) {
        const state = await api.getVoiceBrowserCallState(operation.callId);
        if (['active', 'ended', 'failed'].includes(state.state)) {
          if (pending.current === operation) pending.current = null;
          if (!pending.current) setPhase('idle');
          throw new Error(state.state === 'active' ? 'The caller is already connected. Use End call to finish.' : 'This call has already ended.');
        }
      }
      throw cause;
    }
    if (!runtime.activeRef.current && !operation.dispatched) await runtime.disconnect();
    if (runtime.activeRef.current?.offer.voice_call_id === operation.callId) await runtime.sdkCall.current?.hangup().catch(() => undefined);
    if (pending.current === operation) pending.current = null;
    if (!pending.current) setPhase('idle');
  };
  const perform = async <T,>(kind: Pending['kind'], work: (operation: Pending) => Promise<T>): Promise<T> => {
    if (pending.current) throw new Error('Cancel the previous call request before trying again.');
    const operation: Pending = { key: crypto.randomUUID(), kind, cancelled: false, dispatched: false };
    pending.current = operation;
    try { return await work(operation); }
    catch (cause) {
      if (operation.dispatched && pending.current === operation) {
        try { await cancel(operation); }
        catch { runtime.setError('Could not confirm cancellation. Use Cancel again before placing another call.'); throw new Error('Could not confirm cancellation. Use Cancel again before placing another call.'); }
      }
      throw cause;
    } finally {
      if (pending.current === operation && !operation.cancelled) { pending.current = null; setPhase('idle'); }
    }
  };
  return {
    outgoingPhase,
    startHuman: (payload) => runtime.run(() => perform('outbound', async (operation) => {
      const session = await ready(operation);
      check(operation); setPhase('dialing'); operation.dispatched = true;
      const call = await api.startHumanVoiceCall({ ...payload, session_id: session.id, idempotency_key: operation.key });
      check(operation);
      await acceptMatching(operation, call.id);
      return call;
    })),
    answerIncoming: (offerId) => runtime.run(() => perform('incoming', async (operation) => {
      operation.offerId = offerId;
      const session = await ready(operation);
      check(operation); setPhase('dialing'); operation.dispatched = true;
      const state = await claimIncomingVoiceOffer(offerId, { session_id: String(session.id), idempotency_key: operation.key, device: 'browser' });
      check(operation);
      await closeVoicePushOffer(offerId).catch(() => undefined);
      await acceptMatching(operation, state.voice_call_id);
    })),
    cancelPending: async () => {
      const operation = pending.current;
      if (!operation) return;
      try { await cancel(operation); }
      catch (cause) { runtime.setError(cause instanceof Error ? cause.message : 'Could not cancel the pending call. Try again.'); throw cause; }
    },
  };
}
