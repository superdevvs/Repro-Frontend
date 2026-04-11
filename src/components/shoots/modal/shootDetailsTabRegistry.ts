import { ShootData } from '@/types/shoots';
import { ShootDetailsTabDefinition } from './shootDetailsTypes';

const SHOOT_DETAILS_TAB_REGISTRY: ShootDetailsTabDefinition[] = [
  {
    id: 'overview',
    label: 'Overview',
    isVisible: () => true,
  },
  {
    id: 'notes',
    label: 'Notes',
    isVisible: () => true,
  },
  {
    id: 'issues',
    label: 'Requests',
    isVisible: ({ isRequestedStatus }) => !isRequestedStatus,
  },
  {
    id: 'tours',
    label: 'Tours',
    isVisible: ({ isAdmin, isRep, isClient, isRequestedStatus }) =>
      !isRequestedStatus && (isAdmin || isRep || isClient),
    isDisabled: ({ isClient, isClientReleaseLocked }) => isClient && isClientReleaseLocked,
  },
  {
    id: 'settings',
    label: 'Settings',
    isVisible: ({ isAdmin, isRep, isRequestedStatus }) =>
      !isRequestedStatus && (isAdmin || isRep),
  },
  {
    id: 'activity',
    label: 'Activity Log',
    isVisible: ({ isAdmin, isRep, isRequestedStatus }) =>
      !isRequestedStatus && (isAdmin || isRep),
  },
];

export const getShootDetailsVisibleTabs = ({
  isAdmin,
  isRep,
  isClient,
  isRequestedStatus,
  isClientReleaseLocked,
  shoot,
}: {
  isAdmin: boolean;
  isRep: boolean;
  isClient: boolean;
  isRequestedStatus: boolean;
  isClientReleaseLocked: boolean;
  shoot: ShootData | null;
}) =>
  SHOOT_DETAILS_TAB_REGISTRY.filter((tab) =>
    tab.isVisible({ isAdmin, isRep, isClient, isRequestedStatus, isClientReleaseLocked, shoot }),
  ).map(({ id, label, isDisabled }) => ({
    id,
    label,
    disabled: isDisabled?.({ isAdmin, isRep, isClient, isRequestedStatus, isClientReleaseLocked, shoot }) ?? false,
  }));
