import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Loader2, MapPin, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface CancellationShoot {
  id: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  scheduledDate?: string;
  time?: string;
  status?: string;
  cancellationRequestedAt?: string;
  cancellationReason?: string;
  client?: {
    id: number;
    name?: string;
  } | null;
  photographer?: {
    id: number;
    name?: string;
  } | null;
}

interface CancellationRequestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete?: () => void;
}

export const CancellationRequestsDialog: React.FC<CancellationRequestsDialogProps> = ({
  open,
  onOpenChange,
  onActionComplete,
}) => {
  const { toast } = useToast();
  const [shoots, setShoots] = useState<CancellationShoot[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const getToken = () => localStorage.getItem('authToken') || localStorage.getItem('token');

  const fetchPendingCancellations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/shoots/pending-cancellations`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Accept': 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json.data) ? json.data : [];
        setShoots(data.map((s: any) => ({
          id: Number(s.id),
          address: s.location?.fullAddress || s.location?.address || s.address,
          city: s.location?.city || s.city,
          state: s.location?.state || s.state,
          zip: s.location?.zip || s.zip,
          scheduledDate: s.scheduledDate || s.scheduled_date || s.scheduledAt,
          time: s.time,
          status: s.workflowStatus || s.workflow_status || s.status,
          cancellationRequestedAt: s.cancellationRequestedAt || s.cancellation_requested_at,
          cancellationReason: s.cancellationReason || s.cancellation_reason,
          client: s.client ? { id: Number(s.client.id), name: s.client.name } : null,
          photographer: s.photographer ? { id: Number(s.photographer.id), name: s.photographer.name } : null,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch pending cancellations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchPendingCancellations();
  }, [open, fetchPendingCancellations]);

  const handleApprove = async (shootId: number) => {
    setActionLoading(shootId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/approve-cancellation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (res.ok) {
        toast({ title: 'Cancellation approved', description: 'Shoot has been cancelled.' });
        setShoots(prev => prev.filter(s => s.id !== shootId));
        onActionComplete?.();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'Error', description: err.message || 'Failed to approve', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (shootId: number) => {
    setActionLoading(shootId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/reject-cancellation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (res.ok) {
        toast({ title: 'Cancellation rejected', description: 'Request has been dismissed.' });
        setShoots(prev => prev.filter(s => s.id !== shootId));
        onActionComplete?.();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'Error', description: err.message || 'Failed to reject', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatAddress = (s: CancellationShoot) => {
    const parts = [s.address, s.city, s.state, s.zip].filter(Boolean);
    return parts.join(', ') || `Shoot #${s.id}`;
  };

  const formatDate = (s: CancellationShoot) => {
    if (!s.scheduledDate) return null;
    try {
      return format(new Date(s.scheduledDate), 'MMM d, yyyy') + (s.time ? ` at ${s.time}` : '');
    } catch {
      return s.scheduledDate;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Pending cancellations
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6" style={{ scrollbarWidth: 'thin' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : shoots.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No pending cancellations
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {shoots.map((shoot) => {
                const isActioning = actionLoading === shoot.id;
                const dateStr = formatDate(shoot);
                return (
                  <div
                    key={shoot.id}
                    className="rounded-xl border border-border bg-muted/20 p-3 space-y-2"
                  >
                    {/* Address */}
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                      <span className="text-sm font-medium text-foreground leading-tight">
                        {formatAddress(shoot)}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {shoot.client?.name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" strokeWidth={1.5} />
                          {shoot.client.name}
                        </span>
                      )}
                      {dateStr && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" strokeWidth={1.5} />
                          {dateStr}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        #{shoot.id}
                      </Badge>
                    </div>

                    {/* Reason */}
                    {shoot.cancellationReason && (
                      <p className="text-[11px] text-muted-foreground italic border-l-2 border-rose-300 dark:border-rose-700 pl-2">
                        {shoot.cancellationReason}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                        disabled={isActioning}
                        onClick={() => handleApprove(shoot.id)}
                      >
                        {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" strokeWidth={2} />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-950/30"
                        disabled={isActioning}
                        onClick={() => handleReject(shoot.id)}
                      >
                        {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" strokeWidth={2} />}
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
