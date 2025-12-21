
import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { PlusIcon, Camera, Pen } from 'lucide-react';

interface PhotographersHeaderProps {
  onAddClick: () => void;
  activeTab: 'photographers' | 'editors';
}

export function PhotographersHeader({ onAddClick, activeTab }: PhotographersHeaderProps) {
  return (
    <PageHeader
      badge={activeTab === 'photographers' ? 'Photographers' : 'Editors'}
      title={activeTab === 'photographers' ? 'Photographer Directory' : 'Editor Directory'}
      description={activeTab === 'photographers' 
        ? 'Manage photographers and their availability' 
        : 'Manage editors and their availability'}
      action={
        <Button className="gap-2 hover:shadow-md transition-shadow" onClick={onAddClick}>
          <PlusIcon className="h-4 w-4" />
          Add {activeTab === 'photographers' ? 'Photographer' : 'Editor'}
        </Button>
      }
    />
  );
}
