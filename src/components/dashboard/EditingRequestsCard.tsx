import React from 'react';
import { Card } from './v2/SharedComponents';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EditingRequest } from '@/services/editingRequestService';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { EditingRequestsCardSkeleton } from './v2/EditingRequestsCardSkeleton';

interface EditingRequestsCardProps {
  requests: EditingRequest[];
  loading?: boolean;
  onCreate?: () => void;
  maxItems?: number;
}

const PRIORITY_STYLES: Record<EditingRequest['priority'], string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  normal: 'bg-sky-50 text-sky-700 border-sky-200',
  high: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_STYLES: Record<EditingRequest['status'], string> = {
  open: 'text-amber-600 bg-amber-50 border-amber-200',
  in_progress: 'text-sky-600 bg-sky-50 border-sky-200',
  completed: 'text-emerald-600 bg-emerald-50 border-emerald-200',
};

export const EditingRequestsCard: React.FC<EditingRequestsCardProps> = ({
  requests,
  loading,
  onCreate,
  maxItems = 5,
}) => {
  const list = requests.slice(0, maxItems);

  return (
    <Card className="flex flex-col h-full gap-3 sm:gap-4 min-h-0">
      <div className="flex-shrink-0">
        <h2 className="text-base sm:text-lg font-bold text-foreground">Special editing requests</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Track escalations routed to the editing team.</p>
      </div>

      {loading ? (
        <EditingRequestsCardSkeleton />
      ) : list.length === 0 ? (
        <div className="flex-1 flex flex-col items-center min-h-[120px] px-4">
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs sm:text-sm text-muted-foreground italic">No active requests.</p>
          </div>
          {onCreate && (
            <Button size="sm" onClick={onCreate} className="w-full mt-auto mb-4">
              New request
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">
          {list.map((request) => {
            const createdLabel = request.created_at
              ? format(new Date(request.created_at), 'MMM d • h:mm a')
              : null;
            const shootLabel = request.shoot?.address
              ? request.shoot.address
              : request.shoot_id
                ? `Shoot #${request.shoot_id}`
                : 'No shoot linked';

            return (
              <div
                key={request.id}
                className="rounded-xl sm:rounded-2xl border border-border/60 bg-muted/20 p-2.5 sm:p-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-foreground break-words">{request.summary}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 break-words">{shootLabel}</p>
                  </div>
                  <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
                    <Badge className={cn('text-[9px] sm:text-[10px] font-semibold border whitespace-nowrap', PRIORITY_STYLES[request.priority])}>
                      {request.priority}
                    </Badge>
                    <Badge className={cn('text-[9px] sm:text-[10px] font-semibold border whitespace-nowrap', STATUS_STYLES[request.status])}>
                      {request.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 text-[10px] sm:text-xs text-muted-foreground flex flex-wrap justify-between gap-1">
                  <span className="break-all">Tracking: {request.tracking_code}</span>
                  {createdLabel && <span className="flex-shrink-0">{createdLabel}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {onCreate && list.length > 0 && (
        <Button size="sm" onClick={onCreate} className="w-full mt-auto flex-shrink-0">
          New request
        </Button>
      )}
    </Card>
  );
};

