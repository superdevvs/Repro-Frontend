import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermission } from '@/hooks/usePermission';
import { FREE_EDITS_PATH } from '@/config/listingStudio';
import { getFreeEditsEligibility } from '@/services/listingStudioFreeEdits';

export function ListingStudioDeliveryOffer({ onNavigate }: { onNavigate: () => void }) {
  const { user, role, isImpersonating } = useAuth();
  if (!user || user.role !== 'client' || role !== 'client' || isImpersonating) return null;
  return <EligibleDeliveryOffer key={user.id} userId={user.id} onNavigate={onNavigate} />;
}

function EligibleDeliveryOffer({ userId, onNavigate }: { userId: string; onNavigate: () => void }) {
  const { can, isLoading } = usePermission();
  const permitted = !isLoading && can('support', 'view');
  const eligibility = useQuery({
    // Shared with the intake page, which invalidates this after a successful claim.
    queryKey: ['listing-studio-free-edits', userId],
    queryFn: ({ signal }) => getFreeEditsEligibility(signal),
    enabled: permitted,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (!permitted || eligibility.isError || !eligibility.data?.eligible || eligibility.data.claim) return null;
  return <aside aria-label="Listing Studio photo edits" className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
    <div className="flex min-w-0 items-start gap-2">
      <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0"><p className="text-sm font-medium">Want staging or twilight on these photos?</p><p className="mt-0.5 text-xs text-muted-foreground">Three edits by our team. One introductory request per client.</p></div>
    </div>
    <Link to={FREE_EDITS_PATH} onClick={onNavigate} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 self-start rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      Try 3 free edits<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
    </Link>
  </aside>;
}
