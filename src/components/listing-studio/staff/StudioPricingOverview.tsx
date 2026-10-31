import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, FileText, ImagePlus, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { canManageStudioBilling, studioBillingRole } from '@/lib/studioBillingAccess';
import { listingStudioService } from '@/services/listingStudioService';
import { StudioClientPicker } from './StudioClientPicker';
import { StudioPlanCards, StudioServicePricing } from './StudioPlanCatalog';

export function StudioPricingOverview({ actorId, role }: { actorId: string; role: string }) {
  const [params, setParams] = useSearchParams();
  const canManage = canManageStudioBilling(role);
  const tab = canManage && params.get('tab') === 'clients' ? 'clients' : 'pricing';
  const changeTab = (value: string) => setParams(current => { const next = new URLSearchParams(current); next.set('tab', value); return next; });
  const legacyHref = (value: 'requests' | 'subscriptions') => { const next = new URLSearchParams(params); next.set('listingStudio', '1'); next.set('listingStudioTab', value); return '?' + next.toString(); };
  const internalStaff = ['admin', 'superadmin'].includes(studioBillingRole(role));
  const catalog = useQuery({ queryKey: ['listing-studio-catalog', actorId, studioBillingRole(role)], queryFn: listingStudioService.catalog, staleTime: 60000 });
  const pricing = catalog.data?.billing;
  return <div className="w-full min-w-0 space-y-6 p-1 sm:p-3 lg:p-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1.5"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Client plans & pricing</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Listing Studio</h1><p className="max-w-2xl text-sm leading-6 text-muted-foreground">A clear plan for every listing. Explore monthly editing credit and individual photo services.</p></div>
      <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to={legacyHref('requests')}><FileText aria-hidden="true" className="mr-2 h-4 w-4" />Requests</Link></Button>{internalStaff && <Button asChild size="sm" variant="outline"><Link to={legacyHref('subscriptions')}>Subscriptions<ArrowUpRight aria-hidden="true" className="ml-2 h-3.5 w-3.5" /></Link></Button>}{canManage && <Button size="sm" onClick={() => changeTab('clients')}><Users aria-hidden="true" className="mr-2 h-4 w-4" />Choose a client</Button>}</div>
    </header>
    {internalStaff && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3"><p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />Staff editing doesn’t use client credits.</p><Button asChild variant="ghost" size="sm"><Link to="/ai-editing"><ImagePlus aria-hidden="true" className="mr-2 h-4 w-4" />Open editor<ArrowUpRight aria-hidden="true" className="ml-2 h-3.5 w-3.5" /></Link></Button></div>}
    <Tabs value={tab} onValueChange={changeTab}>
      {canManage && <TabsList className="mb-5 h-11 rounded-xl bg-muted/60 p-1"><TabsTrigger value="pricing" className="rounded-lg px-5">Plans & pricing</TabsTrigger><TabsTrigger value="clients" className="rounded-lg px-5">Client accounts</TabsTrigger></TabsList>}
      <TabsContent value="pricing" className="mt-0 space-y-7">
        {catalog.isPending ? <div role="status" aria-label="Loading Studio pricing" className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(item => <Skeleton key={item} className="h-72 rounded-2xl" />)}</div> : !pricing ? <div role="alert" className="space-y-3 rounded-2xl border bg-card p-6"><h2 className="text-base font-semibold">Pricing is temporarily unavailable</h2><p className="text-sm text-muted-foreground">Refresh to load the current client plans and photo prices.</p><Button variant="outline" onClick={() => void catalog.refetch()}><RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />Try again</Button></div> : <>
          <section aria-labelledby="studio-monthly-plans" className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 id="studio-monthly-plans" className="text-lg font-semibold tracking-tight">Monthly client plans</h2><p className="mt-1 text-sm text-muted-foreground">Editing credit for clients who create new listings regularly.</p></div><span className="text-xs text-muted-foreground">USD · billed monthly</span></div><StudioPlanCards plans={pricing.plans} /><p className="text-xs leading-5 text-muted-foreground">Unused editing credit expires at the end of each billing period. No rollover. Client approval is required for a new card payment.</p></section>
          <StudioServicePricing catalog={pricing} />
        </>}
      </TabsContent>
      {canManage && <TabsContent value="clients" className="mt-0"><StudioClientPicker actorId={actorId} embedded /></TabsContent>}
    </Tabs>
  </div>;
}
