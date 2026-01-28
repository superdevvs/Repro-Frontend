import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from './SharedComponents';

export const CompletedShootsCardSkeleton: React.FC = () => {
  return (
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
  );
};
