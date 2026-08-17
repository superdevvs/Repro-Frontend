import { useState, type Dispatch, type SetStateAction } from 'react';

import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';

type AddressReviewUser = { id: string } & Record<string, unknown>;

export function usePhotographerAddressReview<T extends AddressReviewUser>(options: {
  onSessionExpired: () => void;
  replaceUser: (user: T) => void;
}) {
  const { toast } = useToast();
  const [reviewingAddressUserId, setReviewingAddressUserId] = useState<string | null>(null);

  const reviewAddressChange = async (user: T, decision: 'approve' | 'reject') => {
    try {
      setReviewingAddressUserId(user.id);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        options.onSessionExpired();
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/users/${user.id}/address-change/${decision}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 419) {
        options.onSessionExpired();
        return;
      }

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseData.message || `Failed to ${decision} address change`);
      }

      options.replaceUser((responseData.user ?? user) as T);
      toast({
        title: decision === 'approve' ? 'Address approved' : 'Address rejected',
        description: responseData.message || (
          decision === 'approve'
            ? 'The photographer address is now the approved address.'
            : 'The pending address change was rejected.'
        ),
      });
    } catch (error) {
      toast({
        title: 'Unable to review address',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setReviewingAddressUserId(null);
    }
  };

  return { reviewingAddressUserId, reviewAddressChange };
}

export function useListedUserAddressReview<T extends AddressReviewUser>(options: {
  onSessionExpired: () => void;
  setUsers: Dispatch<SetStateAction<T[]>>;
  setSelectedUser: Dispatch<SetStateAction<T | null>>;
}) {
  return usePhotographerAddressReview<T>({
    onSessionExpired: options.onSessionExpired,
    replaceUser: (refreshedUser) => {
      options.setUsers((list) => list.map((entry) => (
        entry.id === refreshedUser.id ? { ...entry, ...refreshedUser } : entry
      )));
      options.setSelectedUser((current) => (
        current?.id === refreshedUser.id ? { ...current, ...refreshedUser } : current
      ));
    },
  });
}
