import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';
import { getApiHeaders } from '@/services/api';

/** Tour content the owner can keep off the shared tour pages without deleting it. */
export const tourVisibilityContent = ['video', 'matterport', 'iguide', 'cubicasa', 'zillow'] as const;
export type TourVisibilityContent = typeof tourVisibilityContent[number];
export type TourVisibilityPage = 'branded' | 'mls';
export type TourVisibilityKey = `show_${TourVisibilityContent}_on_${TourVisibilityPage}`;
export type TourVisibility = Record<TourVisibilityKey, boolean>;

export const tourVisibilityKey = (content: TourVisibilityContent, page: TourVisibilityPage): TourVisibilityKey =>
  `show_${content}_on_${page}`;

export const tourVisibilityKeys: TourVisibilityKey[] = tourVisibilityContent.flatMap(
  (content) => [tourVisibilityKey(content, 'branded'), tourVisibilityKey(content, 'mls')],
);

/** A switch is on until it has been saved as off. */
export const readTourVisibility = (links: Record<string, unknown> | null | undefined): TourVisibility =>
  Object.fromEntries(tourVisibilityKeys.map((key) => [key, links?.[key] !== false])) as TourVisibility;

/** Where content is switched off, in the words shown next to its row. */
export function hiddenOnLabel(visibility: TourVisibility, content: TourVisibilityContent): string {
  const branded = visibility[tourVisibilityKey(content, 'branded')];
  const mls = visibility[tourVisibilityKey(content, 'mls')];
  if (branded && mls) return '';
  if (!branded && !mls) return 'Hidden on public tours';
  return branded ? 'Hidden on MLS tours' : 'Hidden on Branded tour';
}

export interface PublicTourVisibilityOptions {
  canManage: boolean;
  canOpenSavedLink: boolean;
  visibility: TourVisibility;
}

export interface PublicTourVisibilityControl {
  canManage: boolean;
  canOpenSavedLink: boolean;
  visibility: TourVisibility;
  saving: boolean;
  save: (key: TourVisibilityKey, enabled: boolean) => Promise<void>;
}

const failed = 'Could not save public tour visibility. Please try again.';

export function usePublicTourVisibility(
  shootId: string | number,
  unitId: string | number | undefined,
  options: PublicTourVisibilityOptions | undefined,
  onShootUpdate: () => void,
): PublicTourVisibilityControl {
  const { toast } = useToast();
  // The saved switches arrive as a new object on every shoot refresh.
  const savedSignature = tourVisibilityKeys.map((key) => (options?.visibility?.[key] === false ? '0' : '1')).join('');
  const [visibility, setVisibility] = useState<TourVisibility>(() => readTourVisibility(options?.visibility));
  const [saving, setSaving] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    setVisibility(Object.fromEntries(
      tourVisibilityKeys.map((key, index) => [key, savedSignature[index] === '1']),
    ) as TourVisibility);
  }, [shootId, unitId, savedSignature]);
  useEffect(() => {
    setSaving(false);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [shootId, unitId]);

  const save = async (key: TourVisibilityKey, enabled: boolean) => {
    if (!options?.canManage || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/tour-visibility`, {
        method: 'PATCH',
        headers: getApiHeaders(),
        signal: controller.signal,
        body: JSON.stringify({ [key]: enabled, ...(unitId ? { unit_id: unitId } : {}) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || failed);
      const saved = payload?.data;
      if (typeof saved?.[key] !== 'boolean' || saved[key] !== enabled) {
        throw new Error('The saved setting could not be confirmed. Refresh and try again.');
      }
      if (controller.signal.aborted) return;
      setVisibility((current) => readTourVisibility({ ...current, ...saved }));
      onShootUpdate();
    } catch (error) {
      if (!controller.signal.aborted) {
        toast({
          title: 'Public tour visibility',
          description: error instanceof Error ? error.message : failed,
          variant: 'destructive',
        });
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setSaving(false);
      }
    }
  };

  return {
    canManage: options?.canManage === true,
    canOpenSavedLink: options?.canOpenSavedLink === true,
    visibility,
    saving,
    save,
  };
}
