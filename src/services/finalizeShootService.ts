import axios from 'axios';
import { apiClient } from '@/services/api';

export type FinalizeStageKey =
  | 'queued'
  | 'commit'
  | 'local_cache'
  | 'mls_publish'
  | 'delivery_email';

export type FinalizeStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'skipped'
  | 'failed';

export interface FinalizeProgressStage {
  key: FinalizeStageKey | string;
  label: string;
  status: FinalizeStageStatus;
  message: string | null;
  processed: number | null;
  total: number | null;
  indeterminate: boolean;
}

export interface FinalizeProgressFailure {
  stage: string;
  label: string;
  error: string;
}

export interface FinalizeProgress {
  shoot_id: number;
  run_id: string;
  status: 'running' | 'completed' | 'failed';
  message: string | null;
  error: string | null;
  failures: FinalizeProgressFailure[];
  percentage: number;
  indeterminate: boolean;
  stages: FinalizeProgressStage[];
}

export interface FinalizeShootResponse {
  message?: string;
  data?: { id?: number; workflow_status?: string; queued?: boolean };
  progress?: FinalizeProgress | null;
  /** HTTP status, so callers can tell the queued (202) path from a legacy sync 200. */
  httpStatus: number;
}

/**
 * Workflow statuses that mean "delivery went through". Used by the fallback
 * poller when the progress endpoint is unavailable.
 */
export const FINALIZE_DELIVERED_STATUSES = [
  'delivered',
  'ready_for_client',
  'admin_verified',
  'client_delivered',
  'workflow_completed',
  'finalized',
];

export class FinalizeProgressUnavailableError extends Error {}

export const postFinalizeShoot = async (
  shootId: string | number,
  body: Record<string, unknown> = {},
): Promise<FinalizeShootResponse> => {
  const response = await apiClient.post(`/shoots/${shootId}/finalize`, body);

  return { ...(response.data ?? {}), httpStatus: response.status };
};

/**
 * Read the live finalize progress document. Resolves to `null` while the
 * backend has nothing tracked (expired or never started), and throws
 * `FinalizeProgressUnavailableError` when the endpoint itself cannot serve us
 * (older backend, or the caller is not allowed to read progress) so the caller
 * can fall back to plain status polling.
 */
export const fetchFinalizeProgress = async (
  shootId: string | number,
): Promise<FinalizeProgress | null> => {
  try {
    const response = await apiClient.get<{ data: FinalizeProgress | null }>(
      `/shoots/${shootId}/finalize-progress`,
    );

    return response.data?.data ?? null;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status === 401 || status === 403 || status === 404 || status === 405) {
      throw new FinalizeProgressUnavailableError('Finalize progress endpoint unavailable');
    }

    throw error;
  }
};

const readStatus = (shoot: unknown): string => {
  if (!shoot || typeof shoot !== 'object') return '';
  const record = shoot as Record<string, unknown>;
  const nested = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : record;

  return String(nested.workflowStatus ?? nested.workflow_status ?? nested.status ?? '')
    .toLowerCase()
    .trim();
};

const readWorkflowLogs = (shoot: unknown): Array<Record<string, unknown>> => {
  if (!shoot || typeof shoot !== 'object') return [];
  const record = shoot as Record<string, unknown>;
  const nested = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : record;
  const logs = nested.workflowLogs ?? nested.workflow_logs;

  return Array.isArray(logs) ? (logs as Array<Record<string, unknown>>) : [];
};

/**
 * Derive a finalize outcome from a shoot payload. Shared by the fallback
 * poller so "delivered" / "failed" is decided in exactly one place.
 */
export const readFinalizeOutcomeFromShoot = (
  shoot: unknown,
): 'delivered' | 'failed' | 'pending' => {
  if (FINALIZE_DELIVERED_STATUSES.includes(readStatus(shoot))) {
    return 'delivered';
  }

  const hasFailure = readWorkflowLogs(shoot).some(
    (log) => String(log?.action ?? '').toLowerCase() === 'finalize_failed',
  );

  return hasFailure ? 'failed' : 'pending';
};

export const fetchShootForFinalizeFallback = async (shootId: string | number): Promise<unknown> => {
  const response = await apiClient.get(`/shoots/${shootId}`);

  return response.data;
};
