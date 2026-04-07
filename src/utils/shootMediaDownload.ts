import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';

export type ShootMediaDownloadType = 'raw' | 'edited';
export type ShootMediaDownloadSize = 'original' | 'small' | 'medium' | 'large';
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
  shootId: string | number;
  type: ShootMediaDownloadType;
  size?: ShootMediaDownloadSize;
}) => {
  if (typeof window === 'undefined') {
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

export const downloadShootMediaArchive = async ({
  shootId,
  type,
  size,
  address,
}: {
  shootId: string | number;
  type: ShootMediaDownloadType;
  size?: ShootMediaDownloadSize;
  address?: string | null;
}) => {
  const params = new URLSearchParams({ type });
  if (size) {
    params.set('size', size);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/shoots/${shootId}/media/download-zip?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        ...getApiHeaders(),
        Accept: 'application/json, application/zip, application/octet-stream',
      },
    },
  );

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to download media');
    }
    throw new Error('Failed to download media');
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (data?.type === 'redirect' && data?.url) {
      window.open(data.url, '_blank', 'noopener,noreferrer');
      emitShootMediaDownloadStarted({ shootId, type, size });
      return { mode: 'redirect' as const, url: data.url as string };
    }

    throw new Error(data?.message || 'Unexpected response format');
  }

  const blob = await response.blob();
  const suggestedFilename =
    getFilenameFromDisposition(response.headers.get('content-disposition')) ||
    buildShootDownloadFilename(address, type, size);

  downloadBlob(blob, suggestedFilename);
  emitShootMediaDownloadStarted({ shootId, type, size });
  return { mode: 'blob' as const, filename: suggestedFilename };
};
