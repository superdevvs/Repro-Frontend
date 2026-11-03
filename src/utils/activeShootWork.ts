import { extractLocalYmd, getShootLocalDate } from './shootLocalDate';
import { getShootSchedule } from './shootSchedule';

export interface ActiveShootWorkFields {
  hasActiveWork?: boolean;
  has_active_work?: boolean;
  displayStatus?: string | null;
  display_status?: string | null;
  activeWorkAt?: string | null;
  active_work_at?: string | null;
  activeWorkDate?: string | null;
  activeWorkTime?: string | null;
  active_work_time?: string | null;
  active_work_date?: string | null;
  activeWorkStartedAt?: string | null;
  active_work_started_at?: string | null;
  activeWorkCompletedAt?: string | null;
  active_work_completed_at?: string | null;
}

export const normalizeActiveShootWork = (value: unknown): ActiveShootWorkFields => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const read = (camel: string, snake: string): string | null => {
    const field = source[camel] ?? source[snake];
    return typeof field === 'string' && field.trim() ? field : null;
  };
  return {
    hasActiveWork: typeof (source.hasActiveWork ?? source.has_active_work) === 'boolean'
      ? (source.hasActiveWork ?? source.has_active_work) as boolean : undefined,
    displayStatus: read('displayStatus', 'display_status'),
    activeWorkAt: read('activeWorkAt', 'active_work_at'),
    activeWorkDate: read('activeWorkDate', 'active_work_date'),
    activeWorkTime: read('activeWorkTime', 'active_work_time'),
    activeWorkStartedAt: read('activeWorkStartedAt', 'active_work_started_at'),
    activeWorkCompletedAt: read('activeWorkCompletedAt', 'active_work_completed_at'),
  };
};

type WorkSource = ActiveShootWorkFields & {
  status?: string | null;
  workflowStatus?: string | null;
  workflow_status?: string | null;
  scheduledDate?: string | null;
  scheduled_date?: string | null;
  scheduledAt?: string | null;
  scheduled_at?: string | null;
  time?: string | null;
  timezone?: string | null;
};

export const hasActiveShootWork = (shoot: WorkSource): boolean => {
  const explicit = shoot.hasActiveWork ?? shoot.has_active_work;
  if (typeof explicit === 'boolean') return explicit;
  const display = shoot.displayStatus ?? shoot.display_status;
  return display ? display === 'active'
    : (shoot.workflowStatus ?? shoot.workflow_status ?? shoot.status) === 'active';
};

/** Card wording is independent of the current service production stage. */
export const getShootDisplayStatus = (shoot: WorkSource): string =>
  hasActiveShootWork(shoot) ? 'active'
    : shoot.workflowStatus || shoot.workflow_status || shoot.status || '';

/** Operational views follow outstanding work while booking/history fields stay intact. */
export const getShootOperationalDate = (shoot: WorkSource): string | null => {
  if (hasActiveShootWork(shoot)) {
    const direct = extractLocalYmd(shoot.activeWorkDate ?? shoot.active_work_date);
    if (direct) return direct;
    const timestamp = shoot.activeWorkAt ?? shoot.active_work_at
      ?? shoot.activeWorkStartedAt ?? shoot.active_work_started_at;
    const date = getShootSchedule({ scheduled_at: timestamp, timezone: shoot.timezone }).date;
    if (date) return date;
  }
  return getShootLocalDate(shoot);
};

export const getShootOperationalTime = (shoot: WorkSource): string => {
  if (!hasActiveShootWork(shoot)) return shoot.time || '';
  // The server only emits a clock for a scheduled appointment, never an added-at fallback.
  return shoot.activeWorkTime ?? shoot.active_work_time ?? '';
};

export type ServiceChangeIntent = 'new_work' | 'billing_correction';

export const canChooseServiceChangeIntent = (shoot: WorkSource): boolean =>
  hasActiveShootWork(shoot) || ['delivered', 'ready_for_client', 'admin_verified',
    'client_delivered', 'workflow_completed', 'finalized'].includes(
    (shoot.workflowStatus ?? shoot.workflow_status ?? shoot.status ?? '').toLowerCase(),
  );
