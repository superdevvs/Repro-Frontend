import type { DashboardShootSummary } from '@/types/dashboard';
import type { EditorTaskSummary } from '@/hooks/useEditorEditingTasks';
import { getDayLabel } from '@/utils/dashboardDerivedUtils';
import { parseLocalYmd } from '@/utils/shootLocalDate';

/** Same label shootDataToSummary uses, so a dispatched shoot shares that day group. */
const bookedDayLabel = (shoot: DashboardShootSummary): string => {
  const localDay = shoot.scheduledLocalDate ? parseLocalYmd(shoot.scheduledLocalDate) : null;
  return localDay && !Number.isNaN(localDay.getTime()) ? getDayLabel(localDay) : shoot.dayLabel;
};

/**
 * Editing-task assignments the normal /shoots queue omits join the existing
 * shoot cards. Rows already in that queue are left untouched.
 */
export function mergeEditorShootQueue(shoots: DashboardShootSummary[], tasks: EditorTaskSummary[]): DashboardShootSummary[] {
  const merged = new Map(shoots.map(shoot => [shoot.id, shoot]));
  for (const task of tasks) {
    if (!task.shoot || merged.has(task.shoot_id)) continue;
    const card: DashboardShootSummary = { ...task.shoot, id: task.shoot_id };
    delete card.hasScopedEditingTasks;
    card.dayLabel = bookedDayLabel(card);
    card.hasPendingEditorWork = card.hasPendingEditorWork ?? true;
    merged.set(task.shoot_id, card);
  }
  return [...merged.values()].sort((a, b) =>
    (a.scheduledInstant ?? a.startTime ?? '').localeCompare(b.scheduledInstant ?? b.startTime ?? '') || a.id - b.id);
}
