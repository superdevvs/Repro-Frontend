import { useMemo } from 'react';
import { ShootData } from '@/types/shoots';
import { getShootClientReleaseAccess } from '../details/shootClientReleaseAccess';
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
  const normalizedRole = currentUserRole.trim().toLowerCase();

  const roleFlags = useMemo(() => {
    const isEditingManager = normalizedRole === 'editing_manager';
    const isAdmin =
      ['admin', 'superadmin', 'super_admin'].includes(normalizedRole) || isEditingManager;
    const isRep =
      normalizedRole === 'salesrep' ||
      normalizedRole === 'sales_rep' ||
      normalizedRole === 'rep' ||
      normalizedRole === 'representative';
    const isPhotographer = normalizedRole === 'photographer';
    const isEditor = normalizedRole === 'editor';
    const isClient = normalizedRole === 'client';

    return {
      isEditingManager,
      isAdmin,
      isRep,
      isAdminOrRep: isAdmin || isRep,
      isPhotographer,
      isEditor,
      isClient,
    };
  }, [normalizedRole]);

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

  const releaseAccess = useMemo(
    () => getShootClientReleaseAccess(shoot, roleFlags.isClient),
    [roleFlags.isClient, shoot],
  );

  const visibleTabs = useMemo(
    () =>
      getShootDetailsVisibleTabs({
        isAdmin: roleFlags.isAdmin,
        isRep: roleFlags.isRep,
        isClient: roleFlags.isClient,
        isRequestedStatus,
        isClientReleaseLocked: releaseAccess.isClientReleaseLocked,
        shoot,
      }),
    [
      isRequestedStatus,
      releaseAccess.isClientReleaseLocked,
      roleFlags.isAdmin,
      roleFlags.isClient,
      roleFlags.isRep,
      shoot,
    ],
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
