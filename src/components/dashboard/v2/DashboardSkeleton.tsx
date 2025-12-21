import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from './SharedComponents';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column - Quick Actions & Assign Photographers */}
        <div className="lg:col-span-3 flex flex-col gap-6 sticky top-6">
          {/* Quick Actions Skeleton */}
          <Card className="flex flex-col gap-4 h-full">
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
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Assign Photographers Skeleton */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <div className="space-y-3">
              <div className="flex gap-4">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 border border-border rounded-2xl"
                >
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Middle Column - Upcoming Shoots */}
        <div className="lg:col-span-6">
          <Card className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-full" />
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
                        <div className="space-y-3">
                          <div>
                            <Skeleton className="h-5 w-48 mb-2" />
                            <Skeleton className="h-3 w-64" />
                          </div>
                          <Skeleton className="h-3 w-32" />
                          <div className="flex gap-2">
                            <Skeleton className="h-5 w-20 rounded-full" />
                            <Skeleton className="h-5 w-24 rounded-full" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                          <Skeleton className="h-7 w-20 rounded-full" />
                          <Skeleton className="h-3 w-32" />
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
          <Card className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-32" />
              <div className="flex gap-1">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="border border-border rounded-2xl p-4 bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Skeleton className="h-5 w-12 rounded-full" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Completed Shoots Skeleton */}
          <Card className="flex flex-col gap-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="border border-border rounded-2xl p-4 bg-card">
              <Skeleton className="h-48 w-full rounded-xl mb-3" />
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-40 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-9 w-full rounded-xl" />
          </Card>

          {/* Editing Requests Skeleton */}
          <Card className="flex flex-col gap-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-56" />
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
        <div className="border border-border rounded-2xl p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
                <div className="space-y-2">
                  {[1, 2].map((j) => (
                    <div
                      key={j}
                      className="border border-border rounded-xl p-3 bg-card"
                    >
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
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
