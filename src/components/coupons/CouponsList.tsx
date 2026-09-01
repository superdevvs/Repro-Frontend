import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/services/api';
import { CouponCard } from './CouponCard';
import type { Coupon } from './couponTypes';

interface CouponsResponse {
  data?: unknown;
  message?: string;
}

const getLoadErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<CouponsResponse>(error)) {
    return error.response?.data?.message || 'The server could not load discounts.';
  }

  return error instanceof Error ? error.message : 'The server could not load discounts.';
};

export function CouponsList() {
  const {
    data: coupons,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['coupons'],
    queryFn: async () => {
      const response = await apiClient.get<CouponsResponse>('/coupons');
      if (!Array.isArray(response.data?.data)) {
        throw new Error('The discounts response was invalid.');
      }

      return response.data.data as Coupon[];
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card
            key={i}
            className="h-[250px] animate-pulse border border-gray-200 bg-gray-100 dark:border-slate-700 dark:bg-slate-800"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/30 bg-destructive/5 p-6"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 space-y-3">
            <div>
              <p className="font-medium">Discounts could not be loaded</p>
              <p className="mt-1 text-sm text-muted-foreground">{getLoadErrorMessage(error)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isFetching ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!coupons?.length) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-8 text-center text-gray-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <p className="mb-2 text-lg font-medium">No Discounts Found</p>
        <p className="text-sm opacity-90">
          Create your first discount by clicking the &quot;Create Discount&quot; button above.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {coupons.map((coupon) => (
        <div key={coupon.id} className="rounded-md">
          <CouponCard coupon={coupon} />
        </div>
      ))}
    </div>
  );
}
