import type { MediaFile } from '@/hooks/useShootFiles';
import { getDisplayMediaFilename } from './mediaPreviewUtils';

/** Filter an already authorized media list. Never replace the source used for uploads or permissions. */
export function filterMediaSearch(files: MediaFile[], query: string): MediaFile[] {
  const term = query.trim().toLowerCase();
  if (!term) return files;
  return files.filter(file => [getDisplayMediaFilename(file), file.id, file.fileType, file.media_type]
    .some(value => String(value ?? '').toLowerCase().includes(term)));
}
