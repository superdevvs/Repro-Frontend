import { API_BASE_URL } from '@/config/env';

export const MAX_BUFFERED_ARCHIVE_BYTES = 256 * 1024 * 1024;
export const DOWNLOAD_URL_REVOKE_DELAY_MS = 60_000;

const apiOrigin = () => new URL(API_BASE_URL || window.location.origin, window.location.origin).origin;

export const validateDownloadUrl = (value: string): string => {
  const url = new URL(value, API_BASE_URL || window.location.origin);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.origin === apiOrigin()))) {
    throw new Error('This download link is invalid.');
  }
  return url.href;
};

export const validateApiDownloadUrl = (value: string): string => {
  const url = validateDownloadUrl(value);
  if (new URL(url).origin !== apiOrigin()) throw new Error('This download link is invalid.');
  return url;
};

export const fetchApiDownload = (url: string, headers?: HeadersInit, signal?: AbortSignal) => {
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/zip, application/json;q=0.9, application/octet-stream;q=0.8');
  return fetch(validateApiDownloadUrl(url), { method: 'GET', headers: requestHeaders, redirect: 'error', signal });
};

export const saveDownloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    // The browser may read the object URL after the click event has returned.
    window.setTimeout(() => window.URL.revokeObjectURL(url), DOWNLOAD_URL_REVOKE_DELAY_MS);
  }
};

export class ArchiveTooLargeForBuffer extends Error {
  constructor() { super('This archive is too large to prepare in this tab. Please try the download again.'); }
}

/** Bound only cacheable archives, whose existing URL supports a native fallback. */
export const readArchiveBlob = async (response: Response, maxBytes = MAX_BUFFERED_ARCHIVE_BYTES): Promise<Blob> => {
  const advertisedBytes = Number(response.headers.get('Content-Length'));
  if (advertisedBytes > maxBytes) {
    await response.body?.cancel();
    throw new ArchiveTooLargeForBuffer();
  }
  if (!response.body?.getReader) {
    const blob = await response.blob();
    if (blob.size > maxBytes) throw new ArchiveTooLargeForBuffer();
    return blob;
  }
  const reader = response.body.getReader();
  const parts: ArrayBuffer[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new ArchiveTooLargeForBuffer();
      }
      parts.push(result.value.slice().buffer as ArrayBuffer);
    }
    return new Blob(parts, { type: response.headers.get('Content-Type') || 'application/zip' });
  } finally { reader.releaseLock(); }
};

export const waitForArchive = (delay: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const abort = () => { window.clearTimeout(timer); reject(new DOMException('Download cancelled.', 'AbortError')); };
  const timer = window.setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, delay);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
});
