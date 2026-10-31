import { useAuth } from '@/components/auth/AuthProvider';
import { useParams } from 'react-router-dom';
import { canManageStudioBilling } from '@/lib/studioBillingAccess';
import { StudioClientPicker } from '@/components/listing-studio/staff/StudioClientPicker';
import { StudioManagedWorkspace } from '@/components/listing-studio/staff/StudioManagedWorkspace';

export default function ListingStudioManage() {
  const { user, isAuthenticated, isLoading, isImpersonating } = useAuth();
  const { clientId } = useParams();
  if (isLoading) return <p role="status" className="p-6 text-sm">Loading your account…</p>;
  if (!isAuthenticated || !user || !canManageStudioBilling(user.role) || isImpersonating || user.isActive === false) {
    return <div className="space-y-3 p-6"><h1 className="text-2xl font-semibold">Client plans & credit</h1><p>Use your own authorized rep or superadmin account to manage client purchases.</p></div>;
  }
  if (clientId && !/^[1-9][0-9]*$/.test(clientId)) return <p role="alert" className="p-6">This client could not be found.</p>;
  return clientId
    ? <StudioManagedWorkspace key={user.id + ':' + clientId} actorId={String(user.id)} clientId={clientId} />
    : <StudioClientPicker key={user.id} actorId={String(user.id)} />;
}
