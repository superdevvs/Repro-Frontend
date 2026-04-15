import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';

export type ShootMediaDownloadType = 'raw' | 'edited';
export type ShootMediaDownloadSize = 'original' | 'small' | 'medium' | 'large';
export type ShootMediaArchivePreparingState = {
  message: string;
  pollAfterMs: number;
};
export type ShootMediaArchiveDownloadResult =
  | { mode: 'redirect'; url: string; waited: boolean }
  | { mode: 'blob'; filename: string; waited: boolean };
export type ShootRawMediaDownloadResult =
  | { mode: 'redirect'; url: string; message?: string; fileCount?: number }
  | { mode: 'blob'; filename: string; message?: string; fileCount?: number };
export type ShootSingleMediaDownloadResult =
  | { mode: 'redirect'; url: string }
  | { mode: 'blob'; filename: string };

type ResolveShootMediaArchiveRequestOptions = {
  address?: string | null;
  headers?: HeadersInit;
  onPreparing?: (state: ShootMediaArchivePreparingState) => void;
  redirectMode?: 'new-tab' | 'same-tab';
  requestUrl: string;
  shootId?: string | number;
  size?: ShootMediaDownloadSize;
  type: ShootMediaDownloadType;
};

type PreparingResponse = {
  type?: 'preparing';
  message?: string;
  poll_after_ms?: number;
  status_url?: string;
};

type RedirectResponse = {
  type?: 'redirect';
  url?: string;
};

type RawRedirectResponse = RedirectResponse & {
  message?: string;
  file_count?: number;
};

export const SHOOT_MEDIA_DOWNLOAD_STARTED_EVENT = 'shoot-media-download-started';

export const getShootMediaDownloadSizeLabel = (
  size: ShootMediaDownloadSize,
) => {
  switch (size) {
    case 'original':
      return 'Original Size';
    case 'large':
      return 'Large Size';
    case 'medium':
      return 'Medium Size';
    case 'small':
      return 'MLS Compliant';
    default:
      return size;
  }
};

const sanitizeFilenameSegment = (value?: string | null) => {
  const normalized = (value || 'shoot').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
  return normalized.replace(/^_+|_+$/g, '') || 'shoot';
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const getFilenameFromDisposition = (contentDisposition: string | null) => {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const basicMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return basicMatch?.[1] || null;
};

const emitShootMediaDownloadStarted = ({
  shootId,
  type,
  size,
}: {
  shootId?: string | number;
  type: ShootMediaDownloadType;
  size?: ShootMediaDownloadSize;
}) => {
  if (typeof window === 'undefined' || shootId === undefined || shootId === null) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(SHOOT_MEDIA_DOWNLOAD_STARTED_EVENT, {
      detail: {
        shootId: String(shootId),
        type,
        size: size ?? 'original',
      },
    }),
  );
};

const sleep = (time: number) => new Promise((resolve) => {
  window.setTimeout(resolve, time);
});

export const startSameWindowDownload = (url: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.src = url;
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    iframe.remove();
  }, 60_000);
};

const renderDownloadWindow = (
  downloadWindow: Window | null,
  title: string,
  message: string,
) => {
  if (!downloadWindow || downloadWindow.closed) {
    return;
  }

  try {
    downloadWindow.document.open();
    downloadWindow.document.write(
      `<title>${title}</title><div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;line-height:1.5;color:#0f172a"><h2 style="margin:0 0 12px">${title}</h2><p style="margin:0;color:#475569">${message}</p></div>`,
    );
    downloadWindow.document.close();
  } catch {
    // Ignore cross-window update failures after navigation.
  }
};

const navigateDownloadWindow = (
  downloadWindow: Window | null,
  redirectMode: 'new-tab' | 'same-tab',
  url: string,
) => {
  startSameWindowDownload(url);
};

const extractJsonResponse = async (response: Response) => {
  return response.json().catch(() => ({})) as Promise<PreparingResponse & RedirectResponse & {
    error?: string;
    message?: string;
  }>;
};

const extractRawJsonResponse = async (response: Response) => {
  return response.json().catch(() => ({})) as Promise<RawRedirectResponse & {
    error?: string;
  }>;
};

const buildRawDownloadFilename = (
  shootId: string | number,
  contentDisposition: string | null,
) => {
  return getFilenameFromDisposition(contentDisposition) || `shoot-${shootId}-raw-files.zip`;
};

export const buildShootDownloadFilename = (
  address: string | null | undefined,
  type: ShootMediaDownloadType,
  size?: ShootMediaDownloadSize,
) => {
  const base = sanitizeFilenameSegment(address);
  const parts = [base];

  if (type === 'raw') {
    parts.push('full');
  } else {
    parts.push('web');
  }

  if (size && size !== 'original') {
    parts.push(size === 'small' ? 'mls_compliant' : size);
  }

  return `${parts.join('_')}.zip`;
};

