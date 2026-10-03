import { useEffect, useMemo, useReducer, useRef } from 'react';
import type { MediaFile } from '@/hooks/useShootFiles';
import { getMediaFullSizeImageUrl, getMediaViewerImageCandidates } from './mediaPreviewUtils';
import { isRawFile } from '@/services/rawPreviewService';
import { isPreviewableImage, isVideoFile } from './mediaViewerFileTypes';
import { ViewerImageBuffer, type ImageRequest } from './viewerImageBuffer';

export function useViewerImages(files: MediaFile[], index: number, mode: 'web' | 'full', enabled: boolean, canViewFullSize: boolean, scope: string, refresh?: () => void) {
  const [, redraw] = useReducer((v: number) => v + 1, 0);
  // Access changes must discard all decoded data from the previous access scope.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const buffer = useMemo(() => new ViewerImageBuffer(redraw, (typeof window !== 'undefined' && window.innerWidth < 768 ? 96 : 192) * 1024 * 1024), [scope, canViewFullSize]);
  const previousIndex = useRef(index);
  const lastDirection = useRef(1);
  const direction = index === previousIndex.current ? lastDirection.current : index < previousIndex.current ? -1 : 1;
  const refreshed = useRef(new Set<string>());
  const key = (file: MediaFile, rendition: string) => `${scope}:${file.id}:${file.media_revision ?? file.content_version ?? file.processed_at ?? 0}:${file.uses_watermark ? 'wm' : 'released'}:${rendition}`;
  const preview = (file: MediaFile) => getMediaViewerImageCandidates(file).find((url) => !buffer.failed.has(`${key(file, 'web')}:${url}`)) || '';
  const full = (file: MediaFile) => canViewFullSize && !file.uses_watermark && !isRawFile(file.filename) && !/\.(tiff?|heic|heif)$/i.test(file.filename) ? getMediaFullSizeImageUrl(file) : '';
  const request = (file: MediaFile, original: boolean, current: boolean): ImageRequest => {
    const url = original ? full(file) : preview(file);
    return { key: `${key(file, original ? 'full' : 'web')}:${url}`, url, original, current,
      bytes: buffer.sizes.get(`${key(file, original ? 'full' : 'web')}:${url}`) || (file.width && file.height ? file.width * file.height * 4 : 96 * 1024 * 1024) };
  };
  const requests: ImageRequest[] = [];
  if (enabled) {
    const add = (offset: number, original: boolean) => {
      const file = files[index + offset];
      if (file && isPreviewableImage(file) && !isVideoFile(file)) requests.push(request(file, original, offset === 0));
    };
    add(0, false);
    if (mode === 'full' && canViewFullSize) add(0, true);
    for (const offset of [direction, -direction, direction * 2, -direction * 2, direction * 3]) add(offset, false);
    if (mode === 'full' && canViewFullSize) { add(direction, true); add(-direction, true); }
  }
  const fingerprint = JSON.stringify(requests);
  useEffect(() => {
    lastDirection.current = direction;
    previousIndex.current = index;
    buffer.configure(JSON.parse(fingerprint) as ImageRequest[]);
  }, [buffer, fingerprint, index, direction]);
  useEffect(() => () => buffer.dispose(), [buffer]);
  useEffect(() => { if (!enabled) { buffer.dispose(); refreshed.current.clear(); } }, [enabled, buffer]);

  const resolve = (file?: MediaFile) => {
    if (!file) return { url: '', ready: false, error: false, loadingFullSize: false, message: '', displayed: 'web' as const };
    const web = request(file, false, true);
    const original = request(file, true, true);
    const webEntry = buffer.entries.get(web.key);
    const fullEntry = buffer.entries.get(original.key);
    const useFull = mode === 'full' && canViewFullSize;
    const available = Boolean(original.url && original.url !== web.url);
    const fullReady = useFull && available && fullEntry?.state === 'ready';
    const fallbackReady = !useFull || !available || fullEntry?.state === 'error';
    return {
      url: fullReady ? original.url : web.url,
      displayed: fullReady ? 'full' as const : 'web' as const,
      ready: Boolean(fullReady || (fallbackReady && webEntry?.state === 'ready')),
      error: !fullReady && (!web.url || webEntry?.state === 'error'),
      loadingFullSize: Boolean(useFull && available && !fullReady && fullEntry?.state !== 'error'),
      message: useFull && !fullReady ? (!available || fullEntry?.state === 'error' ? 'Full-size preview unavailable' : 'Loading full size…') : '',
    };
  };
  const current = resolve(files[index]);
  const failedPreview = files[index] ? [...buffer.failed].some(failed => failed.startsWith(key(files[index], 'web') + ':')) : false;
  const failedOriginal = files[index] ? buffer.entries.get(request(files[index], true, true).key)?.state === 'error' : false;
  useEffect(() => {
    const file = files[index];
    if (!enabled || !file || (!current.error && !failedOriginal && !failedPreview) || !refresh) return;
    const refreshKey = key(file, 'refresh');
    if (refreshed.current.has(refreshKey)) return;
    refreshed.current.add(refreshKey);
    refresh();
  }, [enabled, files, index, current.error, failedOriginal, failedPreview, refresh, scope]);
  return { ...current, resolve, fail: () => {
    const file = files[index];
    if (file) buffer.fail(request(file, current.displayed === 'full', true).key);
  } };
}
