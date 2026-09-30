import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/components/auth/AuthProvider';
import type { RescheduleRequestsState } from '@/features/dashboard/hooks/useRescheduleRequests';
import { canReviewRescheduleRequests } from '@/utils/rescheduleRequests';
import { parseLocalYmd } from '@/utils/shootLocalDate';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = parseLocalYmd(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return format(parsed, 'MMM d, yyyy');
};

const formatChange = (
  originalDate?: string | null,
  originalTime?: string | null,
  requestedDate?: string | null,
  requestedTime?: string | null,
) => {
  const from = `${formatDate(originalDate)}${originalTime ? ` ${originalTime}` : ''}`;
  const to = `${formatDate(requestedDate)}${requestedTime ? ` ${requestedTime}` : ''}`;
  return `${from} → ${to}`;
};

export function RescheduleRequestsPanel({ requests }: { requests: RescheduleRequestsState }) {
  const { role } = useAuth();
  const canReview = canReviewRescheduleRequests(role);

  if (requests.loading) {
    return <p role="status" className="p-3 text-sm text-muted-foreground">Loading reschedule requests...</p>;
  }
  if (requests.error) {
    return (
      <div role="alert" className="space-y-2 p-3 text-sm">
        <p>{requests.error}</p>
        <Button variant="outline" size="sm" onClick={requests.refresh}>Retry</Button>
      </div>
    );
  }
  if (!requests.requests.length) {
    return <EmptyState icon="clear" title="No pending reschedule requests." size="compact" />;
  }

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto" data-testid="dashboard-reschedule-requests-panel">
      {requests.requests.map((request) => (
        <div
          key={request.id}
          className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3"
          data-testid={`reschedule-request-${request.id}`}
        >
          <p className="select-text cursor-text break-words text-xs font-medium">{request.address}</p>
          {request.clientName && (
            <p className="text-xs text-muted-foreground">{request.clientName}</p>
          )}
          <p className="break-words text-xs font-medium">
            {formatChange(
              request.originalDate,
              request.originalTime,
              request.requestedDate,
              request.requestedTime,
            )}
          </p>
          {request.reason && (
            <p className="break-words whitespace-pre-wrap text-xs text-muted-foreground">
              {request.reason}
            </p>
          )}
          {request.requesterName && (
            <p className="text-xs text-muted-foreground">
              Requested by {request.requesterName}
            </p>
          )}
          {canReview && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={requests.actioning !== null}
                onClick={() => requests.decide(request.id, 'approved', request.shootId)}
              >
                Approve reschedule
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={requests.actioning !== null}
                onClick={() => requests.decide(request.id, 'rejected', request.shootId)}
              >
                Reject reschedule
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
