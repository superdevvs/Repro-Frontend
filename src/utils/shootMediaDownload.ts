import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { buildShootZipFilename, parseDownloadFilename } from './shootDownloadFilename';
import {
  ArchiveTooLargeForBuffer,
  canStreamArchiveToDisk,
  fetchApiDownload,
  MAX_BUFFERED_ARCHIVE_BYTES,
  readArchiveBlob,
  saveDownloadBlob as downloadBlob,
  streamArchiveResponseToDisk,
  validateApiDownloadUrl,
  validateDownloadUrl,
  waitForArchive,
} from './shootDownloadTransfer';

export type ShootMediaDownloadType = 'raw' | 'edited';
export type ShootMediaDownloadSize = 'original' | 'small';

export type ShootMediaFileDownloadOptions = { format?: 'jpg'; page?: number };
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
  onDownloading?: () => void;
  signal?: AbortSignal;
  redirectMode?: 'new-tab' | 'same-tab';
  requestUrl: string;
  shootId?: string | number;
  size?: ShootMediaDownloadSize;
  shootServiceId?: string | number | null;
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
    case 'small':
      return 'MLS Compliant';
    default:
      return size;
  }
};

const getFilenameFromDisposition = parseDownloadFilename;

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

export const startSameWindowDownload = (url: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.src = validateDownloadUrl(url);
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    iframe.remove();
  }, 60_000);
};

const extractJsonResponse = async (response: Response) => {
  return response.json().catch(() => ({})) as Promise<(PreparingResponse | RedirectResponse) & {
    error?: string;
    message?: string;
  }>;
};

const extractRawJsonResponse = async (response: Response) => {
  return response.json().catch(() => ({})) as Promise<(PreparingResponse | RawRedirectResponse) & {
    error?: string;
  }>;
};

const buildRawDownloadFilename = (
  shootId: string | number,
  contentDisposition: string | null,
  address?: string | null,
) => {
  const supplied = getFilenameFromDisposition(contentDisposition);
  return (supplied && (!address || !/^shoot-\d+-raw-files\.zip$/i.test(supplied)) ? supplied : null)
    || buildShootZipFilename(address, 'raw-files', shootId);
};

export const buildShootDownloadFilename = (
  address: string | null | undefined,
  type: ShootMediaDownloadType,
  size?: ShootMediaDownloadSize,
) => {
  return buildShootZipFilename(address, `${type}-${size ?? 'original'}`);
};

/**
 * Ready/redirect asset URLs are signed or public storage links. Always hand them
 * to the browser so Content-Disposition attachment streams to disk — never
 * fetch→Blob→createObjectURL (that OOMs Full-size ~256MB ZIPs).
 */
const downloadReadyAsset = async (url: string, _fallbackFilename?: string, _signal?: AbortSignal) => {
  const safeUrl = validateDownloadUrl(url);
  startSameWindowDownload(safeUrl);
  return { mode: 'redirect' as const, url: safeUrl };
};

const deliverAuthenticatedArchiveBody = async (
  response: Response,
  suggestedFilename: string,
): Promise<{ mode: 'redirect'; url: string } | { mode: 'blob'; filename: string }> => {
  const nativeUrl = response.headers.get('X-Archive-Download-Url');
  if (nativeUrl) {
    await response.body?.cancel();
    const url = validateDownloadUrl(nativeUrl);
    startSameWindowDownload(url);
    return { mode: 'redirect', url };
  }

  const advertisedBytes = Number(response.headers.get('Content-Length'));
  const tooLargeToBuffer = Number.isFinite(advertisedBytes) && advertisedBytes > MAX_BUFFERED_ARCHIVE_BYTES;
  const lengthUnknown = !Number.isFinite(advertisedBytes) || advertisedBytes <= 0;

  if ((tooLargeToBuffer || lengthUnknown) && canStreamArchiveToDisk()) {
    const filename = await streamArchiveResponseToDisk(response, suggestedFilename);
    return { mode: 'blob', filename };
  }

  try {
    const blob = await readArchiveBlob(response);
    downloadBlob(blob, suggestedFilename);
    return { mode: 'blob', filename: suggestedFilename };
  } catch (error) {
    if (!(error instanceof ArchiveTooLargeForBuffer)) throw error;
    throw new Error('This archive is too large to prepare in this tab. Please try the download again.');
  }
};

