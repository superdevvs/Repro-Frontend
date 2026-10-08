import React from 'react';
import { ShootData } from '@/types/shoots';
import { useShootDetailsMediaTab } from './media/useShootDetailsMediaTab';
import { useShootUnitScope } from '@/features/shoot-units/useShootUnitScope';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

interface ShootDetailsMediaTabProps {
  requestMediaFocus?: boolean;
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
  // Contain media rendering inside the modal/page. UploadProvider and its
  // running requests stay mounted above this view, as does dashboard navigation.
  return <ErrorBoundary key={props.shoot.id} scope="shoot_media"><UnitScopedMediaTab {...props} /></ErrorBoundary>;
}

function UnitScopedMediaTab(props: ShootDetailsMediaTabProps) {
  const { activeUnitId } = useShootUnitScope(props.shoot);
  return <ScopedMediaTab key={`${props.shoot.id}:${activeUnitId ?? 'property'}`} {...props} />;
}

function ScopedMediaTab(props: ShootDetailsMediaTabProps) {
  return useShootDetailsMediaTab(props);
}
