import { apiClient } from './api';
import type { VoiceCall } from '@/types/voice';
import type { HumanVoiceCallPayload, VoiceBrowserAction, VoiceBrowserCallState, VoiceBrowserConfig, VoiceBrowserSession, VoiceBrowserSessionId, VoiceBrowserToken, VoiceSupervisorMode } from '@/types/voiceBrowser';

export const getVoiceBrowserConfig = async (): Promise<VoiceBrowserConfig> => (await apiClient.get('/voice/browser/config')).data;
export const createVoiceBrowserSession = async (device_id: string): Promise<VoiceBrowserToken> => (await apiClient.post('/voice/browser/sessions', { device_id })).data;
export const refreshVoiceBrowserToken = async (id: VoiceBrowserSessionId, device_id: string): Promise<VoiceBrowserToken> => (await apiClient.post(`/voice/browser/sessions/${id}/token`, { device_id })).data;
export const getVoiceBrowserSession = async (id: VoiceBrowserSessionId): Promise<VoiceBrowserSession> => (await apiClient.get(`/voice/browser/sessions/${id}`)).data;
export const heartbeatVoiceBrowserSession = async (id: VoiceBrowserSessionId, registered: boolean): Promise<VoiceBrowserSession> => (await apiClient.post(`/voice/browser/sessions/${id}/heartbeat`, { registered })).data;
export const deleteVoiceBrowserSession = async (id: VoiceBrowserSessionId): Promise<void> => { await apiClient.delete(`/voice/browser/sessions/${id}`); };
export const startHumanVoiceCall = async (payload: HumanVoiceCallPayload): Promise<VoiceCall> => (await apiClient.post('/voice/calls/human', payload)).data;
export const getVoiceBrowserCallState = async (id: number): Promise<VoiceBrowserCallState> => (await apiClient.get(`/voice/calls/${id}/browser`)).data;
export const takeOverVoiceCall = async (id: number, session_id: VoiceBrowserSessionId, idempotency_key: string): Promise<VoiceBrowserCallState> => (await apiClient.post(`/voice/calls/${id}/takeover`, { session_id, idempotency_key })).data;
export const superviseVoiceCall = async (id: number, session_id: VoiceBrowserSessionId, mode: VoiceSupervisorMode, idempotency_key: string): Promise<VoiceBrowserCallState> => (await apiClient.post(`/voice/calls/${id}/supervise`, { session_id, mode, idempotency_key })).data;
export const changeVoiceSupervision = async (id: number, mode: VoiceSupervisorMode): Promise<VoiceBrowserCallState> => (await apiClient.patch(`/voice/calls/${id}/supervise`, { mode })).data;
export const leaveVoiceSupervision = async (id: number): Promise<void> => { await apiClient.delete(`/voice/calls/${id}/supervise`); };
export const performVoiceBrowserAction = async (id: number, action: VoiceBrowserAction, options: { digits?: string; to?: string; idempotency_key?: string } = {}): Promise<VoiceBrowserCallState> => (await apiClient.post(`/voice/calls/${id}/browser-actions`, { action, ...options })).data;
export const setVoiceBrowserConsent = async (id: number, consented: boolean): Promise<VoiceBrowserCallState> => (await apiClient.patch(`/voice/calls/${id}/browser-consent`, { consented })).data;
