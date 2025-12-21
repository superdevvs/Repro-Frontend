
import React from 'react';
import { ShootData, ShootAction } from '@/types/shoots';
import { SharedShootCard } from '@/components/shoots/SharedShootCard';
import type { Role } from '@/components/auth/AuthProvider';

interface ShootsListProps {
  shoots: ShootData[];
  onSelect: (shoot: ShootData) => void;
  role: Role;
  onPrimaryAction: (action: ShootAction, shoot: ShootData) => void;
  onOpenWorkflow?: (shoot: ShootData) => void;
  showMedia?: boolean;
}

export function ShootsList({
  shoots,
  onSelect,
  role,
  onPrimaryAction,
  onOpenWorkflow,
}: ShootsListProps) {
  return (
    <div className="space-y-4">
      {shoots.map((shoot) => (
        <div key={shoot.id} onClick={() => onSelect(shoot)}>
          <SharedShootCard
            shoot={shoot}
            role={role}
            onSelect={() => onSelect(shoot)}
            onPrimaryAction={onPrimaryAction}
            onOpenWorkflow={onOpenWorkflow}
          />
        </div>
      ))}
    </div>
  );
}
