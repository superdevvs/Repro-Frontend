import React, { useState } from 'react';
import { Card } from './v2/SharedComponents';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EditingRequest, EditingRequestUpdatePayload } from '@/services/editingRequestService';
import { cn } from '@/lib/utils';
import { EditingRequestsCardSkeleton } from './v2/EditingRequestsCardSkeleton';
import { useToast } from '@/hooks/use-toast';

interface EditingRequestsCardProps {
  requests: EditingRequest[];
  loading?: boolean;
  onCreate?: () => void;
  onUpdate?: (id: number, payload: EditingRequestUpdatePayload) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  maxItems?: number;
  onRequestClick?: (requestId: number) => void;
}

const PRIORITY_STYLES: Record<EditingRequest['priority'], string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  normal: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800',
  high: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
};

const STATUS_STYLES: Record<EditingRequest['status'], string> = {
  open: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  in_progress: 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800',
  completed: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
};

const STATUS_LABELS: Record<EditingRequest['status'], string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const EditingRequestsCard: React.FC<EditingRequestsCardProps> = ({
  requests,
  loading,
  onCreate,
  onUpdate,
  onDelete,
  maxItems = 5,
  onRequestClick,
}) => {
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  
  // Filter out completed requests for display, show open/in_progress first
  const activeRequests = Array.isArray(requests) ? requests.filter(r => r && r.status !== 'completed') : [];
  const list = activeRequests.slice(0, maxItems);
  
  const handleRequestClick = (requestId: number) => {
    if (onRequestClick) {
      onRequestClick(requestId);
    } else if (onCreate) {
      onCreate();
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="flex-shrink-0 flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-bold text-foreground">Special editing requests</h2>
        {activeRequests.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {activeRequests.length} active
          </Badge>
        )}
      </div>

      {loading ? (
        <EditingRequestsCardSkeleton />
      ) : list.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[120px] px-4">
          <p className="text-xs sm:text-sm text-muted-foreground italic mb-4">No active requests.</p>
          {onCreate && (
            <Button size="sm" onClick={onCreate} className="w-full">
              New request
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 mb-3" style={{ maxHeight: '165px' }}>
            {list.map((request) => {
              if (!request || !request.id) return null;

              return (
                <button
                  key={request.id}
                  onClick={() => handleRequestClick(request.id)}
                  className={cn(
                    "w-full text-left rounded-xl border border-border/60 bg-muted/20 p-3 hover:border-primary/40 hover:bg-muted/30 transition-colors",
                    actionLoading === request.id && "opacity-50 pointer-events-none"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground break-words flex-1 min-w-0">
                      {request.summary || 'Untitled request'}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge className={cn('text-[10px] font-semibold border whitespace-nowrap', PRIORITY_STYLES[request.priority] || PRIORITY_STYLES.normal)}>
                        {request.priority || 'normal'}
                      </Badge>
                      <Badge className={cn('text-[10px] font-semibold border whitespace-nowrap', STATUS_STYLES[request.status] || STATUS_STYLES.open)}>
                        {STATUS_LABELS[request.status] || 'Open'}
                      </Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {onCreate && (
            <Button size="sm" onClick={onCreate} className="w-full flex-shrink-0">
              New request
            </Button>
          )}
        </>
      )}
    </Card>
  );
};
