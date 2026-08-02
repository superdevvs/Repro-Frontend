import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE_URL } from '@/config/env';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import {
  canReviewRescheduleRequests,
  describeRescheduleStatus,
  normalizeRescheduleStatus,
  type RescheduleRequestRecord,
} from '@/utils/rescheduleRequests';

interface RescheduleRequestsPanelProps {
  shootId: string | number;
  /** Called after an approval so the parent can refetch the shoot. */
  onReviewed?: () => void;
}

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return format(parsed, 'MMM d, yyyy');
};

const authHeaders = () => {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Reschedule requests for a shoot, with their state made obvious.
 *
 * A1.docx item 4: the client button said "Request to reschedule" but the change
 * was applied on submission, so there was never anything to display. Now that a
 * request can sit pending, the three states have to be visible — and a reviewer
 * needs somewhere to act on them.
 */
export function RescheduleRequestsPanel({ shootId, onReviewed }: RescheduleRequestsPanelProps) {
  const { role } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<RescheduleRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | number | null>(null);

  const canReview = canReviewRescheduleRequests(role);

  const load = useCallback(async () => {
    if (!shootId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/shoots/${shootId}/reschedule-requests`,
        { headers: authHeaders() },
      );

      if (!response.ok) {
        setRequests([]);
        return;
      }

      const json = await response.json();
      setRequests(Array.isArray(json?.data) ? json.data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [shootId]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (request: RescheduleRequestRecord, status: 'approved' | 'rejected') => {
    setReviewingId(request.id);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/shoots/reschedule-requests/${request.id}`,
        {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ status }),
        },
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.message || 'Unable to update the request.');
      }

      toast({
        title: status === 'approved' ? 'Request approved' : 'Request rejected',
        description: json?.message,
      });

      await load();

      // Only an approval changes the shoot, so only that needs a parent refresh.
      if (status === 'approved') {
        onReviewed?.();
      }
    } catch (error) {
      toast({
        title: 'Could not update the request',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setReviewingId(null);
    }
  };

  if (loading || requests.length === 0) {
    return null;
  }

  return (
    <Card data-testid="reschedule-requests-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Reschedule requests</CardTitle>
        <CardDescription>
          A pending request does not change the shoot. The date moves only once it is approved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((request) => {
          const status = normalizeRescheduleStatus(request.status);
          const presentation = describeRescheduleStatus(request.status);
          const isBusy = reviewingId === request.id;

          return (
            <div
              key={request.id}
              className="rounded-lg border p-3 space-y-2"
              data-testid={`reschedule-request-${request.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm">
                  <p className="font-medium">
                    {formatDate(request.original_date)}
                    {request.original_time ? ` ${request.original_time}` : ''}
                    {' → '}
                    {formatDate(request.requested_date)}
                    {request.requested_time ? ` ${request.requested_time}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {request.requester?.name || 'a client'}
                  </p>
                </div>
                <Badge className={presentation.className} data-testid={`reschedule-status-${request.id}`}>
                  {presentation.label}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground">{presentation.description}</p>

              {request.reason && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Reason: </span>
                  {request.reason}
                </p>
              )}

              {status === 'rejected' && request.review_notes && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Reviewer note: </span>
                  {request.review_notes}
                </p>
              )}

              {canReview && status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={isBusy}
                    onClick={() => void review(request, 'approved')}
                  >
                    {isBusy ? 'Working…' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => void review(request, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default RescheduleRequestsPanel;
