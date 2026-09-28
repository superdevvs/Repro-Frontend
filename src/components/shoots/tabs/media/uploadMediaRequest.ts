// A transfer may be slow and healthy for hours. Only a lack of new bytes expires
// the transfer; once sent, use a separate deadline for the server's response.
export const UPLOAD_IDLE_TIMEOUT_MS = 120_000;
export const UPLOAD_RESPONSE_TIMEOUT_MS = 300_000;

export interface MediaTransferProgress {
  phase: 'transferring' | 'processing';
  loaded: number;
  total: number;
}

type MediaRequestResult =
  | { ok: true; status: number; responseText: string }
  | { ok: false; message: string };

export function uploadMediaRequest(options: {
  url: string;
  body: FormData;
  headers: Record<string, string | undefined>;
  signal?: AbortSignal;
  onProgress: (progress: MediaTransferProgress) => void;
}): Promise<MediaRequestResult> {
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
          finish({ ok: false, message: 'The upload connection ended without a server response. Check your connection and retry.' });
        } else {
          finish({ ok: true, status: xhr!.status, responseText: xhr!.responseText });
        }
      });
      xhr.addEventListener('error', () => finish({ ok: false, message: 'The upload connection was interrupted. Check your connection and retry.' }));
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
