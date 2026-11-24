import React, { useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/components/auth/AuthProvider';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PageSearch } from '@/components/search/PageSearch';
import { ServicesTab, ServicesTabHandle } from '@/components/scheduling/ServicesTab';
import { ServiceGroupsTab } from '@/components/scheduling/ServiceGroupsTab';
import { Button } from '@/components/ui/button';
import { BufferSettingsDialog } from '@/components/scheduling/BufferSettingsDialog';
import { canOpenSchedulingSettings } from '@/config/schedulingSettings';
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

const catalogDescription = 'Manage services and client-specific service visibility.';

export function SchedulingCatalog({ embedded = false }: { embedded?: boolean }) {
  const { role } = useAuth();
  const servicesRef = useRef<ServicesTabHandle>(null);
  const [params] = useSearchParams();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const [bufferSettingsOpen, setBufferSettingsOpen] = React.useState(false);
  const catalog = params.get('catalog');
  const activeTab = catalog === 'service-groups' || (!catalog && params.get('tab') === 'service-groups')
    ? 'service-groups'
    : 'services';
  const serviceQuery = params.get('search') ?? '';

  const updateParams = (update: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    update(next);
    if (next.toString() !== params.toString()) {
      navigate({ pathname, search: next.toString(), hash }, { replace: true });
    }
  };
  const setServiceQuery = (query: string) => updateParams((next) => {
    if (query) next.set('search', query);
    else next.delete('search');
  });
  const setActiveTab = (value: string) => updateParams((next) => {
    if (value === 'service-groups') next.set('catalog', 'service-groups');
    else next.delete('catalog');
    if (next.get('tab') === 'service-groups') next.delete('tab');
  });

  const actions = activeTab === 'services' && (
    <div className="flex w-full items-center gap-2">
      <div data-page-search-container className="relative min-w-0 flex-1 sm:w-48 lg:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <PageSearch scope="services" scopeLabel="Services" searchId="services" priority={20} value={serviceQuery} onChange={event => setServiceQuery(event.target.value)} placeholder="Search services" aria-label="Search services" className="h-9 pl-9 sm:h-10" />
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
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className={embedded ? 'min-w-0 space-y-4' : 'space-y-4 px-0 pt-1.5 pb-3 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-0'}>
      {embedded ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Scheduling Catalog</h2>
            <p className="text-sm text-muted-foreground">{catalogDescription}</p>
          </div>
          {actions && <div className="min-w-0">{actions}</div>}
        </div>
      ) : (
        <PageHeader title="Scheduling Catalog" description={catalogDescription} compactTitleOnMobile alignActionTop action={actions} />
      )}

      <BufferSettingsDialog open={bufferSettingsOpen} onOpenChange={setBufferSettingsOpen} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 space-y-4">
        <div className={embedded ? undefined : 'mobile-sticky-tabs'}>
          <TabsList aria-label="Scheduling catalog views">
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="service-groups">Service Groups</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="services" className="mt-0 min-w-0">
          <ServicesTab ref={servicesRef} serviceQuery={serviceQuery} onServiceQueryChange={setServiceQuery} />
        </TabsContent>
        <TabsContent value="service-groups" className="mt-0 min-w-0">
          <ServiceGroupsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SchedulingSettings() {
  const { role } = useAuth();
  if (!canOpenSchedulingSettings(role)) return <Navigate to="/dashboard" replace />;
  return <DashboardLayout><SchedulingCatalog /></DashboardLayout>;
}
