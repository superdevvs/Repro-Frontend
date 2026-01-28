import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from './SharedComponents';

export const UpcomingShootsCardSkeleton: React.FC = () => {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-4">
        <Skeleton className="h-6 w-32 max-w-[40%]" />
        <div className="flex gap-2 flex-shrink-0">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </div>
      <div className="space-y-6">
        {[1, 2].map((group) => (
          <div key={group} className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            {[1, 2].map((shoot) => (
              <div
                key={shoot}
                className="border border-border rounded-3xl p-5 bg-card"
              >
                <div className="grid grid-cols-[auto,1fr,auto] items-stretch gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <Skeleton className="h-16 w-20 rounded-2xl" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <div className="space-y-3 min-w-0 overflow-hidden">
                    <div>
                      <Skeleton className="h-5 w-full max-w-[180px] mb-2" />
                      <Skeleton className="h-3 w-full max-w-[220px]" />
                    </div>
                    <Skeleton className="h-3 w-24" />
                    <div className="flex gap-2 flex-wrap">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    <Skeleton className="h-7 w-16 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
};
