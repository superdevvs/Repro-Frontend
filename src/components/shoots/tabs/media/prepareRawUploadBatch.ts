import { API_BASE_URL } from '@/config/env';
import { ensureUploadAttemptIdentity } from './uploadAttemptIdentity';
import { resolveUploadLaneForFile } from './uploadIntakeLanes';
import { UPLOAD_RESPONSE_TIMEOUT_MS } from './uploadMediaRequest';

export async function prepareRawUploadBatch(options: {
  shootId: string | number;
  files: File[];
  batchId: string;
  serviceId?: string | null;
  headers: Record<string, string | undefined>;
  signal?: AbortSignal;
}): Promise<1 | 2> {
  const batches = new Map<string, { total: number; lane: 'photo' | 'video' }>();
  options.files.forEach((file, index) => {
    const identity = ensureUploadAttemptIdentity(file, options.batchId, index, options.files.length);
    batches.set(identity.batchId, { total: identity.batchTotal, lane: resolveUploadLaneForFile(file) });
  });
  let concurrency: 1 | 2 = 2;
  for (const [batchId, batch] of batches) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (options.signal?.aborted) cancel();
    else options.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(cancel, UPLOAD_RESPONSE_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shoots/${options.shootId}/upload-batches`, {
      method: 'POST',
      headers: Object.fromEntries(Object.entries({ ...options.headers, Accept: 'application/json', 'Content-Type': 'application/json' })
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
      signal: controller.signal,
      body: JSON.stringify({ type: 'raw', batch_id: batchId, total_files: batch.total, service_id: options.serviceId ? Number(options.serviceId) : null, upload_lane: batch.lane }),
      });
      // Only an absent endpoint permits an older deployment's serial protocol.
      if (response.status === 404 || response.status === 405) return 1;
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Could not prepare the upload batch. Please retry.');
      if (payload?.batch_id !== batchId || ![1, 2].includes(payload?.parallel_uploads)) {
        throw new Error('The server did not confirm the upload batch. Please retry.');
      }
      concurrency = Math.min(concurrency, payload.parallel_uploads) as 1 | 2;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
    }
  }
  return concurrency;
}
