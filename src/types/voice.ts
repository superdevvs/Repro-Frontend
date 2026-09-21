export interface VoiceCaller {
  id?: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface VoiceRelatedShoot {
  id: number;
  address?: string | null;
  status?: string | null;
  scheduled_at?: string | null;
  photographer?: VoiceCaller | null;
}

export interface VoiceWrapUpTask {
  id?: number;
  status?: 'open' | 'completed';
  title: string;
  due_at?: string | null;
  assigned_to_user_id?: number | null;
  related_shoot_id?: number | null;
  scheduled_voice_call_id?: number | null;
  created_at?: string;
}

export interface VoiceWrapUpSms {
  status?: 'draft' | 'sent' | 'failed' | 'blocked' | 'uncertain';
  error?: string | null;
  body?: string | null;
  sent_at?: string | null;
  drafted_at?: string | null;
  message_id?: number | null;
}

export interface VoiceWrapUp {
  recap_title?: string | null;
  recap_body?: string | null;
  outcome?: string | null;
  task?: VoiceWrapUpTask | null;
  sms?: VoiceWrapUpSms | null;
  saved_at?: string | null;
  saved_by?: number | null;
  sms_sent?: boolean;
}

export interface VoiceCallNote {
  body: string;
  user_id?: number | null;
  user_name?: string | null;
  at: string;
}

export interface VoiceWrapUpPayload {
  idempotency_key?: string;
  task_status?: 'open' | 'completed';
  recap_title?: string;
  recap_body?: string;
  outcome?: string;
  create_task?: boolean;
  task_title?: string;
  task_due_at?: string | null;
  attach_shoot?: boolean;
  send_sms?: boolean;
  sms_body?: string;
}

export interface VoiceInsightsReport {
  range: string;
  answered_rate: number | null;
  answered_rate_delta: number | null;
  median_answer_seconds: number | null;
  median_answer_delta: number | null;
  bookings_from_calls: number;
  bookings_delta: number | null;
  missed_recovered_rate: number | null;
  missed_recovered_delta: number | null;
  inbound_total: number;
  volume_by_day: Array<{ date: string; label: string; team: number; ai: number; missed: number; total: number }>;
  intents: Array<{ key: string; label: string; count: number; pct: number }>;
  handoff_connected_rate: number | null;
  handoffs_needing_callback: number;
  opportunity?: { title: string; detail: string } | null;
  updated_at: string;
}

export interface VoiceCall {
  wrap_up_result?: {
    operation_id: number | string;
    sms_status: 'draft' | 'sent' | 'blocked' | 'failed' | 'uncertain';
    sms_sent: boolean;
    error?: string | null;
  };
  id: number;
  provider?: string | null;
  vapi_call_id?: string | null;
  vapi_phone_number_id?: string | null;
  direction: 'INBOUND' | 'OUTBOUND' | string;
  status: string;
  handled_by?: 'ai' | 'human' | 'mixed' | 'unanswered' | string | null;
  disposition?: string | null;
  intent?: string | null;
  menu_digit?: string | null;
  escalation_reason?: string | null;
  callback_status?: string | null;
  external_provider_status?: string | null;
  provider_event_last_seen_at?: string | null;
  vapi_ended_reason?: string | null;
  telnyx_failure_code?: string | null;
  carrier_failure_reason?: string | null;
  ai_current_state?: string | null;
  ai_current_speaker?: string | null;
  live_transcript_preview?: string | null;
  from_phone?: string | null;
  to_phone?: string | null;
  assistant_id?: string | null;
  call_control_id?: string | null;
  telnyx_conversation_id?: string | null;
  duration_seconds?: number | null;
  recording_url?: string | null;
  recording_provider?: string | null;
  recording_consent_given?: boolean;
  transcript?: string | null;
  summary?: string | null;
  sentiment?: string | null;
  booking_probability?: string | null;
  needs_follow_up?: boolean | null;
  summary_generated_at?: string | null;
  metadata?: Record<string, unknown> | null;
  started_at?: string | null;
  answered_at?: string | null;
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
  related_shoot?: VoiceRelatedShoot | null;
  relatedShoot?: VoiceRelatedShoot | null;
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

export type VoiceOutboundMode = 'all' | 'canary' | 'none';

export interface VoiceSettings {
  provider?: 'telnyx' | 'vapi' | string;
  outbound_mode?: VoiceOutboundMode;
  canary_mode?: boolean;
  canary_numbers?: string[];
  enabled: boolean;
  assistant_id?: string | null;
  webhook_url?: string | null;
  recording_enabled: boolean;
  support_handoff_number?: string | null;
  allow_unverified_transfer: boolean;
  disclosure_text?: string | null;
  gather_prompt?: string | null;
  greeting_text?: string | null;
  out_of_hours_message?: string | null;
  holiday_message?: string | null;
  quiet_hours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
  business_hours?: {
    timezone?: string;
    weekly?: Record<string, Array<[string, string]>>;
  };
  holidays?: Array<{ date: string; label?: string | null }>;
  schedule_overrides?: Array<{ starts_at: string; ends_at: string; mode: 'open' | 'closed'; label?: string | null }>;
  intelligence?: {
    enabled?: boolean;
    monthly_llm_budget_usd?: number;
    auto_schedule_follow_ups?: boolean;
    triggers?: Record<string, boolean>;
    thresholds?: {
      low_confidence_pct?: number;
      silence_seconds?: number;
      sentiment_drop?: number;
      keywords?: string[];
    };
  };
  callback_retry_delay_minutes?: number;
  callback_max_attempts?: number;
  automation_toggles?: Record<string, boolean>;
  tool_allowlist?: string[];
  confirmation_gated_tools?: string[];
  debug_capture?: boolean;
}

export type ScheduleStateName =
  | 'team_open'
  | 'ai_only'
  | 'holiday_closed'
  | 'quiet_hours'
  | 'override_open'
  | 'override_closed';

export interface ScheduleState {
  state: ScheduleStateName;
  label?: string | null;
  since?: string | null;
  until?: string | null;
  next_open_at?: string | null;
  office_timezone: string;
  caller_timezone?: string | null;
  office_now?: string;
  caller_now?: string | null;
}

export interface ScheduleStateResponse {
  state: ScheduleState;
  guidance: {
    state: ScheduleStateName;
    allow_live_transfer: boolean;
    message: string;
    label?: string | null;
    next_open_at?: string | null;
  };
}

export interface VoiceScheduleOverride {
  id: number;
  starts_at: string;
  ends_at: string;
  mode: 'open' | 'closed';
  label?: string | null;
  created_by?: number | null;
  created_at?: string;
}

export interface SuggestedReply {
  label: string;
  spoken: string;
  why: string;
}

export interface VoiceInsights {
  customer_mood?: string;
  robbie_quality?: string;
  intent?: string;
  intent_confidence?: number;
  suggested_replies?: SuggestedReply[];
  next_best_action?: string;
  risk?: { type: string; score: number; why: string } | null;
  sales_opportunity?: unknown | null;
  human_takeover_recommended?: boolean;
  summary_text?: string;
  quality_score?: string;
  issue_resolved?: string;
  follow_up_at?: string | null;
  triggers?: string[];
}

export interface VoiceLiveSnapshotEvents {
  transcript: { seq: number; chunks: Array<{ seq: number; text: string; speaker: string; ts: string; telnyx_confidence?: number | null; sentiment?: string | null }> };
  realtime: { confidence?: number | null; sentiment?: string | null; interruption_rate?: number; silence_sec?: number; speaking_pace_wpm?: number; last_keyword_hit?: string | null };
  insights?: VoiceInsights | null;
  memory?: { tier1?: Record<string, unknown> | null; tier2?: Record<string, unknown> | null; tier3?: Record<string, unknown> | null };
  final_summary?: VoiceInsights | null;
}

export interface VoiceLlmUsageSummary {
  spend_usd: number;
  budget_usd: number;
  exceeded: boolean;
  remaining_usd: number;
  recent: Array<{ id: number; voice_call_id?: number | null; purpose: string; model?: string | null; input_tokens: number; output_tokens: number; cost_usd: number; created_at?: string }>;
}

export interface VoiceHealth {
  provider: 'telnyx' | 'vapi' | string;
  enabled: boolean;
  can_place_calls: boolean;
  readiness_blockers: string[];
  outbound_mode?: VoiceOutboundMode;
  canary_mode: boolean;
  canary_number_count: number;
  webhook_url_configured: boolean;
  webhook_url?: string | null;
  telnyx_carrier?: {
    status?: string | null;
    latest_event_at?: string | null;
    latest_event_type?: string | null;
  };
  telnyx_assistant?: {
    status?: string | null;
    assistant_id?: string | null;
    version_id?: string | null;
    canary_version_id?: string | null;
    canary_route_status?: string | null;
    error?: string | null;
  };
  assistant_sync?: {
    status?: string | null;
    assistant_id?: string | null;
    version_id?: string | null;
    main_version_id?: string | null;
    canary_version_id?: string | null;
    canary_route_status?: string | null;
    configured_tools?: string[];
    desired_tools?: string[];
    missing_tools?: string[];
    extra_webhook_tools?: string[];
    automatic_recording_enabled?: boolean;
    policy_instructions_current?: boolean;
    fetched_at?: string | null;
  } | null;
  vapi_assistant?: {
    status?: string | null;
    assistant_id?: string | null;
    phone_number_id?: string | null;
    latest_event_at?: string | null;
    latest_event_type?: string | null;
  } | null;
  backend_webhooks?: {
    status?: string | null;
    latest_failed_at?: string | null;
    latest_failed_error?: string | null;
  };
  last_provider_event_at?: string | null;
  latest_webhook_event?: {
    provider?: string | null;
    event_type?: string | null;
    received_at?: string | null;
    processed_at?: string | null;
    processing_error?: string | null;
  } | null;
  latest_failed_webhook?: {
    event_type?: string | null;
    received_at?: string | null;
    processing_error?: string | null;
  } | null;
  latest_command_status?: Record<string, unknown> | null;
  latest_failed_tool?: {
    tool?: string | null;
    status?: string | null;
    error_code?: string | null;
    updated_at?: string | null;
  } | null;
  scheduler?: {
    due_scheduled_calls?: number;
  };
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
