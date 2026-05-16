export interface VoiceCaller {
  id?: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface VoiceCall {
  id: number;
  direction: 'INBOUND' | 'OUTBOUND' | string;
  status: string;
  disposition?: string | null;
  intent?: string | null;
  menu_digit?: string | null;
  escalation_reason?: string | null;
  callback_status?: string | null;
  from_phone?: string | null;
  to_phone?: string | null;
  assistant_id?: string | null;
  call_control_id?: string | null;
  telnyx_conversation_id?: string | null;
  duration_seconds?: number | null;
  recording_url?: string | null;
  recording_consent_given?: boolean;
  transcript?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  started_at?: string | null;
  ended_at?: string | null;
  verified_at?: string | null;
  callback_requested_at?: string | null;
  preferred_callback_at?: string | null;
  scheduled_voice_call_id?: number | null;
  last_telnyx_command_status?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  caller_user?: VoiceCaller | null;
  callerUser?: VoiceCaller | null;
  caller_contact?: VoiceCaller | null;
  callerContact?: VoiceCaller | null;
  related_shoot?: Record<string, unknown> | null;
  relatedShoot?: Record<string, unknown> | null;
  scheduled_callback?: ScheduledVoiceCall | null;
  scheduledCallback?: ScheduledVoiceCall | null;
}

export interface VoiceStatsCard {
  key: string;
  label: string;
  value: number;
  suffix?: string;
  sparkline?: Array<{ date: string; value: number }>;
}

export interface VoiceStats {
  range: string;
  cards: VoiceStatsCard[];
}

export interface VoiceNumberConfig {
  id: number;
  phone_number: string;
  label?: string | null;
  is_default?: boolean;
  voice_ai_enabled?: boolean | null;
  voice_assistant_id_override?: string | null;
  sms_ai_enabled?: boolean | null;
}

export interface VoiceSettings {
  enabled: boolean;
  assistant_id?: string | null;
  webhook_url?: string | null;
  recording_enabled: boolean;
  support_handoff_number?: string | null;
  allow_unverified_transfer: boolean;
  disclosure_text?: string | null;
  gather_prompt?: string | null;
  quiet_hours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
  callback_retry_delay_minutes?: number;
  callback_max_attempts?: number;
  automation_toggles?: Record<string, boolean>;
  debug_capture?: boolean;
}

export interface VoiceCallListResponse {
  data: VoiceCall[];
  current_page?: number;
  last_page?: number;
  total?: number;
}

export interface ScheduledVoiceCall {
  id: number;
  status: string;
  automation_type?: string | null;
  reason?: string | null;
  target_phone: string;
  from_phone?: string | null;
  caller_user_id?: number | null;
  caller_contact_id?: number | null;
  related_shoot_id?: number | null;
  related_invoice_id?: number | null;
  original_voice_call_id?: number | null;
  result_voice_call_id?: number | null;
  scheduled_at?: string | null;
  next_attempt_at?: string | null;
  last_attempt_at?: string | null;
  completed_at?: string | null;
  attempts: number;
  max_attempts: number;
  quiet_hours?: Record<string, unknown> | null;
  summary?: string | null;
  last_error?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  caller_user?: VoiceCaller | null;
  callerUser?: VoiceCaller | null;
  caller_contact?: VoiceCaller | null;
  callerContact?: VoiceCaller | null;
  original_voice_call?: VoiceCall | null;
  originalVoiceCall?: VoiceCall | null;
}

export interface ScheduledVoiceCallListResponse {
  data: ScheduledVoiceCall[];
  current_page?: number;
  last_page?: number;
  total?: number;
}
