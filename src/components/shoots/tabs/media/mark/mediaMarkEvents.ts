import type { MediaFile } from '@/hooks/useShootFiles';

export type MediaMarkTab = 'type' | 'service' | 'delivery';
export interface MediaMarkRequest {
  shootId: string | number; shootLabel?: string; files?: MediaFile[]; initialTab?: MediaMarkTab;
  allowType?: boolean; onChanged?: () => void | Promise<void>;
}
export const MEDIA_MARK_EVENT = 'shoot-media-mark';
export function openMediaMark(request: MediaMarkRequest) {
  window.dispatchEvent(new CustomEvent<MediaMarkRequest>(MEDIA_MARK_EVENT, { detail: request }));
}
