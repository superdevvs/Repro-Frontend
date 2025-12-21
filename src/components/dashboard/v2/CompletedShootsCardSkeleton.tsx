import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from './SharedComponents';

export const CompletedShootsCardSkeleton: React.FC = () => {
  return (
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
  );
};
