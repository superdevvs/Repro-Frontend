import { useCallback, useEffect, useState } from 'react';
import { ShootData } from '@/types/shoots';
import { useShoot } from '@/hooks/useShoot';
import { useShootDetailsController } from './useShootDetailsController';
import { useShootRawFileCount } from './useShootRawFileCount';
import { registerShootDetailRefresh } from '@/realtime/realtimeRefreshBus';
import type { VideoTourEditor } from '../tabs/tours/videoTourAccess';

interface UseShootDetailsScreenInput {
  shootId: string | number | null | undefined;
  enabled?: boolean;
  currentRole?: string;
  authRole?: string;
  userId?: string | number | null;
  editorUser?: VideoTourEditor;
  shouldHideClientDetailsProp?: boolean;
}

export function useShootDetailsScreen({
  shootId,
  enabled = true,
  currentRole,
  authRole,
  userId,
  editorUser,
  shouldHideClientDetailsProp = false,
}: UseShootDetailsScreenInput) {
  const [shoot, setShoot] = useState<ShootData | null>(null);
  const {
    data: shootData,
    isLoading: shootLoading,
    error: shootError,
    refetch: refetchShoot,
  } = useShoot(enabled ? shootId : null, { enabled });

  useEffect(() => {
    if (shootData) {
      setShoot(shootData);
    }
  }, [shootData]);

  const controller = useShootDetailsController({
    currentRole,
    authRole,
    shoot,
    userId,
    editorUser,
    shouldHideClientDetailsProp,
  });

  const refreshShoot = useCallback(async (options?: { requireFresh: boolean }): Promise<ShootData | null> => {
    if (!shootId) return null;

    try {
      // A failed or cancelled refetch can still expose cached data. Review needs a successful server read.
      if (options?.requireFresh) {
        const fresh = await refetchShoot({ throwOnError: true, cancelRefetch: false });
        return fresh.isSuccess ? fresh.data : null;
      }
      const result = await refetchShoot();
      if (result.data) {
        setShoot(result.data);
        return result.data;
      }
      return shootData ?? null;
    } catch (error) {
      if (options?.requireFresh) return null;
      console.error('Error refreshing shoot:', error);
      return shootData ?? null;
    }
  }, [refetchShoot, shootData, shootId]);

  useEffect(() => {
    if (!shootId || !enabled) return;

    return registerShootDetailRefresh(shootId, () => {
      void refreshShoot();
    });
  }, [enabled, refreshShoot, shootId]);

  const rawFileCount = useShootRawFileCount(
    shoot?.id ?? shootId,
    controller.roleFlags.isEditor || controller.roleFlags.isAdmin || controller.roleFlags.isPhotographer,
    shoot,
  );

  return {
    shoot,
    setShoot,
    shootLoading,
    shootError,
    refreshShoot,
    rawFileCount,
    ...controller,
  };
}
