import type { ShootData, ShootServiceObject } from '@/types/shoots';
import { getUnitServiceLines } from '@/features/shoot-units/shootUnitData';
import { canAccessOverviewVideoEmbedsOnShoot, readEditingCapabilities } from '@/utils/shootEditorAssignments';

export type VideoTourEditor = Parameters<typeof canAccessOverviewVideoEmbedsOnShoot>[1];

const assignedIds = (line: ShootServiceObject) => ({
  editor: String(line.editor_id ?? line.resolved_editor_id ?? line.editor?.id ?? ''),
  video: String(line.video_editor_id ?? line.videoEditorId ?? ''),
});

/** Unit edits use only that unit's assignments, never building-wide assignment summaries. */
export function canEditVideoTours(shoot: ShootData | null, user: VideoTourEditor, unitId?: string | number) {
  if (!shoot || String(user?.role ?? '').trim().toLowerCase() !== 'editor' || !user?.id) return false;
  const userId = String(user.id);
  const hasVideoCapability = readEditingCapabilities(user).includes('video');
  const lines = unitId == null
    ? [...(shoot.serviceItems ?? []), ...(shoot.service_items ?? []), ...(shoot.serviceObjects ?? []), ...(shoot.service_lines ?? [])]
    : getUnitServiceLines(shoot, String(unitId));
  const assignedToVideo = lines.some(line => {
    const ids = assignedIds(line);
    const intake = String(line.upload_intake_type ?? line.uploadIntakeType ?? '');
    return (ids.video === userId && intake === 'photo_video') || (ids.editor === userId && (!ids.video || ids.video === userId) && (
      intake === 'video' || hasVideoCapability
    ));
  });
  if (assignedToVideo) return true;
  return (unitId == null || lines.length > 0) && lines.every(line => !assignedIds(line).editor && !assignedIds(line).video)
    && hasVideoCapability && String(shoot.editor?.id ?? '') === userId;
}
