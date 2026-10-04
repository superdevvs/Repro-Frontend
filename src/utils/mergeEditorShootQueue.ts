import type { DashboardShootSummary } from '@/types/dashboard';
import type { EditorTaskSummary } from '@/hooks/useEditorEditingTasks';

/** Assignments share the regular calendar queue, without duplicating a shoot. */
export function mergeEditorShootQueue(shoots: DashboardShootSummary[], tasks: EditorTaskSummary[]): DashboardShootSummary[] {
  const merged = new Map(shoots.map(shoot => [shoot.id, shoot]));
  for (const task of tasks) {
    if (!task.shoot) continue;
    merged.set(task.shoot_id, { ...merged.get(task.shoot_id), ...task.shoot,
      hasPendingEditorWork: true, hasScopedEditingTasks: true });
  }
  return [...merged.values()].map(shoot => ({ ...shoot, dayLabel: shoot.scheduledLocalDate || shoot.dayLabel })).sort((a, b) =>
    (a.scheduledInstant ?? a.startTime ?? '').localeCompare(b.scheduledInstant ?? b.startTime ?? '') || a.id - b.id);
}
