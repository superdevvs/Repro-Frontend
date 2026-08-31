import {
  normalizeIguideOfflinePackage,
  type NormalizedIguideOfflinePackage,
} from '@/utils/shootTourData';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';

export const IGUIDE_OFFLINE_PACKAGE_MAX_BYTES = 256 * 1024 * 1024;

const ACCEPTED_ZIP_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'application/x-zip-compressed',
  'application/zip',
]);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};

export const formatFileSize = (bytes?: number | null) => {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const validateIguideOfflineZip = (file: File): string | null => {
  if (!/\.zip$/i.test(file.name.trim())) {
    return 'Choose an iGUIDE offline package ending in .zip.';
  }

  if (!ACCEPTED_ZIP_MIME_TYPES.has(String(file.type || '').toLowerCase())) {
    return 'This file is not recognized as a ZIP package.';
  }

  if (file.size <= 0) {
    return 'The selected ZIP is empty.';
  }

  if (file.size > IGUIDE_OFFLINE_PACKAGE_MAX_BYTES) {
    return 'The ZIP is larger than the 256 MB upload limit.';
  }

  return null;
};

export const parseIguideOfflinePackageResponse = (
  payload: unknown,
  fallbackFile?: File,
): NormalizedIguideOfflinePackage => {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const shoot = asRecord(root.shoot ?? data.shoot);
  const iguideData = asRecord(
    shoot.iguide_data
      ?? shoot.iguideData
      ?? data.iguide_data
      ?? data.iguideData,
  );
  const candidate = root.package
    ?? data.package
    ?? iguideData.manual_offline_package
    ?? iguideData.manualOfflinePackage
    ?? root.manual_offline_package
    ?? data.manual_offline_package;
  const normalized = normalizeIguideOfflinePackage(candidate);

  if (normalized.exists) return normalized;

  return normalizeIguideOfflinePackage({
    status: root.status ?? data.status ?? 'queued',
    original_filename: fallbackFile?.name,
    size_bytes: fallbackFile?.size,
  });
};

export const getIguidePackageStatusLabel = (offlinePackage: NormalizedIguideOfflinePackage) => {
  switch (offlinePackage.status) {
    case 'queued':
      return 'Queued';
    case 'scanning':
      return 'Scanning';
    case 'ready':
      return 'Ready';
    case 'failed':
      return 'Failed';
    default:
      return offlinePackage.exists ? 'Processing' : 'Not uploaded';
  }
};

const getDownloadFilename = (contentDisposition: string | null, fallback: string) => {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, ''));
    } catch {
      return utf8Match[1].replace(/["']/g, '');
    }
  }
  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] || fallback;
};

export const downloadIguideOfflinePackage = async ({
  fileId,
  filename,
  shootId,
}: {
  fileId: string | number;
  filename?: string;
  shootId: string | number;
}) => {
  const headers = getApiHeaders();
  headers.Accept = 'application/octet-stream';
  delete headers['Content-Type'];
  const response = await fetch(
    `${API_BASE_URL}/api/shoots/${shootId}/media/${fileId}/download`,
    { method: 'GET', headers },
  );

  if (!response.ok) {
    let message = 'Could not download the iGUIDE ZIP.';
    try {
      const payload = await response.json();
      message = payload.message || payload.error || message;
    } catch {
      // The endpoint may return a streamed/plain response on failure.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = getDownloadFilename(
    response.headers.get('content-disposition'),
    filename || 'iguide-offline-package.zip',
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
};
