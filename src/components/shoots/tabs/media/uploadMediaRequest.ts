import { trackTransferTelemetry } from '@/features/system-overview/telemetryClient';

// A transfer may be slow and healthy for hours. Only a lack of new bytes expires
// the transfer; once sent, use a separate deadline for the server's response.
export const UPLOAD_IDLE_TIMEOUT_MS = 120_000;
export const UPLOAD_RESPONSE_TIMEOUT_MS = 300_000;

// Cloudflare free/pro rejects single requests over ~100MB with 413 after ~1.5MB
// (~1% of a large video). Chunk large files under that ceiling.
export const CLOUDFLARE_SAFE_UPLOAD_BYTES = 90 * 1024 * 1024;
export const SHOOT_MEDIA_CHUNK_BYTES = 50 * 1024 * 1024;

export interface MediaTransferProgress {
  phase: 'transferring' | 'processing';
  loaded: number;
  total: number;
}

type MediaRequestResult =
  | { ok: true; status: number; responseText: string }
  // interrupted: the connection dropped without any server response (not a cancel or timeout).
  | { ok: false; message: string; interrupted?: true };

type UploadMediaRequestOptions = {
  url: string;
  body: FormData;
  headers: Record<string, string | undefined>;
  signal?: AbortSignal;
  onProgress: (progress: MediaTransferProgress) => void;
};

const CDN_OVERSIZE_MESSAGE =
  'This file is too large for a single upload through the CDN (about 100MB). The uploader will split large videos automatically — retry if you still see this.';

function parseShootIdFromUploadUrl(url: string): string | null {
  const match = url.match(/\/api\/shoots\/([^/]+)\/upload(?:\?|$)/);
  return match ? match[1] : null;
}

function formDataFields(body: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  body.forEach((value, key) => {
    if (typeof value === 'string' && key !== 'files[]' && key !== 'files') {
      fields[key] = value;
    }
  });
  return fields;
}

function primaryUploadFile(body: FormData): File | null {
  const value = body.get('files[]') ?? body.get('files');
  return value instanceof File ? value : null;
}

function sessionsUrl(uploadUrl: string): string {
  return uploadUrl.replace(/\/upload(?:\?.*)?$/, '/upload-sessions');
}

function extractJsonMessage(responseText: string, fallback: string): string {
  try {
    const message = JSON.parse(responseText).message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  } catch {
    return fallback;
  }
}

// Session create + chunk complete have no byte progress. Cap them so a hung
// finalize cannot leave the UI wedged at ~99.9% forever.
function xhrJson(
  method: string,
  url: string,
  headers: Record<string, string | undefined>,
  body: XMLHttpRequestBodyInit | null,
  signal?: AbortSignal,
): Promise<MediaRequestResult> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ ok: false, message: 'Upload cancelled. The remaining files are still selected for retry.' });
      return;
    }
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (result: MediaRequestResult, abort = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
      if (abort) xhr.abort();
    };
    const onAbort = () => finish({ ok: false, message: 'Upload cancelled. The remaining files are still selected for retry.' }, true);
    const timer = setTimeout(() => finish({
      ok: false,
      message: 'The server did not confirm this upload within 5 minutes. Retry to check it safely without creating a duplicate.',
    }, true), UPLOAD_RESPONSE_TIMEOUT_MS);
    signal?.addEventListener('abort', onAbort, { once: true });
    xhr.addEventListener('load', () => {
      if (xhr.status === 0) {
        finish({ ok: false, message: 'The upload connection ended without a server response. Check your connection and retry.' });
      } else if (xhr.status === 413) {
        finish({ ok: false, message: CDN_OVERSIZE_MESSAGE });
      } else {
        finish({ ok: true, status: xhr.status, responseText: xhr.responseText });
      }
    });
    xhr.addEventListener('error', () => finish({ ok: false, message: 'The upload connection was interrupted. Check your connection and retry.' }));
    xhr.addEventListener('abort', () => finish({ ok: false, message: 'The upload was interrupted before the server confirmed it. Retry to check it safely.' }));
    xhr.addEventListener('timeout', () => finish({ ok: false, message: 'The upload connection timed out. Check your connection and retry.' }));
    xhr.open(method, url);
    Object.entries(headers).forEach(([name, value]) => {
      if (value) xhr.setRequestHeader(name, value);
    });
    xhr.send(body);
  });
}

