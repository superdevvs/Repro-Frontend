import { useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Call, TelnyxRTC } from '@telnyx/webrtc';
import type { BrowserPhoneActiveCall, BrowserPhoneContextValue } from '@/context/BrowserPhoneContext';
import type { VoiceBrowserSession, VoiceSupervisorMode } from '@/types/voiceBrowser';
import * as api from '@/services/voiceBrowser';
import { matchesBrowserOffer } from './browserPhoneIdentity';

interface PhoneRuntime {
  rtc: MutableRefObject<TelnyxRTC | null>;
  sdkCall: MutableRefObject<Call | null>;
  sessionRef: MutableRefObject<VoiceBrowserSession | null>;
  activeRef: MutableRefObject<BrowserPhoneActiveCall | null>;
  status: BrowserPhoneContextValue['status'];
  eligible: boolean;
  run: <T>(operation: () => Promise<T>) => Promise<T>;
  sync: () => Promise<VoiceBrowserSession | null>;
  updateActive: (active: BrowserPhoneActiveCall | null) => void;
  invalidate: () => void;
  playAudio: () => Promise<void>;
  inputId: string;
  outputId: string;
  setInputId: Dispatch<SetStateAction<string>>;
  setOutputId: Dispatch<SetStateAction<string>>;
}

export function useBrowserPhoneActions(runtime: PhoneRuntime): Pick<BrowserPhoneContextValue, 'answer' | 'decline' | 'startHuman' | 'takeOver' | 'supervise' | 'changeMode' | 'control' | 'setConsent' | 'setInput' | 'setOutput'> {
  const operations = useRef(new Map<string, string>());
  const keyFor = (payload: unknown) => {
    const fingerprint = JSON.stringify(payload);
    if (!operations.current.has(fingerprint)) operations.current.set(fingerprint, crypto.randomUUID());
    return { fingerprint, key: operations.current.get(fingerprint)! };
  };
  const requireSession = (idle = false) => {
    const session = runtime.sessionRef.current;
    if (!runtime.eligible || runtime.status !== 'ready' || !session?.registered) throw new Error('Connect your browser phone and wait until it is ready.');
    if (idle && (runtime.activeRef.current || session.offers.length > 0)) throw new Error('Finish the current call invitation before starting another.');
    return session;
  };
  const requireCall = (allowDisconnected = false) => {
    if (allowDisconnected) {
      if (!runtime.eligible || !runtime.sessionRef.current) throw new Error('Your phone session has ended.');
    } else requireSession();
    const active = runtime.activeRef.current;
    const call = runtime.sdkCall.current;
    if (!active || !call || !matchesBrowserOffer(active.offer, call.telnyxIDs.telnyxCallControlId)) throw new Error('This call is not connected to your browser phone.');
    return { active, call };
  };
  const beginSupervision = async (id: number, mode: VoiceSupervisorMode) => {
    const session = requireSession(true);
    const state = await api.getVoiceBrowserCallState(id);
    if (!state.capabilities[`can_${mode}`]) throw new Error('This supervision mode is not available for this call.');
    const operation = keyFor({ session: session.id, id, mode });
    await api.superviseVoiceCall(id, session.id, mode, operation.key);
    operations.current.delete(operation.fingerprint);
    runtime.invalidate(); await runtime.sync().catch(() => undefined);
  };
  return {
    answer: () => runtime.run(async () => {
      const { active, call } = requireCall();
      const session = await runtime.sync();
      if (!session?.offers.some((offer) => offer.agent_call_control_id === active.offer.agent_call_control_id)) throw new Error('This call offer is no longer available.');
      if (runtime.inputId) await runtime.rtc.current?.setAudioSettings({ micId: runtime.inputId });
      if (runtime.outputId) runtime.rtc.current!.speaker = runtime.outputId;
      if (active.offer.mode === 'monitor') call.muteAudio();
      await call.answer(); await runtime.playAudio();
    }),
    decline: () => runtime.run(async () => {
      const { active, call } = requireCall();
      if (active.offer.role === 'supervisor') await api.leaveVoiceSupervision(active.offer.voice_call_id);
      await call.hangup(); runtime.invalidate();
    }),
    startHuman: (payload) => runtime.run(async () => {
      const session = requireSession(true);
      const operation = keyFor({ session: session.id, ...payload });
      const call = await api.startHumanVoiceCall({ ...payload, session_id: session.id, idempotency_key: operation.key });
      operations.current.delete(operation.fingerprint);
      runtime.invalidate(); await runtime.sync().catch(() => undefined);
      return call;
    }),
    takeOver: (id) => runtime.run(async () => {
      const session = requireSession(true);
      const state = await api.getVoiceBrowserCallState(id);
      if (!state.capabilities.can_takeover) throw new Error('Takeover is not available for this call.');
      const operation = keyFor({ session: session.id, id, action: 'takeover' });
      await api.takeOverVoiceCall(id, session.id, operation.key);
      operations.current.delete(operation.fingerprint);
      runtime.invalidate(); await runtime.sync().catch(() => undefined);
    }),
    supervise: (id, mode) => runtime.run(() => beginSupervision(id, mode)),
    changeMode: (mode) => runtime.run(async () => {
      const { active, call } = requireCall();
      if (active.offer.role !== 'supervisor') throw new Error('You are not supervising this call.');
      const state = await api.getVoiceBrowserCallState(active.offer.voice_call_id);
      if (!state.capabilities[`can_${mode}`]) throw new Error('This supervision mode is not permitted.');
      // Mute locally before a routing change, then restore only after the server confirms.
      call.muteAudio();
      runtime.updateActive({ ...active, muted: true });
      await api.changeVoiceSupervision(active.offer.voice_call_id, mode);
      if (mode !== 'monitor') call.unmuteAudio();
      runtime.updateActive({ ...active, offer: { ...active.offer, mode }, muted: mode === 'monitor' });
      await runtime.sync();
    }),
    control: (action, digits) => runtime.run(async () => {
      const { active, call } = requireCall(action === 'end');
      const id = active.offer.voice_call_id;
      if (action === 'end' && active.offer.role === 'supervisor') {
        await api.leaveVoiceSupervision(id); await call.hangup().catch(() => undefined); runtime.updateActive(null); runtime.invalidate(); return;
      }
      const state = await api.getVoiceBrowserCallState(id);
      const canStopCapture = active.offer.role === 'agent' && (state.recording?.active || state.recording?.stop_pending);
      if (active.offer.role === 'supervisor' && (action === 'mute' || action === 'unmute')) {
        const mode = active.offer.mode || 'monitor';
        if (mode === 'monitor') throw new Error('Listen mode keeps your microphone muted.');
        if (!state.capabilities[`can_${mode}`]) throw new Error('Supervision is no longer available.');
        if (action === 'mute') call.muteAudio(); else call.unmuteAudio();
        runtime.updateActive({ ...active, muted: call.isAudioMuted });
        return;
      }
      const permitted = action === 'end' ? state.capabilities.can_end : action === 'transfer' ? state.capabilities.can_transfer : action === 'recording_stop' ? canStopCapture || state.capabilities.can_record : action === 'recording_start' ? state.capabilities.can_record : state.capabilities.can_control;
      if (!permitted) throw new Error('This control is not available for your call role.');
      if (action === 'unmute' && active.offer.mode === 'monitor') throw new Error('Listen mode keeps your microphone muted.');
      if (action === 'dtmf' && (!digits || !/^[0-9*#]+$/.test(digits))) throw new Error('Use digits 0–9, * or #.');
      const destination = digits?.replace(/[\s().-]/g, '');
      if (action === 'transfer' && (!destination || !/^\+[1-9]\d{7,14}$/.test(destination))) throw new Error('Enter a full transfer number with country code.');
      const operation = action === 'transfer' ? keyFor({ id, action, to: destination }) : null;
      if (action === 'mute') call.muteAudio();
      try {
        await api.performVoiceBrowserAction(id, action, action === 'transfer' ? { to: destination, idempotency_key: operation!.key } : action === 'dtmf' ? { digits } : {});
      } catch (cause) {
        if (action.startsWith('recording_')) await runtime.sync().catch(() => undefined);
        throw cause;
      }
      if (operation) operations.current.delete(operation.fingerprint);
      if (action === 'unmute') call.unmuteAudio();
      if (action === 'end') { await call.hangup().catch(() => undefined); runtime.updateActive(null); runtime.invalidate(); return; }
      // Hold and DTMF target the customer through the conference API; issuing
      // a second SDK hold/tone would affect the wrong leg or duplicate digits.
      runtime.updateActive({ ...active, muted: call.isAudioMuted, held: action === 'hold' ? true : action === 'resume' ? false : active.held });
      runtime.invalidate(); await runtime.sync().catch(() => undefined);
    }),
    setConsent: (consented) => runtime.run(async () => {
      const { active } = requireCall();
      if (active.offer.role !== 'agent') throw new Error('Only the staff member handling this call can record caller consent.');
      try { await api.setVoiceBrowserConsent(active.offer.voice_call_id, consented); }
      finally { runtime.invalidate(); await runtime.sync().catch(() => undefined); }
    }),
    setInput: (id) => runtime.run(async () => {
      requireSession();
      if (runtime.sdkCall.current) await runtime.sdkCall.current.setAudioInDevice(id || 'default');
      else await runtime.rtc.current?.setAudioSettings({ micId: id || 'default' });
      runtime.setInputId(id);
    }),
    setOutput: (id) => runtime.run(async () => {
      requireSession();
      if (runtime.sdkCall.current) {
        const changed = await runtime.sdkCall.current.setAudioOutDevice(id || 'default');
        if (!changed) throw new Error('This browser does not support selecting a speaker.');
      } else if (runtime.rtc.current) runtime.rtc.current.speaker = id || 'default';
      runtime.setOutputId(id);
    }),
  };
}
