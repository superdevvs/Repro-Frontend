import { apiClient } from './api';
import { studioError } from './studioWorkspaceService';

/** Saving bytes and publishing them are different outcomes. Never ask for a duplicate upload on refresh failure. */
export async function waitForSavedMedia(shootId: string | number, ids: string[], signal?: AbortSignal): Promise<{ published: boolean; message: string }> {
  const pending = new Set(ids);
  try {
    for (let attempt = 0; attempt < 90 && pending.size; attempt++) {
      if (signal?.aborted) return { published: false, message: 'Uploads are saved. Processing continues; refresh before submitting.' };
      const results = await Promise.all([...pending].map(async id => {
        const { data } = await apiClient.get<{ data: { status: string; error?: string } }>(`/shoots/${shootId}/media-versions/${id}`, { signal });
        return { id, ...data.data };
      }));
      for (const result of results) {
        if (['published', 'archived'].includes(result.status)) pending.delete(result.id);
        else if (['failed', 'conflict', 'alternative', 'dismissed'].includes(result.status)) return { published: false, message: result.error || 'A saved edit needs review in Versions / upload saved edit. The current image is unchanged.' };
      }
      if (pending.size) await new Promise<void>(resolve => { const timer = setTimeout(done, 2000); function done() { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); } signal?.addEventListener('abort', done, { once: true }); });
    }
    return pending.size ? { published: false, message: 'Uploads are saved and still processing. Refresh before submitting; no re-upload is needed.' } : { published: true, message: 'Saved edits are now current. Previous versions were retained.' };
  } catch (error) { return { published: false, message: 'Uploads are saved, but publication status could not refresh. Refresh before submitting. ' + studioError(error) }; }
}