function uploadBinaryChunk(options: {
  url: string;
  body: Blob;
  headers: Record<string, string | undefined>;
  signal?: AbortSignal;
  onProgress: (loaded: number, total: number) => void;
}): Promise<MediaRequestResult> {
  return new Promise((resolve) => {
    let xhr: XMLHttpRequest | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let processing = false;
    let loaded = 0;
    let total = options.body.size;

    const finish = (result: MediaRequestResult, abort = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      resolve(result);
      if (abort) xhr?.abort();
    };
    const cancel = () => finish({ ok: false, message: 'Upload cancelled. The remaining files are still selected for retry.' }, true);
    const armDeadline = () => {
      clearTimeout(timer);
      timer = setTimeout(() => finish({
        ok: false,
        message: processing
          ? 'The server did not confirm this upload within 5 minutes. Retry to check it safely without creating a duplicate.'
          : 'No upload data transferred for 2 minutes. Check your connection and that the selected file is available on this device, then retry.',
      }, true), processing ? UPLOAD_RESPONSE_TIMEOUT_MS : UPLOAD_IDLE_TIMEOUT_MS);
    };
    const markProcessing = () => {
      if (settled || processing) return;
      processing = true;
      options.onProgress(loaded, total);
      armDeadline();
    };

    try {
      if (options.signal?.aborted) { cancel(); return; }
      options.signal?.addEventListener('abort', cancel, { once: true });
      xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (event) => {
        if (settled || processing) return;
        const moved = event.loaded > loaded;
        loaded = Math.max(loaded, event.loaded);
        total = event.lengthComputable ? event.total : options.body.size;
        options.onProgress(loaded, total);
        if (total > 0 && loaded >= total) markProcessing();
        else if (moved) armDeadline();
      });
      xhr.upload.addEventListener('load', markProcessing);
      xhr.addEventListener('load', () => {
        if (xhr!.status === 0) {
          finish({ ok: false, message: 'The upload connection ended without a server response. Check your connection and retry.' });
        } else if (xhr!.status === 413) {
          finish({ ok: false, message: CDN_OVERSIZE_MESSAGE });
        } else if (xhr!.status >= 200 && xhr!.status < 300) {
          finish({ ok: true, status: xhr!.status, responseText: xhr!.responseText });
        } else {
          let message = 'Chunk upload failed.';
          try {
            message = JSON.parse(xhr!.responseText).message || message;
          } catch {
            // keep generic message
          }
          finish({ ok: false, message });
        }
      });
      xhr.addEventListener('error', () => finish({ ok: false, message: 'The upload connection was interrupted. Check your connection and retry.' }));
      xhr.addEventListener('abort', () => finish({ ok: false, message: 'The upload was interrupted before the server confirmed it. Retry to check it safely.' }));
      xhr.addEventListener('timeout', () => finish({ ok: false, message: 'The upload connection timed out. Check your connection and retry.' }));
      xhr.open('PUT', options.url);
      Object.entries(options.headers).forEach(([name, value]) => {
        if (value) xhr!.setRequestHeader(name, value);
      });
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      options.onProgress(0, options.body.size);
      armDeadline();
      xhr.send(options.body);
    } catch {
      finish({ ok: false, message: 'The browser could not start the upload. Make sure the selected file is available on this device, then retry.' }, true);
    }
  });
}

