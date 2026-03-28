import { useMemo } from 'react';
import { ShootData } from '@/types/shoots';
import { getShootDetailsCapabilities } from './shootDetailsCapabilities';
import { getShootDetailsVisibleTabs } from './shootDetailsTabRegistry';

interface UseShootDetailsControllerInput {
  currentRole?: string;
  authRole?: string;
  shoot: ShootData | null;
  userId?: string | number | null;
  shouldHideClientDetailsProp?: boolean;
}

export function useShootDetailsController({
  currentRole,
  authRole,
  shoot,
  userId,
  shouldHideClientDetailsProp = false,
}: UseShootDetailsControllerInput) {
  const currentUserRole = currentRole || authRole || '';

  const roleFlags = useMemo(() => {
    const isEditingManager = currentUserRole === 'editing_manager';
    const isAdmin =
      ['admin', 'superadmin'].includes(currentUserRole) || isEditingManager;
    const isRep =
      currentUserRole === 'salesRep' || currentUserRole === 'rep' || currentUserRole === 'representative';
    const isPhotographer = currentUserRole === 'photographer';
    const isEditor = currentUserRole === 'editor';
    const isClient = currentUserRole === 'client';

    return {
      isEditingManager,
      isAdmin,
      isRep,
      isAdminOrRep: isAdmin || isRep,
      isPhotographer,
      isEditor,
      isClient,
    };
  }, [currentUserRole]);

  const shouldHideClientDetails =
    shouldHideClientDetailsProp || roleFlags.isEditor;

  const isRequestedStatus = useMemo(() => {
    const status = String(shoot?.status || shoot?.workflowStatus || '')
      .toLowerCase()
      .trim();
    return status === 'requested';
  }, [shoot?.status, shoot?.workflowStatus]);

  const capabilities = useMemo(
    () =>
      getShootDetailsCapabilities({
        shoot,
        currentUserRole,
        roleFlags,
        userId,
      }),
    [currentUserRole, roleFlags, shoot, userId],
  );

  const visibleTabs = useMemo(
    () =>
      getShootDetailsVisibleTabs({
        isAdmin: roleFlags.isAdmin,
        isClient: roleFlags.isClient,
        isRequestedStatus,
        shoot,
      }),
    [isRequestedStatus, roleFlags.isAdmin, roleFlags.isClient, shoot],
  );

  return {
    currentUserRole,
    roleFlags,
    shouldHideClientDetails,
    isRequestedStatus,
    capabilities,
    visibleTabs,
  };
}
