import type { NormalizedShootServiceItem } from '@/utils/shootServiceItems';
import {
  formatDateForWallClockInput,
  formatTimeForWallClockInput,
} from '@/utils/wallClockDateTime';

/**
 * Per-service status used to color the leading Status_Dot in read-only mode.
 * - `delivered`: service is delivered/ready/cancelled (finished) → green
 * - `next`: the single earliest-scheduled unfinished service → yellow
 * - `unfinished`: any other unfinished service → blue
 */
export type ServiceRowStatus = 'delivered' | 'next' | 'unfinished';

/**
 * Returns true when a service item is considered finished.
 * Ported from the (removed) OverviewServiceProgressSection finished semantics:
 * delivered / ready / cancelled in either the delivery or workflow status.
 */
const isFinished = (item: NormalizedShootServiceItem): boolean => {
  const delivery = String(item.deliveryStatus || '').toLowerCase();
  const workflow = String(item.workflowStatus || '').toLowerCase();
  return (
    delivery === 'delivered' || workflow === 'delivered' ||
    delivery === 'ready' || workflow === 'ready' ||
    delivery === 'cancelled' || workflow === 'cancelled'
  );
};

/**
 * Parses a service's scheduled date/time into a Date using wall-clock semantics.
 * Ported from the (removed) OverviewServiceProgressSection. Returns null when the
 * value is absent or unparseable so the item is excluded from Next_Service candidacy.
 */
const parseSchedule = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = formatDateForWallClockInput(value);
  const time = formatTimeForWallClockInput(value) || '00:00';
  if (!date) return null;

  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Derives a status for every service item, designating at most one `next`.
 *
 * The Next_Service is the unfinished item with the earliest parseable scheduled
 * date/time. Ties are broken by first-in-iteration-order, guaranteeing exactly
 * one `next`. Items with no parseable schedule are never `next`.
 */
export const deriveRowStatuses = (
  items: NormalizedShootServiceItem[],
): Map<string, ServiceRowStatus> => {
  const result = new Map<string, ServiceRowStatus>();

  // Earliest-scheduled unfinished service = Next_Service.
  let nextId: string | null = null;
  let nextTs = Number.POSITIVE_INFINITY;
  for (const item of items) {
    if (isFinished(item)) continue;
    const scheduled = parseSchedule(item.scheduledAt);
    if (!scheduled) continue;
    const ts = scheduled.getTime();
    // Strict `<` preserves first-in-iteration-order tie-break.
    if (ts < nextTs) {
      nextTs = ts;
      nextId = item.id;
    }
  }

  for (const item of items) {
    if (isFinished(item)) {
      result.set(item.id, 'delivered'); // green
    } else if (item.id === nextId) {
      result.set(item.id, 'next'); // yellow
    } else {
      result.set(item.id, 'unfinished'); // blue
    }
  }

  return result;
};

/**
 * Tailwind background classes for each Status_Dot color.
 */
export const STATUS_DOT_CLASS: Record<ServiceRowStatus, string> = {
  delivered: 'bg-emerald-500',
  next: 'bg-amber-400',
  unfinished: 'bg-blue-500',
};
