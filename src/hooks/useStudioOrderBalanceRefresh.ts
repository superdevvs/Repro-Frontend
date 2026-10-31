import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { StudioOrder } from '@/types/listingStudioClient';

/** Update the shared wallet when a polled order settles, releases, or changes funding. */
export function useStudioOrderBalanceRefresh(actorId: string, orders: readonly StudioOrder[] | undefined, managedClientId?: string) {
  const client = useQueryClient();
  const scope = useMemo(() => managedClientId ? ['studio-managed-client', actorId, managedClientId] : ['studio-client', actorId], [actorId, managedClientId]);
  const fingerprint = orders?.map(order => [order.id, order.item.status, order.funding.status, order.funding.reservedCreditCents, order.funding.capturedCreditCents, order.funding.paidAmountCents, order.funding.refundedAmountCents].join(':')).sort().join('|');
  const previous = useRef<{ scope: string[]; fingerprint: string }>();
  useEffect(() => {
    if (fingerprint === undefined) return;
    if (previous.current?.scope === scope && previous.current.fingerprint !== fingerprint) {
      void client.invalidateQueries({ queryKey: [...scope, 'account'] });
      void client.invalidateQueries({ queryKey: [...scope, 'transactions'] });
    }
    previous.current = { scope, fingerprint };
  }, [client, fingerprint, scope]);
}
