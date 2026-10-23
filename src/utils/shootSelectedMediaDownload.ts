import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { buildShootZipFilename, parseDownloadFilename } from './shootDownloadFilename';
import { deliverAuthenticatedArchiveBody } from './shootMediaDownload';

export async function downloadShootSelectedMedia({ shootId, fileIds, size, address }: {
  shootId: string | number;
  fileIds: string[];
  size: 'original' | 'small';
  address?: string | null;
}) {
  if (!fileIds.length) throw new Error('Please select files to download.');
  const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files/download`, {
    method: 'POST',
    headers: { ...getApiHeaders(), 'Content-Type': 'application/json', Accept: 'application/zip, application/json' },
    redirect: 'error',
    body: JSON.stringify({ file_ids: fileIds, size }),
  });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || contentType.includes('application/json')) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || 'Failed to download selected files.');
  }
  if (/text\/html/i.test(contentType)) throw new Error('Failed to download selected files.');
  const filename = parseDownloadFilename(response.headers.get('content-disposition'))
    || buildShootZipFilename(address, size === 'small' ? 'selected-mls' : 'selected-print', shootId);
  return { ...await deliverAuthenticatedArchiveBody(response, filename), waited: false };
}
