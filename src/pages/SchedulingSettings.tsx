
import React, { useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/components/auth/AuthProvider';
import { Navigate } from 'react-router-dom';
import { ServicesTab, ServicesTabHandle } from '@/components/scheduling/ServicesTab';
import { ServiceGroupsTab } from '@/components/scheduling/ServiceGroupsTab';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SchedulingSettings = () => {
  const { role } = useAuth();
  const servicesRef = useRef<ServicesTabHandle>(null);
  const [activeTab, setActiveTab] = React.useState<'services' | 'service-groups'>('services');

  // Only allow admin and superadmin to access this page
  if (!['admin', 'superadmin', 'editing_manager'].includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-3 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-0">
        <PageHeader
          badge="Scheduling"
          title="Scheduling Catalog"
          description="Manage services and client-specific service visibility."
          action={
            activeTab === 'services' ? (
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
            ) : null
          }
        />

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'services' | 'service-groups')} className="space-y-4">
          <TabsList>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="service-groups">Service Groups</TabsTrigger>
          </TabsList>
          <TabsContent value="services" className="mt-0">
            <ServicesTab ref={servicesRef} />
          </TabsContent>
          <TabsContent value="service-groups" className="mt-0">
            <ServiceGroupsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SchedulingSettings;
