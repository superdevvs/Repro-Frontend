import { useCallback, useEffect, useRef, useState } from 'react';
import {
  completeMessageUpload,
  createMessageUpload,
  deleteMessageUpload,
  getMessageUpload,
  putMessageUploadChunk,
} from '@/services/messageMedia';
import { normalizeApiError } from '@/services/apiError';
import { isPreviewableLocalImage, safeAttachmentName, selectAttachments } from './smsAttachments';

export type DraftAttachmentStatus = 'uploading' | 'scanning' | 'ready' | 'failed' | 'blocked';

export interface DraftAttachment {
  /** Stable for the tile's lifetime, even when the file is uploaded again. */
  key: string;
  /** Upload id on the server; a new one is issued when the file is uploaded again. */
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl?: string;
  status: DraftAttachmentStatus;
  progress: number;
  error?: string;
}

const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;
const SCAN_DEADLINE_MS = 20 * 60 * 1000;
const NO_ATTACHMENTS: DraftAttachment[] = [];

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
  const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
  signal.addEventListener('abort', abort, { once: true });
});

const uploadError = (error: unknown): string => {
  const { status, message } = normalizeApiError(error);
  if (!status) return 'Upload interrupted. Retry when you are online.';
  if (status === 403) return 'You do not have permission to attach files.';
  if (status === 413) return 'Too large to upload.';
  if (status === 429) return 'Too many uploads. Retry in a moment.';
  // 422 carries the API's own wording, e.g. "Finish or remove pending uploads first."
  if (status === 422 && message) return message;
  return 'Upload failed. Retry or remove it.';
};

/**
 * Attachment trays for SMS drafts, one per conversation draft key. Files upload
 * in the background (resumable 8 MB chunks) and can be sent once the server's
 * virus scan releases them.
 */
