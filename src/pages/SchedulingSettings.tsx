
import React, { useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/components/auth/AuthProvider';
import { Navigate } from 'react-router-dom';
import { ServicesTab, ServicesTabHandle } from '@/components/scheduling/ServicesTab';
import { Button } from '@/components/ui/button';
import { Plus, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SchedulingSettings = () => {
  const { role } = useAuth();
  const servicesRef = useRef<ServicesTabHandle>(null);

  // Only allow admin and superadmin to access this page
  if (!['admin', 'superadmin', 'editing_manager'].includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-3 sm:space-y-6 sm:p-6">
        <PageHeader
          badge="Settings"
          title="Services"
          description="Manage services, pricing, and details"
          action={
            <div className="flex items-center gap-2">
              <Button onClick={() => servicesRef.current?.openAddService()} className="h-9 gap-1.5 px-3 sm:h-10 sm:px-4">
                <Plus className="h-4 w-4" />
                <span className="sm:hidden">New</span>
                <span className="hidden sm:inline">Add Service</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Service actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => servicesRef.current?.openAddCategory()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        <ServicesTab ref={servicesRef} />
      </div>
    </DashboardLayout>
  );
};

export default SchedulingSettings;
