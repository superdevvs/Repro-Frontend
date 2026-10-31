import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import fixture from '@/components/listing-studio/client/studioFixtures.test-data.json';
import type { StudioOrder } from '@/types/listingStudioClient';
import { useStudioOrderBalanceRefresh } from './useStudioOrderBalanceRefresh';
afterEach(cleanup);
describe('order settlement refreshes the shared wallet', () => {
  it.each(['completed', 'failed'] as const)('refreshes the selected beneficiary balance on %s without repolling orders', status => {
    const query = new QueryClient(); const invalidate = vi.spyOn(query, 'invalidateQueries');
    const wrapper = ({children}:PropsWithChildren) => <QueryClientProvider client={query}>{children}</QueryClientProvider>;
    const order = fixture.order as StudioOrder;
    const hook = renderHook(({orders}) => useStudioOrderBalanceRefresh('9', orders, '42'), { wrapper, initialProps: { orders: [order] } });
    expect(invalidate).not.toHaveBeenCalled();
    hook.rerender({orders:[{...order,item:{...order.item,status},funding:{...order.funding,status:status==='completed'?'settled':'released',reservedCreditCents:0}}]});
    expect(invalidate.mock.calls.map(call=>call[0]?.queryKey)).toEqual([['studio-managed-client','9','42','account'],['studio-managed-client','9','42','transactions']]);
    query.clear();
  });
});
