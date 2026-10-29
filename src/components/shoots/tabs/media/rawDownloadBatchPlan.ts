import type { MediaFile } from '@/hooks/useShootFiles';
import { canUseMediaDownload } from './mediaPresentationPermissions';

export const RAW_DOWNLOAD_BATCH_BYTES = 500 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 20;

export interface RawDownloadBatch {
  fileIds: string[];
  bytes: number;
  sizeKnown: boolean;
}

/** Keep original files whole and in their displayed order; never duplicate an ID. */
export function buildRawDownloadBatches(files: MediaFile[]): RawDownloadBatch[] {
  const batches: RawDownloadBatch[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (!canUseMediaDownload(file, 'editor') || file.is_hidden
      || ![null, undefined, 'clean'].includes(file.scan_status ?? file.scanStatus)
      || (file.workflowStage && file.workflowStage !== 'todo') || seen.has(String(file.id))) continue;
    seen.add(String(file.id));
    const size = Number(file.fileSize);
    const known = Number.isFinite(size) && size > 0;
    const bytes = known ? size : 0;
    let batch = batches.at(-1);
    if (!batch || batch.fileIds.length >= MAX_FILES_PER_BATCH || batch.bytes + bytes > RAW_DOWNLOAD_BATCH_BYTES) {
      batch = { fileIds: [], bytes: 0, sizeKnown: true };
      batches.push(batch);
    }
    batch.fileIds.push(String(file.id));
    batch.bytes += bytes;
    batch.sizeKnown &&= known;
  }
  return batches;
}

export const formatRawBatchSize = (batch: RawDownloadBatch): string => {
  if (!batch.sizeKnown) return 'Size unavailable';
  return batch.bytes >= 1024 ** 3
    ? `${(batch.bytes / 1024 ** 3).toFixed(1)} GB before compression`
    : `${Math.ceil(batch.bytes / 1024 ** 2)} MB before compression`;
};
