import { apiClient } from './api';
export interface SipLine { number: string; label: string; receives_calls: boolean; timezone: string; weekly_hours: Record<string, {start: string; end: string}[]> }
export interface SipSmsState { number: string | null; available_numbers: string[]; ready: boolean; phone_connected: boolean; push_registered: boolean; last_fetch_at: string | null; last_send_at: string | null; setup_url: string }
export const configureSipSms = async (id: string, data: {number: string; reset_pairing?: boolean}): Promise<SipSmsState> => (await apiClient.patch(`/voice/sip/devices/${id}/sms`, data)).data;
export interface SipDevice { sms?: SipSmsState; id: string; creation_key: string; label: string; caller_id: string; state: string; enabled: boolean; registered: boolean; registration_checked_at: string | null }
export interface SipState { configured: boolean; lines: SipLine[]; devices: SipDevice[] }
export interface SipCredentials { title: string; username: string; password: string; domain: string; port: number; transport: string; media: string; caller_id: string }
export const getSipDevices = async (): Promise<SipState> => (await apiClient.get('/voice/sip/devices')).data;
export const createSipDevice = async (data: {label: string; caller_id: string; creation_key: string}): Promise<SipDevice> => (await apiClient.post('/voice/sip/devices', data)).data;
export const revealSipCredentials = async (id: string): Promise<SipCredentials> => (await apiClient.post(`/voice/sip/devices/${id}/credentials`)).data;
export const updateSipDevice = async (id: string, data: {enabled?: boolean; caller_id?: string}): Promise<SipDevice> => (await apiClient.patch(`/voice/sip/devices/${id}`, data)).data;
export const revokeSipDevice = async (id: string): Promise<void> => { await apiClient.delete(`/voice/sip/devices/${id}`); };
