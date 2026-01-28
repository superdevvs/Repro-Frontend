import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from './SharedComponents';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-full max-w-[180px]" />
        <Skeleton className="h-4 w-full max-w-[320px]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column - Quick Actions & Assign Photographers */}
        <div className="lg:col-span-3 flex flex-col gap-6 sticky top-6">
          {/* Quick Actions Skeleton */}
          <Card className="flex flex-col gap-4 h-full overflow-hidden">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border/60 p-3 bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-2xl" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-4 w-full max-w-[110px]" />
                      <Skeleton className="h-3 w-full max-w-[130px]" />
                    </div>
                    <Skeleton className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Assign Photographers Skeleton */}
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
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-full max-w-[90px]" />
                    <Skeleton className="h-3 w-full max-w-[110px]" />
                  </div>
                  <Skeleton className="h-4 w-12 flex-shrink-0" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Middle Column - Requested Shoots & Upcoming Shoots */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Requested Shoots Skeleton */}
          <Card className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="space-y-6">
              {[1, 2].map((group) => (
                <div key={group} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="border border-blue-300 rounded-3xl p-5 bg-blue-50/30 dark:bg-blue-950/20">
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
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-blue-200">
                      <Skeleton className="h-8 w-20 rounded-md" />
                      <Skeleton className="h-8 w-18 rounded-md" />
                      <Skeleton className="h-8 w-18 rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Upcoming Shoots Skeleton */}
          <Card className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-4">
              <Skeleton className="h-6 w-32 max-w-[40%]" />
              <div className="flex gap-2 flex-shrink-0">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-16 rounded-full" />
              </div>
            </div>
            <div className="space-y-6">
              {[1, 2, 3, 4].map((group) => (
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
        </div>

        {/* Right Column - Reviews, Completed Shoots, Editing Requests */}
        <div className="lg:col-span-3 flex flex-col gap-6 sticky top-6">
          {/* Pending Reviews Skeleton */}
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

          {/* Completed Shoots Skeleton */}
          <Card className="flex flex-col gap-4 overflow-hidden">
            <div className="space-y-2">
              <Skeleton className="h-6 w-full max-w-[140px]" />
              <Skeleton className="h-3 w-full max-w-[110px]" />
            </div>
            <div className="border border-border rounded-2xl p-4 bg-card">
              <Skeleton className="h-36 w-full rounded-xl mb-3" />
              <Skeleton className="h-4 w-full max-w-[120px] mb-2" />
              <Skeleton className="h-3 w-full max-w-[140px] mb-2" />
              <Skeleton className="h-3 w-full max-w-[90px]" />
            </div>
            <Skeleton className="h-9 w-full rounded-xl" />
          </Card>

          {/* Editing Requests Skeleton */}
          <Card className="flex flex-col gap-4 overflow-hidden">
            <div className="space-y-2">
              <Skeleton className="h-6 w-full max-w-[180px]" />
              <Skeleton className="h-3 w-full max-w-[200px]" />
            </div>
            <div className="text-center py-8">
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          </Card>
        </div>
      </div>

      {/* Pipeline Section Skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <div className="border border-border rounded-2xl p-6 overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-16 max-w-full" />
                  <Skeleton className="h-5 w-6 rounded-full flex-shrink-0" />
                </div>
                <div className="space-y-2">
                  {[1, 2].map((j) => (
                    <div
                      key={j}
                      className="border border-border rounded-xl p-3 bg-card"
                    >
                      <Skeleton className="h-4 w-full max-w-[100px] mb-2" />
                      <Skeleton className="h-3 w-full max-w-[80px]" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
