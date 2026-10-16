import type { ShootData } from '@/types/shoots';
import { getShootServiceItems } from '@/utils/shootServiceItems';
import { resolveUploadServiceTargets } from './mediaUploadUtils';
import { resolveUploadLanesForFiles } from './uploadIntakeLanes';

type Actor = Parameters<typeof resolveUploadServiceTargets>[1];

export function rawUploadBlockReason(shoot: ShootData, actor: Actor, files: File[] = []): string | null {
  // Older shoots without execution rows retain their general upload lane.
  if (getShootServiceItems(shoot).length === 0) return null;
  const supports = (lane: 'photo' | 'video') => resolveUploadServiceTargets(shoot, actor, 'raw', [lane]).length > 0;
  if (files.length === 0) {
    return supports('photo') || supports('video') ? null
      : 'No assigned service on this shoot accepts photo or video uploads. Ask an admin to add or enable a capture service.';
  }
  const missing = resolveUploadLanesForFiles(files).find((lane) => !supports(lane));
  return missing ? `No assigned service on this shoot accepts ${missing} uploads. Ask an admin to add or enable a ${missing} service.` : null;
}
