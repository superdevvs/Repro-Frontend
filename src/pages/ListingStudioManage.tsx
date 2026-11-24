import { useAuth } from '@/components/auth/AuthProvider';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { canManageStudioBilling, canViewStudioPricing } from '@/lib/studioBillingAccess';
import { listingStudioManageHref } from '@/config/listingStudio';
import { StudioPricingOverview } from '@/components/listing-studio/staff/StudioPricingOverview';
import { StudioManagedWorkspace } from '@/components/listing-studio/staff/StudioManagedWorkspace';
import { usePermission } from '@/hooks/usePermission';
import { canOpenListingStudioInAiEditing } from '@/utils/listingStudio';

export default function ListingStudioManage() {
  const { clientId } = useParams();
  return <ListingStudioStaffWorkspace clientId={clientId} />;
}

export function ListingStudioStaffWorkspace({ clientId, embedded = false }: { clientId?: string; embedded?: boolean }) {
  const { user, isAuthenticated, isLoading, isImpersonating } = useAuth();
  const permission = usePermission();
  const location = useLocation();
  if (isLoading || (!embedded && permission.isLoading)) return <p role="status" className="p-6 text-sm">Loading your account…</p>;
  const canManage = canManageStudioBilling(user?.role);
  if (!isAuthenticated || !user || !canViewStudioPricing(user.role) || isImpersonating || user.isActive === false || (clientId && !canManage)) {
    return <div className="space-y-3 p-6"><h1 className="text-2xl font-semibold">Client plans & credit</h1><p>Use your own authorized rep or superadmin account to manage client purchases.</p></div>;
  }
  if (clientId && !/^[1-9][0-9]*$/.test(clientId)) return <p role="alert" className="p-6">This client could not be found.</p>;
  if (!embedded && canOpenListingStudioInAiEditing(user.role, permission.can('ai-editing', 'view'), isImpersonating, user.isActive)) {
    return <Navigate to={listingStudioManageHref({ clientId, search: location.search, hash: location.hash, embedded: true })} replace />;
  }
  return clientId
    ? <StudioManagedWorkspace key={user.id + ':' + clientId} actorId={String(user.id)} clientId={clientId} withinAiEditing={embedded} />
    : <StudioPricingOverview key={user.id} actorId={String(user.id)} role={user.role} withinAiEditing={embedded} />;
}
