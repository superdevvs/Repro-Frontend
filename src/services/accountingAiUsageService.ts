import { apiClient } from '@/services/api';

export interface AiUsageTotals {
  metered_calls: number; historical_calls: number; failed_calls: number; unconfirmed_calls: number;
  input_tokens: number; cached_tokens: number; output_tokens: number; unknown_token_calls: number;
  estimated_cost_usd: number | null; unpriced_calls: number;
}
export interface AccountingAiUsage {
  start: string; end: string; timezone: string; currency: string; summary: AiUsageTotals;
  daily: (AiUsageTotals & { date: string })[];
  features: (AiUsageTotals & { feature: string; label: string })[];
  models: (AiUsageTotals & { model: string })[];
  metering_enabled: boolean; first_metered_call_at: string | null; pricing_version: string;
  scope_note: string; cost_note: string; history_note: string;
}
export async function fetchAccountingAiUsage(start: string, end: string, signal?: AbortSignal): Promise<AccountingAiUsage> {
  return (await apiClient.get<{ data: AccountingAiUsage }>('/admin/accounting-ai-usage', { params: { start, end }, signal })).data.data;
}
