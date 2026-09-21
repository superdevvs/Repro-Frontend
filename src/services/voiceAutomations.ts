import { apiClient } from './api';
import type { ScheduledVoiceCall } from '@/types/voice';

export type VoiceAutomationTrigger = 'missed_call_callback' | 'failed_transfer_callback' | 'shoot_reminder' | 'delivery_follow_up' | 'unpaid_invoice_reminder';
export type VoiceAutomationCondition = { field: string; operator: 'eq' | 'gte' | 'lte'; value: string | number | boolean };
export type VoiceAutomationDraft = {
  name: string;
  trigger_type: VoiceAutomationTrigger;
  enabled: boolean;
  conditions: VoiceAutomationCondition[];
  delay_minutes: number;
  quiet_hours: { enabled: boolean; timezone: string; start: string; end: string };
  max_attempts: number;
  retry_delay_minutes: number;
  action_type: 'ai_callback' | 'internal_task';
  action_config: { task_title?: string; assigned_to_user_id?: number | null };
};
export type VoiceAutomationRule = VoiceAutomationDraft & { id: number; created_at: string; updated_at: string };
export type VoiceAutomationIndex = { rules: VoiceAutomationRule[]; managed_triggers: VoiceAutomationTrigger[]; assignees: { id: number; name: string }[] };
export type VoiceAutomationSample = { known_caller: boolean; direction: 'INBOUND' | 'OUTBOUND'; intent: string; shoot_status: string; amount_due: number; days_overdue: number; target_phone: string };
export type VoiceAutomationPreview = {
  would_run: boolean; reason: string | null; action_type: VoiceAutomationDraft['action_type']; scheduled_at: string | null;
  quiet_hours_adjusted: boolean; max_attempts: number; retry_delay_minutes: number; notice: string;
  checks: (VoiceAutomationCondition & { matched: boolean; actual: string | boolean | number | null })[];
};
export type VoiceAutomationTask = { id: number; title: string; status: 'open' | 'completed'; due_at: string; completed_at: string | null; assigned_to_user_id: number | null };
export type VoiceAutomationRun = {
  id: number; voice_automation_rule_id: number; trigger_type: VoiceAutomationTrigger; effective_status: string; reason: string | null;
  created_at: string; scheduled_at: string | null; rule_snapshot: VoiceAutomationDraft; scheduled_call: ScheduledVoiceCall | null; task: VoiceAutomationTask | null;
  context: { voice_call_id?: number; related_shoot_id?: number; related_invoice_id?: number; target_phone?: string; summary?: string };
};
export type VoiceAutomationRuns = { data: VoiceAutomationRun[]; current_page: number; last_page: number; total: number };

export const getVoiceAutomationRules = async (): Promise<VoiceAutomationIndex> => (await apiClient.get('/voice/automation-rules')).data;
export const saveVoiceAutomationRule = async ({ id, draft, creationKey }: { id?: number; draft: VoiceAutomationDraft; creationKey?: string }): Promise<VoiceAutomationRule> => {
  if (id) return (await apiClient.patch(`/voice/automation-rules/${id}`, draft)).data;
  if (!creationKey) throw new Error('A creation key is required to save this workflow safely.');
  return (await apiClient.post('/voice/automation-rules', { ...draft, idempotency_key: creationKey })).data;
};
export const toggleVoiceAutomationRule = async ({ id, enabled }: { id: number; enabled: boolean }): Promise<VoiceAutomationRule> =>
  (await apiClient.patch(`/voice/automation-rules/${id}`, { enabled })).data;
export const archiveVoiceAutomationRule = async (id: number): Promise<void> => { await apiClient.delete(`/voice/automation-rules/${id}`); };
export const previewVoiceAutomationRule = async ({ rule, sample }: { rule: VoiceAutomationDraft; sample: VoiceAutomationSample }): Promise<VoiceAutomationPreview> =>
  (await apiClient.post('/voice/automation-rules/preview', { rule, sample })).data;
export const getVoiceAutomationRuns = async (page = 1, ruleId?: number): Promise<VoiceAutomationRuns> =>
  (await apiClient.get('/voice/automation-rules/runs', { params: { page, rule_id: ruleId } })).data;
export const updateVoiceAutomationTask = async ({ id, status }: { id: number; status: 'open' | 'completed' }): Promise<VoiceAutomationTask> =>
  (await apiClient.patch(`/voice/automation-rules/tasks/${id}`, { status })).data;

export function automationError(error: unknown): string {
  const candidate = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } }; message?: string };
  const errors = candidate?.response?.data?.errors;
  return (errors && Object.values(errors).flat().join(' ')) || candidate?.response?.data?.message || candidate?.message || 'Please try again.';
}
