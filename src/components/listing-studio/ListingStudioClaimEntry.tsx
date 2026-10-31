import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LISTING_STUDIO_CLAIM_PATH, rememberListingStudioClaim } from '@/lib/listingStudioClaim';

/** Capture before ProtectedRoute can put the return destination in a login URL. */
export function ListingStudioClaimEntry({ children }: { children: ReactNode }) {
  const { hash, search } = useLocation();
  const navigate = useNavigate();
  useLayoutEffect(() => {
    if (!hash) return;
    rememberListingStudioClaim(hash);
  }, [hash]);

  // A handoff never accepts query-string credentials or arbitrary return URLs.
  useEffect(() => {
    if (hash || search) navigate(LISTING_STUDIO_CLAIM_PATH, { replace: true });
  }, [hash, navigate, search]);

  if (hash || search) return <p role="status" className="p-8 text-center text-sm">Opening your edited photos…</p>;
  return children;
}
