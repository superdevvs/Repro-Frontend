import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const EditingRequestsCardSkeleton: React.FC = () => {
  return (
    <div className="space-y-3 overflow-hidden">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/60 bg-muted/20 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-4 w-full max-w-[140px]" />
              <Skeleton className="h-3 w-full max-w-[110px]" />
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <Skeleton className="h-3 w-20 max-w-[40%]" />
            <Skeleton className="h-3 w-16 max-w-[35%]" />
          </div>
        </div>
      ))}
    </div>
  );
};
