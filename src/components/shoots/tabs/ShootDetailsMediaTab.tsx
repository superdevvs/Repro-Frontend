import React from 'react';
import { ShootData } from '@/types/shoots';
import { useShootDetailsMediaTab } from './media/useShootDetailsMediaTab';

interface ShootDetailsMediaTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  isClientReleaseLocked?: boolean;
  role: string;
  onShootUpdate: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  displayTab?: 'uploaded' | 'edited';
  onDisplayTabChange?: (tab: 'uploaded' | 'edited') => void;
}

export function ShootDetailsMediaTab(props: ShootDetailsMediaTabProps) {
  return useShootDetailsMediaTab(props);
}
