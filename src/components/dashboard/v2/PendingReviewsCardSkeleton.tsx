import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from './SharedComponents';

export const PendingReviewsCardSkeleton: React.FC = () => {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-4">
        <Skeleton className="h-6 w-28 max-w-[40%]" />
        <div className="flex gap-1 flex-shrink-0">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="border border-border rounded-2xl p-4 bg-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className="h-4 w-full max-w-[140px]" />
                <Skeleton className="h-3 w-full max-w-[110px]" />
                <Skeleton className="h-3 w-full max-w-[90px]" />
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <Skeleton className="h-5 w-10 rounded-full" />
                <Skeleton className="h-4 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
