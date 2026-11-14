import { useAuth } from '@/components/auth';
import { ShootSharingDialog, type ShootShareButtonProps } from './ShootSharingDialog';

export function ShootGuestShareButton(props: ShootShareButtonProps) {
  const { user, role: activeRole } = useAuth();
  const role = String(activeRole || user?.role || '').toLowerCase().replace(/[_ -]/g, '');
  const capability = props.shoot.canShareGuest ?? props.shoot.can_share_guest;
  const legacyAllowed = ['admin', 'superadmin', 'editingmanager'].includes(role)
    || (role === 'client' && user?.id != null && props.shoot.client?.id != null && String(props.shoot.client.id) === String(user.id));
  const allowed = typeof capability === 'boolean' ? capability : legacyAllowed;
  return allowed ? <ShootSharingDialog key={`${props.shoot.id}:${user?.id}:${role}`} {...props} /> : null;
}
