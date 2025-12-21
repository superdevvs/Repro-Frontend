import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { PlusIcon, UsersIcon } from 'lucide-react';

interface ClientsHeaderProps {
  role: string;
  handleAddClient: () => void;
  totalClients?: number;
}

export const ClientsHeader: React.FC<ClientsHeaderProps> = ({ 
  role, 
  handleAddClient,
  totalClients = 0
}) => {
  // Keep add client button only for admin and superadmin users
  const isAdmin = ['admin', 'superadmin'].includes(role);
  
  return (
    <PageHeader
      badge="Clients"
      title="Client Management"
      description="Manage client information and property shoots in the REPro Dashboard"
      icon={UsersIcon}
      iconText={totalClients > 0 ? `${totalClients} clients` : undefined}
      action={
        isAdmin ? (
          <Button 
            className="gap-2 bg-primary text-white hover:bg-primary/90 transition-all" 
            onClick={handleAddClient}
          >
            <PlusIcon className="h-4 w-4" />
            Add New Client
          </Button>
        ) : undefined
      }
    />
  );
};
