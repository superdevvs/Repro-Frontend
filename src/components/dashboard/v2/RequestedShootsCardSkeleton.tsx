import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from './SharedComponents';

export const RequestedShootsCardSkeleton: React.FC = () => {
  return (
    <Card className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>

      {/* Shoot Items */}
      <div className="space-y-6">
        {[1, 2].map((group) => (
          <div key={group} className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            {[1].map((shoot) => (
              <div
                key={shoot}
                className="border border-blue-300 rounded-3xl p-5 bg-blue-50/30 dark:bg-blue-950/20"
              >
                <div className="grid grid-cols-[auto,1fr,auto] items-stretch gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-16 w-20 rounded-2xl" />
                  </div>
                  <div className="space-y-3 min-w-0 overflow-hidden">
                    <div>
                      <Skeleton className="h-5 w-full max-w-[200px] mb-2" />
                      <Skeleton className="h-3 w-full max-w-[160px]" />
                    </div>
                    <div className="flex gap-4">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    <Skeleton className="h-7 w-16 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-blue-200">
                  <Skeleton className="h-8 w-20 rounded-md" />
                  <Skeleton className="h-8 w-18 rounded-md" />
                  <Skeleton className="h-8 w-18 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
};
