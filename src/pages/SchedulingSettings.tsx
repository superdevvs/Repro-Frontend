
import React, { useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/components/auth/AuthProvider';
import { Navigate } from 'react-router-dom';
import { ServicesTab, ServicesTabHandle } from '@/components/scheduling/ServicesTab';
import { ServiceGroupsTab } from '@/components/scheduling/ServiceGroupsTab';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BufferSettingsDialog } from '@/components/scheduling/BufferSettingsDialog';
import { Plus, MoreVertical, Search, Route } from 'lucide-react';
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

  const [serviceQuery, setServiceQuery] = React.useState('');
  const [bufferSettingsOpen, setBufferSettingsOpen] = React.useState(false);

  // Only allow admin and superadmin to access this page
  if (!['admin', 'superadmin', 'editing_manager'].includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 px-0 pt-1.5 pb-3 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-0">
        <PageHeader
          badge="Scheduling"
          title="Scheduling Catalog"
          description="Manage services and client-specific service visibility."
          compactTitleOnMobile
          alignActionTop
          action={
            activeTab === 'services' ? (
              <div className="flex w-full items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:w-48 lg:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={serviceQuery} onChange={event => setServiceQuery(event.target.value)} placeholder="Search services" aria-label="Search services" className="h-9 pl-9 sm:h-10" />
                </div>
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
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {['admin', 'superadmin'].includes(role) && <DropdownMenuItem onSelect={() => setBufferSettingsOpen(true)}>
                      <Route className="mr-2 h-4 w-4" />Buffer time
                    </DropdownMenuItem>}
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

        <BufferSettingsDialog open={bufferSettingsOpen} onOpenChange={setBufferSettingsOpen} />

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'services' | 'service-groups')} className="space-y-4">
          <div className="mobile-sticky-tabs">
            <TabsList>
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="service-groups">Service Groups</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="services" className="mt-0">
            <ServicesTab ref={servicesRef} serviceQuery={serviceQuery} onServiceQueryChange={setServiceQuery} />
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
