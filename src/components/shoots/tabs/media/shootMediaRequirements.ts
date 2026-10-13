import type { MediaFile } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';
import { isPreviewableImage } from './mediaPreviewUtils';
import { isExpectedRawCountExact, resolveExpectedRawCount, resolveUploadServiceExpectedCount, resolveUploadServiceTargets } from './mediaUploadUtils';

export const canSeeUploadSummaries = (role?: string | null, isClient = false) => !isClient && [
  'admin', 'superadmin', 'editing_manager', 'photographer', 'salesrep', 'rep', 'representative',
].includes(String(role ?? '').trim().toLowerCase());

export function getShootMediaRequirements(shoot: ShootData, rawFiles: MediaFile[], photographer?: { id?: string | number; role: string }) {
  // Read the booked contract in the gallery's scope. Sales reps can read these
  // counts without gaining the uploader's separate mutation permissions.
  const targets = resolveUploadServiceTargets(shoot, photographer ?? { role: 'admin' }, 'raw');
  const photos = rawFiles.filter(file => (String(file.fileType ?? '').startsWith('image/')
    || /\.(jpe?g|png|webp|heic|heif|tiff?|nef|cr2|cr3|arw|dng|raf|rw2|orf|pef|srw|3fr|iiq)$/i.test(file.filename ?? '')
    || isPreviewableImage(file))
    && !file.isExtra && file.media_type !== 'extra');
  const expected = photographer && !targets.length ? 0 : resolveExpectedRawCount(shoot, targets);
  const exact = targets.length ? isExpectedRawCountExact(targets) : expected > 0;
  const finalCount = targets.reduce((sum, target) => sum + (target.photoCount ?? 0), 0);
  const finalExact = targets.length > 0 && targets.every(target => target.photoCount !== null);
  const deficits = targets.length ? targets.reduce((sum, target) => {
    const needed = resolveUploadServiceExpectedCount(target);
    const received = photos.filter(file => String(file.shoot_service_id ?? '') === target.id).length;
    return sum + Math.max(0, (needed ?? 0) - received);
  }, 0) : Math.max(0, expected - photos.length);
  // Older uploads may predate service attribution. Count those sources without
  // letting oversupply on a known service fill another service's requirement.
  const missing = targets.length ? Math.max(0, deficits - photos.filter(file => !file.shoot_service_id).length) : deficits;
  const breakdown = targets.map(target => {
    const needed = resolveUploadServiceExpectedCount(target);
    return `${target.label}: ${needed === null ? 'count not set' : needed + ' source images'}${target.usesHdrBrackets && target.bracketMode ? ` (${target.photoCount} × ${target.bracketMode})` : ''}`;
  }).join(' · ');
  return { expected, exact, saved: photos.length, missing, finalCount, finalExact, breakdown };
}

export type ShootMediaRequirements = ReturnType<typeof getShootMediaRequirements>;

export function uploadedAgo(completedAt: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(completedAt));
  if (elapsed < 1000) return `Uploaded ${Math.floor(elapsed)} ms ago`;
  for (const [unit, size] of [['year', 365 * 86400000], ['week', 7 * 86400000], ['day', 86400000], ['hour', 3600000], ['minute', 60000], ['second', 1000]] as const) {
    if (elapsed >= size) { const n = Math.floor(elapsed / size); return `Uploaded ${n} ${unit}${n === 1 ? '' : 's'} ago`; }
  }
  return 'Uploaded just now';
}
