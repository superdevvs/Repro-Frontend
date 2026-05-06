import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from './SharedComponents';

export const UpcomingShootsCardSkeleton: React.FC = () => {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-2 pr-10 sm:mb-4 sm:pr-0">
        <div className="flex items-center gap-2 pl-1 sm:pl-0">
          <Skeleton className="h-7 w-24 sm:h-6 sm:w-32" />
          <Skeleton className="h-7 w-20 sm:hidden" />
        </div>
        <div className="hidden gap-2 flex-shrink-0 sm:flex">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </div>
      <div className="space-y-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:pb-0">
        {[1, 2].map((group) => (
          <div key={group} className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            {[1, 2].map((shoot) => (
              <div
                key={shoot}
                className="border border-border rounded-3xl bg-card px-5 pt-4 pb-3.5 sm:p-5"
              >
                <div className="space-y-2.5 sm:hidden">
                  <div className="flex items-start gap-2">
                    <Skeleton className="h-7 w-36 rounded-xl flex-shrink-0" />
                    <Skeleton className="ml-auto h-5 w-16 rounded-full flex-shrink-0" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full max-w-[260px]" />
                    <Skeleton className="h-3 w-full max-w-[180px]" />
                  </div>
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Skeleton className="h-6 w-28 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-px w-full" />
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-5 w-20 rounded-full flex-shrink-0" />
                    <Skeleton className="h-3 w-36 max-w-[45%]" />
                  </div>
                </div>
                <div className="hidden sm:grid sm:grid-cols-[auto,1fr,auto] items-stretch gap-4">
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
