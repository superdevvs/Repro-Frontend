import { useEffect, useMemo, useRef, useState } from 'react';
import { buildMediaStacks } from '@/components/shoots/tabs/media/mediaGridStacks';
import type { SourceMedia } from '@/services/studioService';
import { sourceMedia, studioError, workspaceSources } from '@/services/studioWorkspaceService';
import type { V4Media } from './types';

export type SourceTab = 'raw' | 'edited';
export interface PickerTile { id: string; sources: SourceMedia[]; media?: V4Media }
interface MergeState { media?: V4Media; error?: string }

export function buildPickerTiles(items: SourceMedia[], tab: SourceTab): PickerTile[] {
  const filtered = items.filter(m => tab === 'edited' ? ['completed', 'verified'].includes(m.workflowStage || '') : !m.workflowStage || m.workflowStage === 'todo');
  if (tab === 'edited') return filtered.map(m => ({ id: `file:${m.id}`, sources: [m], media: sourceMedia(m) }));
  const groups = new Map<string, SourceMedia[]>();
  filtered.forEach(m => {
    const key = `${m.shootId}:${m.shootServiceId ?? 'unassigned'}`;
    groups.set(key, [...(groups.get(key) || []), m]);
  });
  return [...groups.entries()].flatMap(([key, files]) => {
    const byId = new Map(files.map(m => [String(m.id), m]));
    const mode = files[0].bracketMode;
    return buildMediaStacks(files.map(m => ({ id: String(m.id), filename: m.filename, media_type: m.captureType || m.mediaType, bracket_group: m.bracketGroup ?? undefined, sequence: m.sequence ?? undefined, captured_at: m.capturedAt ?? undefined, created_at: m.createdAt ?? undefined, isExtra: m.isExtra })), {
      shouldStackRawFiles: files[0].stackingEnabled !== false,
      normalizedRawStackSize: mode && mode > 1 ? mode : null,
      isVideo: m => byId.get(m.id)?.mediaType === 'video',
    }).map(stack => {
      const sources = stack.files.map(m => byId.get(m.id)!);
      return { id: `${key}:${sources.map(m => m.id).join('-')}`, sources, media: sources.length === 1 ? sourceMedia(sources[0]) : undefined };
    });
  });
}

export function usePickerSources(items: SourceMedia[], enabled: boolean, tab: SourceTab) {
  const raw = useMemo(() => buildPickerTiles(items, 'raw'), [items]);
  const edited = useMemo(() => buildPickerTiles(items, 'edited'), [items]);
  const [merges, setMerges] = useState<Record<string, MergeState>>({});
  const cache = useRef<Record<string, MergeState>>({});
  const [retry, setRetry] = useState(0);
  useEffect(() => { cache.current = {}; setMerges({}); }, [items]);
  useEffect(() => {
    if (!enabled || tab !== 'raw') return;
    const controller = new AbortController();
    const run = async () => {
      for (const tile of raw) {
        if (controller.signal.aborted) return;
        if (tile.media || cache.current[tile.id]?.media || cache.current[tile.id]?.error) continue;
        let result: MergeState;
        try { result = { media: await workspaceSources.mergeHdr(tile.sources.map(m => m.id), controller.signal) }; }
        catch (error) { result = { error: studioError(error) }; }
        if (controller.signal.aborted) return;
        cache.current[tile.id] = result;
        setMerges(current => ({ ...current, [tile.id]: result }));
      }
    };
    void run();
    return () => controller.abort();
  }, [raw, enabled, tab, retry]);
  const tiles = (tab === 'raw' ? raw : edited).map(tile => ({ ...tile, ...merges[tile.id] }));
  return { tiles, rawCount: raw.length, editedCount: edited.length, retryMerge: (id: string) => {
    delete cache.current[id];
    setMerges(current => { const next = { ...current }; delete next[id]; return next; });
    setRetry(current => current + 1);
  } };
}
