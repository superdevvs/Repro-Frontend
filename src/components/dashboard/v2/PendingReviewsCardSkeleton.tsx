import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from './SharedComponents';

export const PendingReviewsCardSkeleton: React.FC = () => {
  return (
    <Card className="dashboard-mobile-panel flex h-[420px] min-h-0 shrink-0 flex-col overflow-hidden sm:flex-none">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <Skeleton className="h-6 w-28 max-w-[40%]" />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-6 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-3 shrink-0 border-t border-border/60 pt-2"><Skeleton className="h-8 w-full rounded-md" /></div>
    </Card>
  );
};
