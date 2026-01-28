import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const ProductionWorkflowBoardSkeleton: React.FC = () => {
  return (
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
  );
};
