export type VoiceBrowserSessionId = string | number;
export type VoiceSupervisorMode = 'monitor' | 'whisper' | 'barge';
export interface VoiceBrowserConfig {
  enabled: boolean;
  ready: boolean;
  blockers: string[];
  capabilities: { human_outbound: boolean; receive_calls: boolean; takeover: boolean; monitor: boolean; whisper: boolean; barge: boolean };
}
export interface VoiceBrowserOffer {
  voice_call_id: number;
  agent_call_control_id: string;
  browser_call_control_id?: string | null;
  role: 'agent' | 'supervisor';
  mode?: VoiceSupervisorMode;
  state: string;
  caller_name?: string | null;
  remote_phone?: string | null;
}
export interface VoiceBrowserSession {
  id: VoiceBrowserSessionId;
  device_id: string;
  status: string;
  expires_at: string;
  registered: boolean;
  offers: VoiceBrowserOffer[];
}
export interface VoiceBrowserToken extends VoiceBrowserSession {
  token: string;
  registration_delay_ms?: number;
}
export interface VoiceBrowserCallState {
  voice_call_id: number;
  state: string;
  session_id?: VoiceBrowserSessionId | null;
  agent_call_control_id?: string | null;
  browser_call_control_id?: string | null;
  conference_id?: string | null;
  role?: 'agent' | 'supervisor';
  mode?: VoiceSupervisorMode;
  muted?: boolean;
  held?: boolean;
  error?: string | null;
  supervision_unavailable_reason?: string | null;
  recording?: { consent_given: boolean; active: boolean; stop_pending?: boolean; transcription_active?: boolean; transcription_pending?: boolean };
  capabilities: { can_takeover: boolean; can_monitor: boolean; can_whisper: boolean; can_barge: boolean; can_control: boolean; can_end: boolean; can_transfer: boolean; can_record?: boolean };
}
export type VoiceBrowserAction = 'mute' | 'unmute' | 'hold' | 'resume' | 'dtmf' | 'end' | 'transfer' | 'recording_start' | 'recording_stop';

export interface HumanVoiceCallPayload {
  session_id: VoiceBrowserSessionId;
  to: string;
  from?: string;
  related_shoot_id?: number;
  contact_id?: number;
  reason?: string;
  idempotency_key: string;
}
