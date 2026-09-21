import { createContext, useContext } from 'react';
import type { VoiceCall } from '@/types/voice';
import type { HumanVoiceCallPayload, VoiceBrowserAction, VoiceBrowserCallState, VoiceBrowserConfig, VoiceBrowserOffer, VoiceBrowserSession, VoiceSupervisorMode } from '@/types/voiceBrowser';

export interface BrowserPhoneActiveCall {
  offer: VoiceBrowserOffer;
  state: string;
  muted: boolean;
  held: boolean;
  server?: VoiceBrowserCallState;
}
export interface BrowserPhoneContextValue {
  status: 'disconnected' | 'connecting' | 'ready' | 'reconnecting' | 'error';
  eligible: boolean;
  config?: VoiceBrowserConfig;
  configLoading: boolean;
  session: VoiceBrowserSession | null;
  active: BrowserPhoneActiveCall | null;
  busy: boolean;
  error: string | null;
  playbackBlocked: boolean;
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
  inputId: string;
  outputId: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  answer: () => Promise<void>;
  decline: () => Promise<void>;
  startHuman: (payload: Omit<HumanVoiceCallPayload, 'session_id' | 'idempotency_key'>) => Promise<VoiceCall>;
  takeOver: (id: number) => Promise<void>;
  supervise: (id: number, mode: VoiceSupervisorMode) => Promise<void>;
  changeMode: (mode: VoiceSupervisorMode) => Promise<void>;
  control: (action: VoiceBrowserAction, digits?: string) => Promise<void>;
  setConsent: (consented: boolean) => Promise<void>;
  setInput: (id: string) => Promise<void>;
  setOutput: (id: string) => Promise<void>;
  playAudio: () => Promise<void>;
  refreshConfig: () => void;
}
const unavailable = async (): Promise<never> => { throw new Error('Connect your browser phone first.'); };
export const BrowserPhoneContext = createContext<BrowserPhoneContextValue>({
  status: 'disconnected', eligible: false, configLoading: false, session: null, active: null,
  busy: false, error: null, playbackBlocked: false, inputs: [], outputs: [], inputId: '', outputId: '',
  connect: unavailable, disconnect: unavailable, answer: unavailable, decline: unavailable,
  startHuman: unavailable, takeOver: unavailable, supervise: unavailable, changeMode: unavailable,
  control: unavailable, setConsent: unavailable, setInput: unavailable, setOutput: unavailable, playAudio: unavailable, refreshConfig: () => undefined,
});
export const useBrowserPhone = () => useContext(BrowserPhoneContext);