export const resolveShootMediaArchiveRequest = async ({
  address,
  headers,
  onPreparing,
  redirectMode = 'new-tab',
  requestUrl,
  shootId,
  size,
  type,
}: ResolveShootMediaArchiveRequestOptions): Promise<ShootMediaArchiveDownloadResult> => {
  let currentUrl = requestUrl;
  let waited = false;
  const downloadWindow = null;

  while (true) {
    const response = await fetch(currentUrl, {
      method: 'GET',
      headers,
    });

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      if (contentType.includes('application/json')) {
        const errorData = await extractJsonResponse(response);
        const message = errorData.message || errorData.error || 'Failed to download media';
        renderDownloadWindow(downloadWindow, 'Download Unavailable', message);
        throw new Error(message);
      }

      renderDownloadWindow(downloadWindow, 'Download Unavailable', 'Failed to download media');
      throw new Error('Failed to download media');
    }

    if (contentType.includes('application/json')) {
      const data = await extractJsonResponse(response);

      if (data?.type === 'redirect' && data?.url) {
        navigateDownloadWindow(downloadWindow, redirectMode, data.url);
        emitShootMediaDownloadStarted({ shootId, type, size });
        return { mode: 'redirect', url: data.url, waited };
      }

      if (data?.type === 'preparing') {
        waited = true;
        const preparingState = {
          message: data.message || 'Preparing your files.',
          pollAfterMs: data.poll_after_ms ?? 3000,
        };

        onPreparing?.(preparingState);
        renderDownloadWindow(
          downloadWindow,
          'Preparing Download',
          `${preparingState.message} This tab will update automatically.`,
        );

        currentUrl = data.status_url || currentUrl;
        await sleep(preparingState.pollAfterMs);
        continue;
      }

      renderDownloadWindow(downloadWindow, 'Download Unavailable', 'Unexpected response format');
      throw new Error(data?.message || 'Unexpected response format');
    }

    if (downloadWindow && !downloadWindow.closed) {
      downloadWindow.close();
    }

    const blob = await response.blob();
    const suggestedFilename =
      getFilenameFromDisposition(response.headers.get('content-disposition')) ||
      buildShootDownloadFilename(address, type, size);

    downloadBlob(blob, suggestedFilename);
    emitShootMediaDownloadStarted({ shootId, type, size });
    return { mode: 'blob', filename: suggestedFilename, waited };
  }
};

export const downloadShootMediaArchive = async ({
  shootId,
  type,
  size,
  address,
  onPreparing,
}: {
  shootId: string | number;
  type: ShootMediaDownloadType;
  size?: ShootMediaDownloadSize;
  address?: string | null;
  onPreparing?: (state: ShootMediaArchivePreparingState) => void;
}) => {
  const params = new URLSearchParams({ type });
  if (size) {
    params.set('size', size);
  }

  return resolveShootMediaArchiveRequest({
    address,
    headers: {
      ...getApiHeaders(),
      Accept: 'application/json, application/zip, application/octet-stream',
    },
    onPreparing,
    redirectMode: 'same-tab',
    requestUrl: `${API_BASE_URL}/api/shoots/${shootId}/media/download-zip?${params.toString()}`,
    shootId,
    size,
    type,
  });
};

export const downloadShootRawFiles = async ({
  shootId,
  fileIds,
}: {
  shootId: string | number;
  fileIds?: Array<string | number>;
}): Promise<ShootRawMediaDownloadResult> => {
  const headers = getApiHeaders();
  headers.Accept = 'application/json, application/zip, application/octet-stream';
  delete headers['Content-Type'];

  const queryParams = new URLSearchParams();
  if (Array.isArray(fileIds) && fileIds.length > 0) {
    queryParams.set(
      'file_ids',
      fileIds.map((fileId) => String(fileId)).join(','),
    );
  }

  const queryString = queryParams.toString();
  const response = await fetch(
    `${API_BASE_URL}/api/shoots/${shootId}/editor-download-raw${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
      headers,
    },
  );

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const errorData = await extractRawJsonResponse(response);
      throw new Error(errorData.error || errorData.message || 'Download failed');
    }

    throw new Error('Download failed');
  }

  if (contentType.includes('application/json')) {
    const data = await extractRawJsonResponse(response);

    if (data.type === 'redirect' && data.url) {
      startSameWindowDownload(data.url);
      emitShootMediaDownloadStarted({ shootId, type: 'raw', size: 'original' });
      return {
        mode: 'redirect',
        url: data.url,
        message: data.message,
        fileCount: data.file_count,
      };
    }

    throw new Error(data.message || 'Download failed');
  }

  const blob = await response.blob();
  const filename = buildRawDownloadFilename(
    shootId,
    response.headers.get('content-disposition'),
  );
  downloadBlob(blob, filename);
  emitShootMediaDownloadStarted({ shootId, type: 'raw', size: 'original' });

  return {
    mode: 'blob',
    filename,
  };
};

export const downloadShootMediaFile = async ({
  shootId,
  fileId,
}: {
  shootId: string | number;
  fileId: string | number;
}): Promise<ShootSingleMediaDownloadResult> => {
  const headers = getApiHeaders();
  headers.Accept = 'application/json, application/octet-stream';
  delete headers['Content-Type'];

  const response = await fetch(
    `${API_BASE_URL}/api/shoots/${shootId}/media/${fileId}/download`,
    {
      method: 'GET',
      headers,
    },
  );

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const errorData = await extractJsonResponse(response);
      throw new Error(errorData.message || errorData.error || 'Failed to download file');
    }

    throw new Error('Failed to download file');
  }

  if (contentType.includes('application/json')) {
    const data = await extractJsonResponse(response);
    if (!data.url) {
      throw new Error(data.message || 'Download link not available');
    }

    startSameWindowDownload(data.url);
    return {
      mode: 'redirect',
      url: data.url,
    };
  }

  const blob = await response.blob();
  const filename =
    getFilenameFromDisposition(response.headers.get('content-disposition')) ||
    `shoot-${shootId}-file-${fileId}`;
  downloadBlob(blob, filename);

  return {
    mode: 'blob',
    filename,
  };
};