async function uploadMediaChunked(options: UploadMediaRequestOptions, file: File): Promise<MediaRequestResult> {
  const shootId = parseShootIdFromUploadUrl(options.url);
  if (!shootId) {
    return { ok: false, message: 'Could not start a chunked upload for this shoot.' };
  }

  const fields = formDataFields(options.body);
  const initHeaders = {
    ...options.headers,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const init = await xhrJson(
    'POST',
    sessionsUrl(options.url),
    initHeaders,
    JSON.stringify({
      filename: file.name,
      size_bytes: file.size,
      upload_type: fields.upload_type || 'raw',
      fields,
    }),
    options.signal,
  );
  if (init.ok === false) return init;
  if (init.status < 200 || init.status >= 300) {
    return {
      ok: false,
      message: extractJsonMessage(init.responseText, 'Could not start a chunked upload.'),
    };
  }

  let session: { session_id: string; chunk_size_bytes: number; total_chunks: number };
  try {
    session = JSON.parse(init.responseText);
  } catch {
    return { ok: false, message: 'Could not start a chunked upload.' };
  }

  const chunkSize = Math.max(1, Number(session.chunk_size_bytes) || SHOOT_MEDIA_CHUNK_BYTES);
  const totalChunks = Math.max(1, Number(session.total_chunks) || Math.ceil(file.size / chunkSize));
  let transferred = 0;

  for (let index = 0; index < totalChunks; index += 1) {
    if (options.signal?.aborted) {
      return { ok: false, message: 'Upload cancelled. The remaining files are still selected for retry.' };
    }
    const start = index * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const blob = file.slice(start, end);
    const chunkResult = await uploadBinaryChunk({
      url: `${sessionsUrl(options.url)}/${session.session_id}/chunks/${index}`,
      body: blob,
      headers: options.headers,
      signal: options.signal,
      onProgress: (loaded, total) => {
        const chunkLoaded = total > 0 ? Math.min(loaded, total) : loaded;
        options.onProgress({
          phase: 'transferring',
          loaded: transferred + chunkLoaded,
          total: file.size,
        });
      },
    });
    if (chunkResult.ok === false) return chunkResult;
    transferred = end;
    options.onProgress({ phase: 'transferring', loaded: transferred, total: file.size });
  }

  options.onProgress({ phase: 'processing', loaded: file.size, total: file.size });
  const complete = await xhrJson(
    'POST',
    `${sessionsUrl(options.url)}/${session.session_id}/complete`,
    { ...options.headers, Accept: 'application/json' },
    null,
    options.signal,
  );
  if (complete.ok === false) return complete;
  if (complete.status === 413) {
    return { ok: false, message: CDN_OVERSIZE_MESSAGE };
  }
  if (complete.status < 200 || complete.status >= 300) {
    return {
      ok: false,
      message: extractJsonMessage(complete.responseText, 'Chunked upload finalize failed.'),
    };
  }
  return complete;
}

function sendMediaRequest(options: UploadMediaRequestOptions): Promise<MediaRequestResult> {
  const file = primaryUploadFile(options.body);
  if (file && file.size > CLOUDFLARE_SAFE_UPLOAD_BYTES) {
    return uploadMediaChunked(options, file);
  }

  return new Promise((resolve) => {
    let xhr: XMLHttpRequest | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let processing = false;
    let loaded = 0;
    let total = 0;

    const finish = (result: MediaRequestResult, abort = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      resolve(result);
      if (abort) xhr?.abort();
    };
    const cancel = () => finish({ ok: false, message: 'Upload cancelled. The remaining files are still selected for retry.' }, true);
    const armDeadline = () => {
      clearTimeout(timer);
      timer = setTimeout(() => finish({
        ok: false,
        message: processing
          ? 'The server did not confirm this upload within 5 minutes. Retry to check it safely without creating a duplicate.'
          : 'No upload data transferred for 2 minutes. Check your connection and that the selected file is available on this device, then retry.',
      }, true), processing ? UPLOAD_RESPONSE_TIMEOUT_MS : UPLOAD_IDLE_TIMEOUT_MS);
    };
    const markProcessing = () => {
      if (settled || processing) return;
      processing = true;
      options.onProgress({ phase: 'processing', loaded, total });
      armDeadline();
    };

    try {
      if (options.signal?.aborted) { cancel(); return; }
      options.signal?.addEventListener('abort', cancel, { once: true });
      xhr = new XMLHttpRequest();
      // Safari requires upload listeners to be installed before open/send.
      xhr.upload.addEventListener('progress', (event) => {
        if (settled || processing) return;
        const moved = event.loaded > loaded;
        loaded = Math.max(loaded, event.loaded);
        total = event.lengthComputable ? event.total : 0;
        options.onProgress({ phase: 'transferring', loaded, total });
        if (total > 0 && loaded >= total) markProcessing();
        else if (moved) armDeadline();
      });
      xhr.upload.addEventListener('load', markProcessing);
      xhr.addEventListener('load', () => {
        if (xhr!.status === 0) {
          finish({ ok: false, interrupted: true, message: 'The upload connection ended without a server response. Check your connection and retry.' });
        } else if (xhr!.status === 413) {
          // Cloudflare HTML 413 — surface a clear, retryable message instead of a parse failure.
          finish({ ok: false, message: CDN_OVERSIZE_MESSAGE });
        } else {
          finish({ ok: true, status: xhr!.status, responseText: xhr!.responseText });
        }
      });
      xhr.addEventListener('error', () => finish({ ok: false, interrupted: true, message: 'The upload connection was interrupted. Check your connection and retry.' }));
      xhr.addEventListener('abort', () => finish({ ok: false, message: 'The upload was interrupted before the server confirmed it. Retry to check it safely.' }));
      xhr.addEventListener('timeout', () => finish({ ok: false, message: 'The upload connection timed out. Check your connection and retry.' }));
      xhr.open('POST', options.url);
      Object.entries(options.headers).forEach(([name, value]) => {
        if (value) xhr!.setRequestHeader(name, value);
      });
      options.onProgress({ phase: 'transferring', loaded: 0, total: 0 });
      armDeadline();
      xhr.send(options.body);
    } catch {
      finish({ ok: false, message: 'The browser could not start the upload. Make sure the selected file is available on this device, then retry.' }, true);
    }
  });
}

export function formatUploadPercent(progress: number): string {
  return progress > 0 && progress < 0.1 ? '<0.1' : String(Math.round(progress * 10) / 10);
}

export async function uploadMediaRequest(options: UploadMediaRequestOptions): Promise<MediaRequestResult> {
  const started = performance.now();
  let transferFinished: number | null = null;
  const file = primaryUploadFile(options.body);
  const result = await sendMediaRequest({
    ...options,
    onProgress: (progress) => {
      if (progress.phase === 'processing' && transferFinished === null) transferFinished = performance.now();
      options.onProgress(progress);
    },
  });
  const finished = performance.now();
  const uploadType = options.body.get('upload_type');
  let confirmed = false;
  if (result.ok && result.status >= 200 && result.status < 300) {
    try { confirmed = Number(JSON.parse(result.responseText).success_count) > 0; } catch { /* Unconfirmed response. */ }
  }
  trackTransferTelemetry({
    direction: 'upload',
    mediaType: uploadType === 'edited' ? 'edited' : uploadType === 'extra' || /\/upload-extra$/.test(options.url) ? 'extra' : 'raw',
    bytes: file?.size ?? 0,
    transferMs: transferFinished === null ? null : transferFinished - started,
    confirmationMs: transferFinished === null ? null : finished - transferFinished,
    totalMs: finished - started,
    status: result.ok ? result.status : 0,
    outcome: options.signal?.aborted ? 'cancelled' : confirmed ? 'confirmed' : 'failed',
    chunked: Boolean(file && file.size > CLOUDFLARE_SAFE_UPLOAD_BYTES),
  });
  return result;
}
