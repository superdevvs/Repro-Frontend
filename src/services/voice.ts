import { apiClient } from './api';
import type {
  ScheduledVoiceCall,
  ScheduledVoiceCallListResponse,
  ScheduleStateResponse,
  VoiceCall,
  VoiceCallListResponse,
  VoiceHealth,
  VoiceInsights,
  VoiceLlmUsageSummary,
  VoiceNumberConfig,
  VoiceScheduleOverride,
  VoiceSettings,
  VoiceStats,
} from '@/types/voice';

export const getVoiceStats = async (range = '7d'): Promise<VoiceStats> => {
  const response = await apiClient.get('/voice/calls/stats', { params: { range } });
  return response.data;
};

export const getVoiceCalls = async (params?: Record<string, string | number | boolean | undefined>): Promise<VoiceCallListResponse> => {
  const response = await apiClient.get('/voice/calls', { params });
  return response.data;
};

export const getVoiceCall = async (id: number): Promise<VoiceCall> => {
  const response = await apiClient.get(`/voice/calls/${id}`);
  return response.data;
};

export const placeVoiceCall = async (data: {
  to: string;
  from?: string;
  assistant_id?: string;
  assistant_mode?: string;
  source?: string;
  contact_id?: number;
  vapi_phone_number_id?: string;
  related_shoot_id?: number;
  dynamic_variables?: Record<string, unknown>;
}): Promise<VoiceCall> => {
  const response = await apiClient.post('/voice/calls/outbound', data);
  return response.data;
};

export const pageVoiceCallStaff = async (id: number, reason?: string): Promise<VoiceCall> => {
  const response = await apiClient.post(`/voice/calls/${id}/page-staff`, { reason });
  return response.data;
};

export const hangupVoiceCall = async (id: number): Promise<VoiceCall> => {
  const response = await apiClient.post(`/voice/calls/${id}/hangup`);
  return response.data;
};

export const getVoiceNumbers = async (): Promise<VoiceNumberConfig[]> => {
  const response = await apiClient.get('/voice/numbers');
  return response.data.numbers ?? [];
};

export const updateVoiceNumber = async (id: number, data: Partial<VoiceNumberConfig>): Promise<VoiceNumberConfig> => {
  const response = await apiClient.patch(`/voice/numbers/${id}`, data);
  return response.data;
};

export const getRecentVoiceHandoffs = async (): Promise<VoiceCall[]> => {
  const response = await apiClient.get('/voice/handoffs/recent');
  return response.data.handoffs ?? [];
};

export const getVoiceSettings = async (): Promise<VoiceSettings> => {
  const response = await apiClient.get('/voice/settings');
  return response.data;
};

export const getVoiceHealth = async (): Promise<VoiceHealth> => {
  const response = await apiClient.get('/voice/health');
  return response.data;
};

export const updateVoiceSettings = async (data: Partial<VoiceSettings>): Promise<VoiceSettings> => {
  const response = await apiClient.patch('/voice/settings', data);
  return response.data;
};

export const getScheduledVoiceCalls = async (params?: Record<string, string | number | boolean | undefined>): Promise<ScheduledVoiceCallListResponse> => {
  const response = await apiClient.get('/voice/scheduled-calls', { params });
  return response.data;
};

export const createScheduledVoiceCall = async (data: Partial<ScheduledVoiceCall> & { target_phone: string }): Promise<ScheduledVoiceCall> => {
  const response = await apiClient.post('/voice/scheduled-calls', data);
  return response.data;
};

export const updateScheduledVoiceCall = async (id: number, data: Partial<ScheduledVoiceCall>): Promise<ScheduledVoiceCall> => {
  const response = await apiClient.patch(`/voice/scheduled-calls/${id}`, data);
  return response.data;
};

export const cancelScheduledVoiceCall = async (id: number): Promise<ScheduledVoiceCall> => {
  const response = await apiClient.post(`/voice/scheduled-calls/${id}/cancel`);
  return response.data;
};

export const retryScheduledVoiceCall = async (id: number): Promise<ScheduledVoiceCall> => {
  const response = await apiClient.post(`/voice/scheduled-calls/${id}/retry`);
  return response.data;
};

// ---- v3: schedule, memory, intelligence, usage --------------------------

export const getScheduleState = async (callerTz?: string): Promise<ScheduleStateResponse> => {
  const response = await apiClient.get('/voice/schedule/state', {
    params: callerTz ? { caller_tz: callerTz } : undefined,
  });
  return response.data;
};

export const getScheduleOverrides = async (): Promise<VoiceScheduleOverride[]> => {
  const response = await apiClient.get('/voice/schedule/overrides');
  return response.data.overrides ?? [];
};

export const createScheduleOverride = async (data: {
  starts_at: string;
  ends_at: string;
  mode: 'open' | 'closed';
  label?: string | null;
}): Promise<VoiceScheduleOverride> => {
  const response = await apiClient.post('/voice/schedule/overrides', data);
  return response.data;
};

export const deleteScheduleOverride = async (id: number): Promise<void> => {
  await apiClient.delete(`/voice/schedule/overrides/${id}`);
};

export const getVoiceCallMemory = async (
  id: number,
  tier: 1 | 2 | 3,
): Promise<{ tier: number; memory: Record<string, unknown> | null; importance_score?: number }> => {
  const response = await apiClient.get(`/voice/calls/${id}/memory`, { params: { tier } });
  return response.data;
};

export const loadVoiceCallFullContext = async (
  id: number,
): Promise<{ tier: number; memory: Record<string, unknown> | null; all: Record<string, unknown> }> => {
  const response = await apiClient.post(`/voice/calls/${id}/memory/load-full`);
  return response.data;
};

export const markCockpitOpened = async (
  id: number,
): Promise<{ insights: VoiceInsights | null; budget_paused: boolean }> => {
  const response = await apiClient.post(`/voice/calls/${id}/cockpit-opened`);
  return response.data;
};

export const getVoiceLlmUsage = async (): Promise<VoiceLlmUsageSummary> => {
  const response = await apiClient.get('/voice/llm-usage');
  return response.data;
};
