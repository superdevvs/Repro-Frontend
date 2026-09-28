import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { listingStudioService } from '@/services/listingStudioService';
import { canReviewListingStudio, canUseListingStudioDashboard, listingStudioRole } from '@/utils/listingStudio';
import { ListingStudioRequestForm } from './ListingStudioRequestForm';
import { ListingStudioRequests } from './ListingStudioRequests';
import { ListingStudioSubscriptions } from './ListingStudioSubscriptions';

export default function ListingStudioDialog({ onClose, initialTab }: { onClose: () => void; initialTab?: 'requests' | 'subscriptions' }) {
  const { user, role } = useAuth();
  const effectiveRole = listingStudioRole(role, user?.secondary_roles);
  const allowed = canUseListingStudioDashboard(role, user?.secondary_roles);
  const canReview = canReviewListingStudio(role, user?.secondary_roles);
  const [tab, setTab] = useState(initialTab ?? (canReview ? 'requests' : 'new'));
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const catalog = useQuery({ queryKey: ['listing-studio-catalog', user?.id, effectiveRole], queryFn: listingStudioService.catalog, enabled: allowed && tab !== 'subscriptions', staleTime: 60_000 });
  if (!allowed) return null;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-h-[88dvh]">
      <DialogHeader className="m-0 border-b px-5 py-5 pr-11 text-left sm:px-6">
        <DialogTitle className="flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-primary" />Listing Studio</DialogTitle>
        <DialogDescription className="pt-1 leading-relaxed">Manage client subscriptions, signup assistance and requests.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <Tabs value={tab} onValueChange={value => { setTab(value); setSubmitted(false); }}>
          <TabsList className="mb-5 grid h-auto w-full grid-cols-3"><TabsTrigger className="min-w-0 whitespace-normal px-1 text-xs sm:px-3 sm:text-sm" value="new">New request</TabsTrigger><TabsTrigger className="min-w-0 whitespace-normal px-1 text-xs sm:px-3 sm:text-sm" value="requests">{canReview ? 'Review requests' : 'Request history'}</TabsTrigger><TabsTrigger className="min-w-0 whitespace-normal px-1 text-xs sm:px-3 sm:text-sm" value="subscriptions">Subscriptions</TabsTrigger></TabsList>
          {tab !== 'subscriptions' && catalog.isPending && <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading Listing Studio…</div>}
          {tab !== 'subscriptions' && catalog.isError && <div role="alert" className="space-y-3 py-6 text-center"><p className="text-sm text-destructive">Unable to load Listing Studio.</p><Button variant="outline" onClick={() => catalog.refetch()}>Try again</Button></div>}
          <TabsContent value="new" className="m-0">{catalog.data && <ListingStudioRequestForm catalog={catalog.data} onSubmitted={() => { setRefreshVersion(value => value + 1); setSubmitted(true); setTab('requests'); }} />}</TabsContent>
          <TabsContent value="requests" className="m-0 space-y-4">{submitted && <div role="status" className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p><strong>Request submitted.</strong> An admin will review it and follow up with you. You can track the status below.</p></div>}{catalog.data && <ListingStudioRequests catalog={catalog.data} canReview={canReview} identity={`${user?.id}:${effectiveRole}`} refreshVersion={refreshVersion} />}</TabsContent>
          <TabsContent value="subscriptions" className="m-0"><ListingStudioSubscriptions key={`${user?.id}:${effectiveRole}`} identity={`${user?.id}:${effectiveRole}`} canReview={canReview} /></TabsContent>
        </Tabs>
      </div>
    </DialogContent>
  </Dialog>;
}
