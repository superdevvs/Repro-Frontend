import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from './SharedComponents';

export const AssignPhotographersCardSkeleton: React.FC = () => {
  return (
    <Card className="flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-full max-w-[140px]" />
        <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
      </div>
      <div className="space-y-3">
        <div className="flex gap-3 flex-wrap">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-12" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-12 rounded-full" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 border border-border rounded-2xl"
          >
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-full max-w-[90px]" />
              <Skeleton className="h-3 w-full max-w-[110px]" />
            </div>
            <Skeleton className="h-4 w-12 flex-shrink-0" />
          </div>
        ))}
      </div>
    </Card>
  );
};
