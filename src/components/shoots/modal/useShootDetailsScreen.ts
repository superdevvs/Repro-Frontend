import { useCallback, useEffect, useState } from 'react';
import { ShootData } from '@/types/shoots';
import { useShoot } from '@/hooks/useShoot';
import { useShootDetailsController } from './useShootDetailsController';
import { useShootRawFileCount } from './useShootRawFileCount';

interface UseShootDetailsScreenInput {
  shootId: string | number | null | undefined;
  enabled?: boolean;
  currentRole?: string;
  authRole?: string;
  userId?: string | number | null;
  shouldHideClientDetailsProp?: boolean;
}

export function useShootDetailsScreen({
  shootId,
  enabled = true,
  currentRole,
  authRole,
  userId,
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
    shouldHideClientDetailsProp,
  });

  const refreshShoot = useCallback(async (): Promise<ShootData | null> => {
    if (!shootId) return null;

    try {
      const result = await refetchShoot();
      if (result.data) {
        setShoot(result.data);
        return result.data;
      }
      return shootData ?? null;
    } catch (error) {
      console.error('Error refreshing shoot:', error);
      return shootData ?? null;
    }
  }, [refetchShoot, shootData, shootId]);

  const rawFileCount = useShootRawFileCount(
    shoot?.id ?? shootId,
    controller.roleFlags.isEditor,
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
