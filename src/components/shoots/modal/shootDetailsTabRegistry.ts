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
    isVisible: ({ isAdmin, isClient, isRequestedStatus }) =>
      !isRequestedStatus && (isAdmin || isClient),
  },
  {
    id: 'settings',
    label: 'Settings',
    isVisible: ({ isAdmin, isRequestedStatus }) =>
      !isRequestedStatus && isAdmin,
  },
];

export const getShootDetailsVisibleTabs = ({
  isAdmin,
  isClient,
  isRequestedStatus,
  shoot,
}: {
  isAdmin: boolean;
  isClient: boolean;
  isRequestedStatus: boolean;
  shoot: ShootData | null;
}) =>
  SHOOT_DETAILS_TAB_REGISTRY.filter((tab) =>
    tab.isVisible({ isAdmin, isClient, isRequestedStatus, shoot }),
  ).map(({ id, label }) => ({ id, label }));