export const resolveShootMediaArchiveRequest = async ({
  address,
  headers,
  onPreparing,
  onDownloading,
  signal,
  requestUrl,
  shootId,
  size,
  type,
}: ResolveShootMediaArchiveRequestOptions): Promise<ShootMediaArchiveDownloadResult> => {
  let currentUrl = validateApiDownloadUrl(requestUrl);
  let waited = false;
  const startedAt = Date.now();

  while (true) {
    const response = await fetchApiDownload(currentUrl, headers, signal);

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      if (contentType.includes('application/json')) {
        const errorData = await extractJsonResponse(response);
        const message = errorData.message || errorData.error || 'Failed to download media';
        throw new Error(message);
      }

      throw new Error('Failed to download media');
    }

    if (contentType.includes('application/json')) {
      const data = await extractJsonResponse(response);

      if (data?.type === 'redirect' && data?.url) {
        onDownloading?.();
        const result = await downloadReadyAsset(data.url, buildShootDownloadFilename(address, type, size), signal);
        emitShootMediaDownloadStarted({ shootId, type, size });
        return { ...result, waited };
      }

      if (data?.type === 'preparing') {
        waited = true;
        const preparingState = {
          message: data.message || 'Preparing your files.',
          pollAfterMs: Math.max(1000, Math.min(10_000, Number(data.poll_after_ms) || 3000)),
        };

        onPreparing?.(preparingState);
        currentUrl = validateApiDownloadUrl(data.status_url || currentUrl);
        if (Date.now() - startedAt > 15 * 60_000) throw new Error('The archive is still preparing. Please try again shortly.');
        await waitForArchive(preparingState.pollAfterMs, signal);
        continue;
      }

      throw new Error(data?.message || 'Unexpected response format');
    }

    if (/text\/html/i.test(contentType)) throw new Error('The archive could not be downloaded. Please try again.');
    onDownloading?.();
    const suggestedFilename =
      getFilenameFromDisposition(response.headers.get('content-disposition')) ||
      buildShootDownloadFilename(address, type, size);

    const result = await deliverAuthenticatedArchiveBody(response, suggestedFilename);
    emitShootMediaDownloadStarted({ shootId, type, size });
    return { ...result, waited };
  }
};