export function useSmsAttachmentDrafts() {
  const [drafts, setDrafts] = useState<Record<string, DraftAttachment[]>>({});
  const latest = useRef(drafts);
  latest.current = drafts;
  const controllers = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);

  const patch = useCallback((draftKey: string, key: string, change: Partial<DraftAttachment>) => {
    if (!mounted.current) return;
    setDrafts(previous => {
      const items = previous[draftKey];
      if (!items?.some(item => item.key === key)) return previous;
      return { ...previous, [draftKey]: items.map(item => item.key === key ? { ...item, ...change } : item) };
    });
  }, []);

  const upload = useCallback(async (draftKey: string, item: Pick<DraftAttachment, 'key' | 'id' | 'file' | 'name' | 'size'>) => {
    controllers.current.get(item.key)?.abort();
    const controller = new AbortController();
    controllers.current.set(item.key, controller);
    const { signal } = controller;
    try {
      let info = await createMessageUpload({ id: item.id, name: item.name, size: item.size }, signal);
      const chunkBytes = info.chunk_bytes || DEFAULT_CHUNK_BYTES;
      if (info.status === 'uploading') {
        // Resume at the position the server acknowledged.
        for (let index = Math.floor((info.received_bytes ?? 0) / chunkBytes); index * chunkBytes < item.size; index += 1) {
          const start = index * chunkBytes;
          info = await putMessageUploadChunk(item.id, index, item.file.slice(start, start + chunkBytes), {
            signal,
            onProgress: loaded => patch(draftKey, item.key, { progress: Math.min(1, (start + loaded) / item.size) }),
          });
        }
      }
      if (info.status === 'uploading' || info.status === 'scan_failed') {
        info = await completeMessageUpload(item.id, signal);
      }
      patch(draftKey, item.key, { status: 'scanning', progress: 1, error: undefined });
      const deadline = Date.now() + SCAN_DEADLINE_MS;
      let polls = 0;
      while (info.status === 'scanning' && Date.now() < deadline) {
        await wait(polls < 12 ? 1500 : 4000, signal);
        polls += 1;
        info = await getMessageUpload(item.id, signal);
      }
      if (info.status === 'ready') {
        patch(draftKey, item.key, { status: 'ready' });
      } else if (info.status === 'rejected') {
        patch(draftKey, item.key, { status: 'blocked', error: 'Blocked by the virus scan. Remove it.' });
      } else {
        patch(draftKey, item.key, { status: 'failed', error: 'Security check did not finish. Retry.' });
      }
    } catch (error) {
      if (signal.aborted) return;
      patch(draftKey, item.key, { status: 'failed', error: uploadError(error) });
    } finally {
      if (controllers.current.get(item.key) === controller) controllers.current.delete(item.key);
    }
  }, [patch]);

  /** Adds files to a draft and starts uploading them. Returns messages for files that were refused. */
  const add = useCallback((draftKey: string, files: File[]): string[] => {
    const { accepted, errors } = selectAttachments(files, (latest.current[draftKey] ?? []).length);
    if (accepted.length === 0) return errors;
    const items: DraftAttachment[] = accepted.map(file => ({
      key: crypto.randomUUID(),
      id: crypto.randomUUID(),
      file,
      name: safeAttachmentName(file.name),
      size: file.size,
      previewUrl: isPreviewableLocalImage(file) ? URL.createObjectURL(file) : undefined,
      status: 'uploading',
      progress: 0,
    }));
    // Keep the limit check correct for a second add in the same tick.
    latest.current = { ...latest.current, [draftKey]: [...(latest.current[draftKey] ?? []), ...items] };
    setDrafts(previous => ({ ...previous, [draftKey]: [...(previous[draftKey] ?? []), ...items] }));
    items.forEach(item => { void upload(draftKey, item); });
    return errors;
  }, [upload]);

  const remove = useCallback((draftKey: string, key: string) => {
    const item = latest.current[draftKey]?.find(entry => entry.key === key);
    if (!item) return;
    controllers.current.get(key)?.abort();
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    setDrafts(previous => ({ ...previous, [draftKey]: (previous[draftKey] ?? []).filter(entry => entry.key !== key) }));
    // Frees the server-side slot; an upload that never started has nothing to delete.
    void deleteMessageUpload(item.id).catch(() => undefined);
  }, []);

  const retry = useCallback((draftKey: string, key: string) => {
    const item = latest.current[draftKey]?.find(entry => entry.key === key);
    if (!item || item.status !== 'failed') return;
    patch(draftKey, key, { status: 'uploading', error: undefined, progress: 0 });
    void upload(draftKey, item);
  }, [patch, upload]);

  /** After a successful send the files belong to the message; only local state is dropped. */
  const clearSent = useCallback((draftKey: string, ids: string[]) => {
    const sent = new Set(ids);
    (latest.current[draftKey] ?? []).forEach(item => { if (sent.has(item.id) && item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
    setDrafts(previous => ({ ...previous, [draftKey]: (previous[draftKey] ?? []).filter(item => !sent.has(item.id)) }));
  }, []);

  /**
   * A send that reached the server but did not go out keeps its uploads
   * reserved, so they cannot ride on another attempt. Upload the same files
   * again under new ids to make the draft sendable once more.
   */
  const uploadAgain = useCallback((draftKey: string, ids: string[]) => {
    const consumed = new Set(ids);
    const renewed = (latest.current[draftKey] ?? []).filter(item => consumed.has(item.id))
      .map(item => ({ ...item, id: crypto.randomUUID(), status: 'uploading' as const, progress: 0, error: undefined }));
    if (renewed.length === 0) return;
    const byKey = new Map(renewed.map(item => [item.key, item]));
    setDrafts(previous => ({ ...previous, [draftKey]: (previous[draftKey] ?? []).map(item => byKey.get(item.key) ?? item) }));
    renewed.forEach(item => { void upload(draftKey, item); });
  }, [upload]);

  useEffect(() => {
    mounted.current = true;
    const active = controllers.current;
    return () => {
      mounted.current = false;
      active.forEach(controller => controller.abort());
      active.clear();
      // Unsent uploads would otherwise count against the 20 pending uploads allowed per person.
      Object.values(latest.current).flat().forEach(item => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        void deleteMessageUpload(item.id).catch(() => undefined);
      });
    };
  }, []);

  const itemsFor = useCallback((draftKey: string) => drafts[draftKey] ?? NO_ATTACHMENTS, [drafts]);

  return { itemsFor, add, remove, retry, clearSent, uploadAgain };
}
