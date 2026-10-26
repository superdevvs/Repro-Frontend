import { useAuth } from '@/components/auth/AuthProvider';
import { useEffect, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getEmailAsset } from '@/services/emailWorkspaceV2';
import type { EmailMediaAsset, EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';
import { flattenEmailSections } from './emailWorkspaceTree';
import type { EmailArtworkStates } from './emailArtworkPreview';

export function useEmailWorkspaceMedia(draft: EmailWorkspaceDraft, enabled: boolean, paused: boolean, onReady: (assets: EmailMediaAsset[]) => void, templateId?: number) {
  const { user } = useAuth();
  const callback = useRef(onReady); callback.current = onReady;
  const sections = flattenEmailSections(draft.editor_document_json.sections);
  const ids = [...new Set(sections.map(section => section.media_id).filter((id): id is string => Boolean(id)))];
  const queries = useQueries({ queries: ids.map(id => ({ queryKey: ['email-media-asset', user?.id, templateId, id], queryFn: () => getEmailAsset(id, templateId), enabled,
    retry: false, refetchInterval: (query: { state: { data?: EmailMediaAsset } }) => query.state.data?.status === 'processing' ? 2000 : false as const,
  })) });
  const complete = queries.map(query => query.data).filter((item): item is EmailMediaAsset => item?.status === 'ready' && Boolean(item.url));
  const key = JSON.stringify(complete), targetKey = JSON.stringify(sections.map(item => [item.media_id, item.image_url]));
  useEffect(() => { if (enabled && !paused && key !== '[]') callback.current(JSON.parse(key)); }, [enabled, paused, key, targetKey]);
  const images: EmailArtworkStates = !enabled ? {} : Object.fromEntries(ids.map((id, index) => {
    const query = queries[index], section = sections.find(item => item.media_id === id)!;
    return [id, { label: 'Optimizing image', ratio: query.data?.width && query.data.height ? `${query.data.width} / ${query.data.height}` : undefined, kind: section.type === 'hero' ? 'header' : section.type === 'feature' ? 'icon' : 'illustration', status: query.data?.status === 'ready' ? 'ready' : query.isError || query.data?.status === 'failed' ? 'failed' : 'loading', url: query.data?.url ?? undefined }];
  }));
  return { images, retry: () => queries.forEach(query => void query.refetch()), running: enabled && queries.some(query => query.isPending || query.data?.status === 'processing'), failed: queries.some(query => query.isError || query.data?.status === 'failed') };
}
