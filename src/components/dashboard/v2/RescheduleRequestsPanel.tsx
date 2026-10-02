import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/components/auth/AuthProvider';
import type { RescheduleRequestsState } from '@/features/dashboard/hooks/useRescheduleRequests';
import {
  canReviewRescheduleRequests,
  describeRescheduleStatus,
  normalizeRescheduleStatus,
} from '@/utils/rescheduleRequests';
import { parseLocalYmd } from '@/utils/shootLocalDate';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = parseLocalYmd(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return format(parsed, 'MMM d, yyyy');
};

const formatReviewedAt = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, 'MMM d, yyyy');
};

const formatChange = (
  originalDate?: string | null,
  originalTime?: string | null,
  requestedDate?: string | null,
  requestedTime?: string | null,
) => {
  const from = `${formatDate(originalDate)}${originalTime ? ` ${formatTime(originalTime)}` : ''}`;
  const to = `${formatDate(requestedDate)}${requestedTime ? ` ${formatTime(requestedTime)}` : ''}`;
  return `${from} → ${to}`;
};

const formatTime = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return value;
  const hour = Number(match[1]);
  const suffix = match[3]?.toUpperCase() || (hour >= 12 ? 'PM' : 'AM');
  return `${hour % 12 || 12}:${match[2]} ${suffix}`;
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
    return <EmptyState icon="clear" title="No reschedule requests." size="compact" />;
  }

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto" data-testid="dashboard-reschedule-requests-panel">
      {requests.requests.map((request) => {
        const status = normalizeRescheduleStatus(request.status);
        const presentation = describeRescheduleStatus(status);
        const isPending = status === 'pending';
        const reviewedLabel = formatReviewedAt(request.reviewedAt);

        return (
          <details
            key={request.id}
            className="group rounded-xl border border-border/60 bg-muted/20 open:border-primary/30"
            data-testid={`reschedule-request-${request.id}`}
            data-status={status}
          >
            <summary className="cursor-pointer list-none space-y-1.5 p-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden" aria-label={`Reschedule details for ${request.address}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 select-text break-words text-xs font-semibold line-clamp-2">{request.address}</p>
              <Badge
                className={`shrink-0 text-[9px] font-semibold border whitespace-nowrap px-1.5 py-0 ${presentation.className}`}
              >
                {presentation.label}
              </Badge>
            </div>
            <p className="break-words text-[11px] text-muted-foreground">
              {formatChange(
                request.originalDate,
                request.originalTime,
                request.requestedDate,
                request.requestedTime,
              )}
            </p>
            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="truncate">{request.clientName || 'Schedule change'}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </div>
            </summary>
            <div className="mx-2.5 mb-2.5 max-h-60 space-y-2 overflow-y-auto border-t border-border/60 pt-2.5">
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
            {!isPending && (request.approverName || reviewedLabel || request.reviewNotes) && (
              <div className="rounded-md bg-muted/40 p-2 space-y-1">
                {(request.approverName || reviewedLabel) && (
                  <p className="text-xs text-muted-foreground">
                    {request.approverName ?? 'Reviewer'}
                    {reviewedLabel ? ` · ${reviewedLabel}` : ''}
                  </p>
                )}
                {request.reviewNotes && (
                  <p className="break-words whitespace-pre-wrap text-xs text-muted-foreground">
                    {request.reviewNotes}
                  </p>
                )}
              </div>
            )}
            {isPending && canReview && (
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
          </details>
        );
      })}
    </div>
  );
}
