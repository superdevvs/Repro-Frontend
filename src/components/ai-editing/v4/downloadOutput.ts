import { apiClient } from '@/services/api';
import type { V4Output } from '@/components/studio/v4/types';

/** Fetch the authorized attachment, then save a local object URL (cross-origin download attributes are ignored). */
export async function downloadWorkspaceOutput(workspaceId: string, output: Pick<V4Output, 'id' | 'kind' | 'version'>, name: string): Promise<void> {
  let blob: Blob;
  try {
    const response = await apiClient.get<Blob>(`/studio/workspaces/${encodeURIComponent(workspaceId)}/outputs/${encodeURIComponent(output.id)}/download`, { responseType: 'blob' });
    blob = response.data;
  } catch (reason) {
    const data = (reason as { response?: { data?: Blob } })?.response?.data;
    if (data instanceof Blob && data.type.includes('json')) {
      let message: unknown;
      try { message = JSON.parse(await data.text()).message; } catch { /* Keep the original transport error if no JSON message is available. */ }
      if (typeof message === 'string' && message) throw new Error(message);
    }
    throw reason;
  }
  if (!blob.size) throw new Error('The downloaded file is empty. Please try again.');
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'video/mp4': 'mp4', 'video/webm': 'webm' };
  const extension = extensions[blob.type.split(';')[0]] || (output.kind === 'video' ? 'mp4' : 'jpg');
  const baseName = [...name].filter(character => character.charCodeAt(0) >= 32).join('').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[<>:"/\\|?*]/g, '-').trim().slice(0, 100) || 'studio-output';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${baseName}-v${output.version}.${extension}`; anchor.hidden = true;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally {
    anchor.remove();
    // Let the browser begin consuming the blob before releasing its backing memory.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