export const downloadShootMediaArchive = async ({
  shootId,
  type,
  size,
  shootServiceId,
  shootUnitId,
  address,
  onPreparing,
  onDownloading,
  signal,
  includeExtras,
  mediaTypes,
  assetType,
}: {
  shootId: string | number;
  type: ShootMediaDownloadType;
  size?: ShootMediaDownloadSize;
  shootServiceId?: string | number | null;
  shootUnitId?: string | number | null;
  address?: string | null;
  onPreparing?: (state: ShootMediaArchivePreparingState) => void;
  onDownloading?: () => void;
  signal?: AbortSignal;
  includeExtras?: boolean;
  mediaTypes?: string[];
  assetType?: 'photos';
}) => {
  const params = new URLSearchParams({ type });
  if (assetType) params.set('asset_type', assetType);
  if (shootUnitId !== undefined && shootUnitId !== null) params.set('shoot_unit_id', String(shootUnitId));
  if (size) {
    params.set('size', size);
  }
  if (shootServiceId !== undefined && shootServiceId !== null && String(shootServiceId).trim() !== '') {
    params.set('shoot_service_id', String(shootServiceId));
  }
  // Extras are excluded server-side by default; opt in explicitly so a
  // "Download all" for a tab never packages media nobody ordered.
  if (includeExtras) {
    params.set('include_extras', '1');
  }
  if (Array.isArray(mediaTypes)) {
    mediaTypes
      .filter((mediaType) => typeof mediaType === 'string' && mediaType.trim() !== '')
      .forEach((mediaType) => params.append('media_types[]', mediaType));
  }

  return resolveShootMediaArchiveRequest({
    address,
    headers: {
      ...getApiHeaders(),
      Accept: 'application/json, application/zip, application/octet-stream',
    },
    onPreparing,
    onDownloading,
    signal,
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
  address,
  onDownloading,
  onPreparing,
  signal,
}: {
  shootId: string | number;
  fileIds?: Array<string | number>;
  address?: string | null;
  onDownloading?: () => void;
  onPreparing?: (state: ShootMediaArchivePreparingState) => void;
  signal?: AbortSignal;
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
  let currentUrl = `${API_BASE_URL}/api/shoots/${shootId}/editor-download-raw${queryString ? `?${queryString}` : ''}`;
  const startedAt = Date.now();

  // Poll preparing responses the same way media archives do. Editors previously
  // blocked on a synchronous multi-GB ZIP in this request and hit 499/502.
  while (true) {
    const response = await fetchApiDownload(currentUrl, headers, signal);
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok && response.status !== 202) {
      if (contentType.includes('application/json')) {
        const errorData = await extractRawJsonResponse(response);
        throw new Error(errorData.error || errorData.message || 'Download failed');
      }

      throw new Error('Download failed');
    }

    if (contentType.includes('application/json')) {
      const data = await extractRawJsonResponse(response);

      if (data.type === 'redirect' && data.url) {
        onDownloading?.();
        const result = await downloadReadyAsset(data.url, buildRawDownloadFilename(shootId, null, address), signal);
        emitShootMediaDownloadStarted({ shootId, type: 'raw', size: 'original' });
        return {
          ...result,
          message: data.message,
          fileCount: data.file_count,
        };
      }

      if (data.type === 'preparing') {
        const preparingState = {
          message: data.message || 'Preparing your raw files.',
          pollAfterMs: Math.max(1000, Math.min(10_000, Number(data.poll_after_ms) || 3000)),
        };
        onPreparing?.(preparingState);
        currentUrl = validateApiDownloadUrl(data.status_url || currentUrl);
        if (Date.now() - startedAt > 15 * 60_000) {
          throw new Error('The archive is still preparing. Please try again shortly.');
        }
        await waitForArchive(preparingState.pollAfterMs, signal);
        continue;
      }

      throw new Error(data.message || data.error || 'Download failed');
    }

    if (/text\/html/i.test(contentType)) throw new Error('The ZIP could not be downloaded. Please try again.');
    onDownloading?.();
    const filename = buildRawDownloadFilename(
      shootId,
      response.headers.get('content-disposition'),
      address,
    );
    const result = await deliverAuthenticatedArchiveBody(response, filename);
    emitShootMediaDownloadStarted({ shootId, type: 'raw', size: 'original' });
    return result;
  }
};

export const downloadShootMediaFile = async ({
  shootId,
  fileId,
  onDownloading,
  format,
  page,
}: {
  shootId: string | number;
  fileId: string | number;
  onDownloading?: () => void;
  format?: 'jpg';
  page?: number;
}): Promise<ShootSingleMediaDownloadResult> => {
  const headers = getApiHeaders();
  headers.Accept = 'application/json, application/octet-stream';
  delete headers['Content-Type'];

  const params = new URLSearchParams();
  if (format) params.set('format', format);
  if (page !== undefined) params.set('page', String(page));
  const query = params.size ? `?${params.toString()}` : '';
  const response = await fetchApiDownload(
    `${API_BASE_URL}/api/shoots/${shootId}/media/${fileId}/download${query}`,
    headers,
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
    if (!('url' in data) || !data.url) {
      throw new Error(data.message || 'Download link not available');
    }

    onDownloading?.();
    return downloadReadyAsset(data.url, `shoot-${shootId}-file-${fileId}`);
  }

  if (/text\/html/i.test(contentType)) throw new Error('The file could not be downloaded. Please try again.');
  onDownloading?.();
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

/**
 * Superadmin-only recovery download for an original whose virus scanner was
 * unavailable. This never uses the normal delivery endpoint, which remains
 * fail-closed for every non-clean file.
 */
export const downloadScanFailedShootFile = async ({
  shootId,
  fileId,
}: {
  shootId: string | number;
  fileId: string | number;
}): Promise<{ filename: string }> => {
  const headers = getApiHeaders();
  headers.Accept = 'application/octet-stream, application/json';
  delete headers['Content-Type'];

  const response = await fetch(
    `${API_BASE_URL}/api/shoots/${shootId}/files/${fileId}/scan-failed-original`,
    { method: 'GET', headers },
  );
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const data = await extractJsonResponse(response);
      throw new Error(data.message || data.error || 'Failed to download original');
    }
    throw new Error('Failed to download original');
  }

  const blob = await response.blob();
  const filename =
    getFilenameFromDisposition(response.headers.get('content-disposition')) ||
    `shoot-${shootId}-scan-failed-file-${fileId}`;
  downloadBlob(blob, filename);

  return { filename };
};
