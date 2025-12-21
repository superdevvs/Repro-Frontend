
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircleIcon } from 'lucide-react';
import { ShootsList } from './ShootsList';
import { ShootData, ShootAction } from '@/types/shoots';
import { SharedShootCard } from '@/components/shoots/SharedShootCard';
import type { Role } from '@/components/auth/AuthProvider';

interface ShootsContentProps {
  filteredShoots: ShootData[];
  viewMode: 'grid' | 'list';
  onShootSelect: (shoot: ShootData) => void;
  role: Role;
  onPrimaryAction: (action: ShootAction, shoot: ShootData) => void;
  onOpenWorkflow?: (shoot: ShootData) => void;
  showMedia?: boolean;
}

export function ShootsContent({ 
  filteredShoots, 
  viewMode,
  onShootSelect,
  role,
  onPrimaryAction,
  onOpenWorkflow,
  showMedia = false
}: ShootsContentProps) {
  if (filteredShoots.length === 0) {
    return (
      <Alert variant="default">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertDescription>
          No shoots found matching the current filters.
        </AlertDescription>
      </Alert>
    );
  }

  if (viewMode === 'list') {
    return (
      <ShootsList 
        shoots={filteredShoots} 
        onSelect={onShootSelect} 
        role={role}
        onPrimaryAction={onPrimaryAction}
        onOpenWorkflow={onOpenWorkflow}
        showMedia={showMedia}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredShoots.map((shoot, index) => {
        const handleCardSelect = () => onShootSelect(shoot);
        return (
          <div key={shoot.id} className="h-full" onClick={handleCardSelect}>
            <SharedShootCard
              shoot={shoot}
              role={role}
              onSelect={() => onShootSelect(shoot)}
              onPrimaryAction={onPrimaryAction}
              onOpenWorkflow={onOpenWorkflow}
            />
          </div>
        );
      })}
    </div>
  );
}
