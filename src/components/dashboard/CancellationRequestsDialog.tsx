import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';
import { MapPin, User, Calendar } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { format } from 'date-fns';
import { parseLocalYmd } from '@/utils/shootLocalDate';
import { useIsMobile } from '@/hooks/use-mobile';
import { CancellationDecisionActions } from '@/components/dashboard/CancellationDecisionActions';

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
  const isMobile = useIsMobile();
  const [shoots, setShoots] = useState<CancellationShoot[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const handleApprove = async (shootId: number, decision: 'charge_fee' | 'waive_fee') => {
    setActionLoading(`${shootId}:${decision}`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/approve-cancellation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          decision,
          ...(decision === 'charge_fee' ? { cancellation_fee: 60 } : {}),
        }),
      });
      if (res.ok) {
        toast({
          title: 'Cancellation approved',
          description: decision === 'charge_fee'
            ? 'Shoot has been cancelled and a $60 cancellation fee was applied.'
            : 'Shoot has been cancelled with no cancellation fee.',
        });
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
    setActionLoading(`${shootId}:reject`);
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
      return format(parseLocalYmd(s.scheduledDate), 'MMM d, yyyy') + (s.time ? ` at ${s.time}` : '');
    } catch {
      return s.scheduledDate;
    }
  };

  const Shell: React.ElementType = isMobile ? Drawer : Dialog;
  const ShellContent: React.ElementType = isMobile ? DrawerContent : DialogContent;
  const ShellHeader: React.ElementType = isMobile ? DrawerHeader : DialogHeader;
  const ShellTitle: React.ElementType = isMobile ? DrawerTitle : DialogTitle;
  const shellProps = isMobile
    ? { open, onOpenChange, shouldScaleBackground: false }
    : { open, onOpenChange };

  return (
    <Shell {...shellProps}>
      <ShellContent
        className={
          isMobile
            ? 'max-h-[90dvh] flex flex-col'
            : 'sm:max-w-lg max-h-[80vh] flex flex-col'
        }
      >
        <ShellHeader className={isMobile ? 'pb-2 text-left' : undefined}>
          <ShellTitle className="text-base font-semibold">
            Pending cancellations
          </ShellTitle>
        </ShellHeader>

        <div
          className={
            isMobile
              ? 'flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]'
              : 'flex-1 overflow-y-auto -mx-6 px-6'
          }
          style={{ scrollbarWidth: 'thin' }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : shoots.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No pending cancellations
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {shoots.map((shoot) => {
                const isActioning = actionLoading?.startsWith(`${shoot.id}:`) ?? false;
                const dateStr = formatDate(shoot);
                const normalizedStatus = String(shoot.status || '').toLowerCase();
                const canApplyCancellationFee = ['scheduled', 'booked', 'on_hold'].includes(normalizedStatus);
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
                    {canApplyCancellationFee && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Choose whether to apply or waive the $60 cancellation fee.
                      </p>
                    )}

                    <CancellationDecisionActions
                      shootId={shoot.id}
                      addressLabel={formatAddress(shoot)}
                      actionLoading={actionLoading}
                      disabled={isActioning}
                      onCharge={() => handleApprove(shoot.id, 'charge_fee')}
                      onWaive={() => handleApprove(shoot.id, 'waive_fee')}
                      onReject={() => handleReject(shoot.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ShellContent>
    </Shell>
  );
};
