import { apiClient } from './api';
import type { SmsMessageDetail, SmsThreadSummary } from '@/types/messaging';

/** Server status of a message attachment (uploaded here or received from a carrier). */
export type MessageMediaStatus =
  | 'uploading' | 'scanning' | 'ready' | 'rejected' | 'scan_failed'
  | 'importing' | 'unavailable' | 'cancelled';

export interface MessageMediaFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: MessageMediaStatus;
  received_bytes?: number;
  chunk_bytes?: number;
  download_url: string;
  preview_url?: string;
}

export interface SmsAttachmentSendResult {
  success: boolean;
  id: string | null;
  conversation_id?: string;
  status?: string;
  message?: string;
  result?: { message?: SmsMessageDetail | string; thread?: SmsThreadSummary; failed?: number; error?: string };
}

/** The API returns absolute `/api/...` paths; apiClient already targets `/api`. */
const clientPath = (url: string) => url.replace(/^\/api(?=\/)/, '');

export const createMessageUpload = async (
  data: { id: string; name: string; size: number },
  signal?: AbortSignal,
): Promise<MessageMediaFile> => {
  const response = await apiClient.post('/messaging/media/uploads', { ...data, channel: 'sms' }, { signal });
  return response.data;
};

export const putMessageUploadChunk = async (
  id: string,
  index: number,
  chunk: Blob,
  options: { signal?: AbortSignal; onProgress?: (loadedBytes: number) => void } = {},
): Promise<MessageMediaFile> => {
  const response = await apiClient.put(`/messaging/media/uploads/${id}/chunks/${index}`, chunk, {
    headers: { 'Content-Type': 'application/octet-stream' },
    signal: options.signal,
    onUploadProgress: (event) => options.onProgress?.(event.loaded),
  });
  return response.data;
};

export const completeMessageUpload = async (id: string, signal?: AbortSignal): Promise<MessageMediaFile> => {
  const response = await apiClient.post(`/messaging/media/uploads/${id}/complete`, undefined, { signal });
  return response.data;
};

export const getMessageUpload = async (id: string, signal?: AbortSignal): Promise<MessageMediaFile> => {
  const response = await apiClient.get(`/messaging/media/uploads/${id}`, { signal });
  return response.data;
};

export const deleteMessageUpload = async (id: string): Promise<void> => {
  await apiClient.delete(`/messaging/media/uploads/${id}`);
};

/**
 * Sends a reply with attachments. `request_key` makes the send replay-safe:
 * repeating it with the same draft returns the first outcome and never texts twice.
 */
export const sendSmsWithAttachments = async (data: {
  request_key: string;
  conversation_id: string;
  body: string;
  sender_id?: number;
  attachment_ids: string[];
}): Promise<SmsAttachmentSendResult> => {
  const response = await apiClient.post('/messaging/media/send', { ...data, channel: 'sms' });
  return response.data;
};

/** Attachments for messages the signed-in user can already open, keyed by message id. */
export const getSmsMessageAttachments = async (ids: string[]): Promise<Record<string, MessageMediaFile[]>> => {
  const found: Record<string, MessageMediaFile[]> = {};
  for (let start = 0; start < ids.length; start += 100) {
    const response = await apiClient.post('/messaging/media/content', { kind: 'sms', ids: ids.slice(start, start + 100) });
    const data = (response.data?.data ?? {}) as Record<string, { attachments?: MessageMediaFile[] }>;
    for (const [id, entry] of Object.entries(data)) {
      if (entry?.attachments?.length) found[id] = entry.attachments;
    }
  }
  return found;
};

export const fetchMessageMediaBlob = async (url: string, signal?: AbortSignal): Promise<Blob> => {
  // The session token must only ever travel to this API's own media routes.
  if (!url.startsWith('/api/messaging/media/')) throw new Error('Unexpected attachment address.');
  const response = await apiClient.get(clientPath(url), { responseType: 'blob', signal });
  return response.data;
};
