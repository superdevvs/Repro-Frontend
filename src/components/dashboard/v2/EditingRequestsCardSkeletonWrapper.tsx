import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from './SharedComponents';
import { EditingRequestsCardSkeleton } from './EditingRequestsCardSkeleton';

export const EditingRequestsCardSkeletonWrapper: React.FC = () => {
  return (
    <Card className="flex flex-col gap-4 overflow-hidden">
      <div className="space-y-2">
        <Skeleton className="h-6 w-full max-w-[180px]" />
        <Skeleton className="h-4 w-full max-w-[200px]" />
      </div>
      <EditingRequestsCardSkeleton />
    </Card>
  );
};
