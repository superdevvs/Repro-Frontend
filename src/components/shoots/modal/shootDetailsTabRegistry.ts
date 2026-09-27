import { ShootData } from '@/types/shoots';
import { ShootDetailsTabDefinition } from './shootDetailsTypes';
import { getShootUnits } from '@/features/shoot-units/shootUnitData';

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
    isDisabled: ({ isClient, isClientReleaseLocked, shoot }) => {
      const units = getShootUnits(shoot);
      return isClient && (units.length ? !units.some(unit => Number(unit.ready_service_count) > 0) : isClientReleaseLocked);
    },
  },
  {
    id: 'settings',
    label: 'Settings',
    isVisible: ({ isAdmin, isRep, isClient, isRequestedStatus }) =>
      !isRequestedStatus && (isAdmin || isRep || isClient),
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
