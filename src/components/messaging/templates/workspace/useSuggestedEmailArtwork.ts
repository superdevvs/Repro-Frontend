import { useEffect, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { generateEmailArtwork, getEmailArtwork } from '@/services/emailTemplateWorkspace';
import type { EmailWorkspaceDraft, EmailArtworkKind } from '@/types/emailTemplateWorkspace';

type Request = { id: string; prompt: string; kind: EmailArtworkKind };
function restore(key: string): Request[] {
  try { const value = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(item => typeof item?.id === 'string' && typeof item.prompt === 'string' && ['icon', 'illustration', 'header'].includes(item.kind)).slice(-24) : []; }
  catch { return []; }
}

/** Paid requests survive applying a draft/reloading. A replacement image clears
 * its ID, so a late result can never overwrite the user's replacement. */
export function useSuggestedEmailArtwork(target: EmailWorkspaceDraft, canStart: boolean, paused: boolean, onReady: (images: { id: string; url: string }[]) => void) {
  const { user } = useAuth();
  const key = `repro-email-suggested-artwork:${user?.id ?? 'anonymous'}`;
  const registry = useRef({ key, requests: restore(key) });
  if (registry.current.key !== key) registry.current = { key, requests: restore(key) };
  const started = useRef(new Set<string>());
  const onReadyRef = useRef(onReady); onReadyRef.current = onReady;
  const imageSections = target.editor_document_json.sections.filter(section => ['hero', 'feature', 'image'].includes(section.type));
  if (canStart && user?.id) {
    for (const section of imageSections.filter(item => item.artwork_id && item.image_prompt).slice(0, 3)) {
      if (!registry.current.requests.some(item => item.id === section.artwork_id)) registry.current.requests.push({ id: section.artwork_id!, prompt: section.image_prompt!, kind: section.type === 'feature' ? 'icon' : 'header' });
    }
    registry.current.requests = registry.current.requests.slice(-24);
  }
  const savedKey = JSON.stringify(registry.current.requests);
  useEffect(() => { try { localStorage.setItem(key, savedKey); } catch { /* Session IDs still prevent duplicate requests. */ } }, [key, savedKey]);
  const requests = registry.current.requests.filter(request => imageSections.some(section => section.artwork_id === request.id));
  const queries = useQueries({ queries: requests.map(request => ({
    queryKey: ['email-suggested-artwork', user?.id, request.id],
    queryFn: async () => {
      if (started.current.has(request.id)) return getEmailArtwork(request.id);
      const result = await generateEmailArtwork(request);
      started.current.add(request.id); return result;
    },
    retry: false as const,
    refetchInterval: (query: { state: { data?: { status: string } } }) => ['queued', 'processing'].includes(query.state.data?.status ?? '') ? 3000 : false as const,
  })) });
  const completed = queries.map(query => query.data?.status === 'completed' && query.data.url ? { id: query.data.id, url: query.data.url } : null).filter((item): item is { id: string; url: string } => Boolean(item));
  const completedKey = JSON.stringify(completed);
  const targetKey = JSON.stringify(imageSections.map(section => [section.artwork_id, section.image_url]));
  useEffect(() => {
    if (paused) return;
    const images = JSON.parse(completedKey) as { id: string; url: string }[];
    if (images.length) onReadyRef.current(images);
  }, [completedKey, targetKey, paused]);
  return {
    running: queries.some(query => query.isPending || ['queued', 'processing'].includes(query.data?.status ?? '')),
    failed: queries.some(query => query.isError || ['failed', 'unknown'].includes(query.data?.status ?? '')),
    total: requests.length, completed: completed.length,
    retry: () => queries.forEach(query => { if (query.data?.status !== 'completed') void query.refetch(); }),
  };
}
