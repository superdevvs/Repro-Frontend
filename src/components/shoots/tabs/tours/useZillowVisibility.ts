import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';
import { getApiHeaders } from '@/services/api';

export interface ZillowVisibilityOptions {
  canManage: boolean;
  canOpenSavedLink: boolean;
  showOnBranded: boolean;
  showOnMls: boolean;
}

const visibilityKeys = ['show_zillow_on_branded', 'show_zillow_on_mls'] as const;
type VisibilityKey = typeof visibilityKeys[number];
type Visibility = Record<VisibilityKey, boolean>;

export function useZillowVisibility(
  shootId: string | number,
  unitId: string | number | undefined,
  options: ZillowVisibilityOptions | undefined,
  onShootUpdate: () => void,
) {
  const { toast } = useToast();
  const showOnBranded = options?.showOnBranded ?? true;
  const showOnMls = options?.showOnMls ?? true;
  const [visibility, setVisibility] = useState<Visibility>({
    show_zillow_on_branded: showOnBranded, show_zillow_on_mls: showOnMls,
  });
  const [saving, setSaving] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    setVisibility({ show_zillow_on_branded: showOnBranded, show_zillow_on_mls: showOnMls });
  }, [shootId, unitId, showOnBranded, showOnMls]);
  useEffect(() => {
    setSaving(false);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [shootId, unitId]);

  const saveVisibility = async (key: VisibilityKey, enabled: boolean) => {
    if (!options?.canManage || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/zillow-visibility`, {
        method: 'PATCH',
        headers: getApiHeaders(),
        signal: controller.signal,
        body: JSON.stringify({ [key]: enabled, ...(unitId ? { unit_id: unitId } : {}) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Could not save Zillow visibility. Please try again.');
      const saved = payload?.data;
      if (!visibilityKeys.every(flag => typeof saved?.[flag] === 'boolean') || saved[key] !== enabled) {
        throw new Error('The saved setting could not be confirmed. Refresh and try again.');
      }
      if (controller.signal.aborted) return;
      setVisibility(saved);
      onShootUpdate();
    } catch (error) {
      if (!controller.signal.aborted) {
        toast({
          title: 'Zillow visibility',
          description: error instanceof Error ? error.message : 'Could not save Zillow visibility. Please try again.',
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

  return { visibility, saving, saveVisibility };
}
