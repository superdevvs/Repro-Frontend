
import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';

interface ShootsHeaderProps {
  title: string;
  subtitle: string;
}

export function ShootsHeader({ title, subtitle }: ShootsHeaderProps) {
  const navigate = useNavigate();
  const { can } = usePermission();
  
  // Show the button to users who have permission to book shoots
  const canBookShoot = can('book-shoot', 'create');
  
  return (
    <PageHeader
      badge="Shoots"
      title={title}
      description={subtitle}
      action={
        canBookShoot ? (
          <Button onClick={() => navigate('/book-shoot')}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Book New Shoot
          </Button>
        ) : undefined
      }
    />
  );
}
