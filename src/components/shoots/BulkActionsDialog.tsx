import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { ShootData } from '@/types/shoots';
import { formatWorkflowStatus } from '@/utils/status';
import { apiClient } from '@/services/api';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Edit3,
  Eye,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ShootDetailsModal } from '@/components/shoots/ShootDetailsModal';
import { SquarePaymentDialog } from '@/components/payments/SquarePaymentDialog';

interface BulkActionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shoots: ShootData[];
  onComplete?: () => void;
  isLoading?: boolean;
}

type BulkAction = 'pay' | 'editing' | 'finalize' | 'delete';

type FilterMode = 'all' | 'eligible' | 'unpaid' | 'uploaded' | 'editing';

type PaymentMethod = 'square' | 'mark-paid';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const normalizeStatus = (shoot: ShootData) =>
  (shoot.workflowStatus || shoot.status || '').toLowerCase();

const isUnpaid = (shoot: ShootData) =>
  (shoot.payment?.totalPaid ?? 0) < (shoot.payment?.totalQuote ?? 0);

const isUploaded = (shoot: ShootData) => {
  const statusKey = normalizeStatus(shoot);
  return (
    statusKey.includes('uploaded') ||
    statusKey.includes('raw_uploaded') ||
    statusKey.includes('photos_uploaded') ||
    statusKey === 'completed'
  );
};

const isEditing = (shoot: ShootData) => {
  const statusKey = normalizeStatus(shoot);
  return statusKey === 'editing' || statusKey.includes('editing');
};

const isEligibleForAction = (shoot: ShootData, action: BulkAction) => {
  if (action === 'delete') return true;
  if (action === 'pay') return isUnpaid(shoot);
  if (action === 'editing') return isUploaded(shoot);
  return isEditing(shoot);
};

const resolveAddress = (shoot: ShootData) =>
  shoot.location?.fullAddress ||
  shoot.location?.address ||
  shoot.location?.city ||
  'Address unavailable';

export function BulkActionsDialog({
  isOpen,
  onClose,
  shoots,
  onComplete,
  isLoading = false,
}: BulkActionsDialogProps) {
  const { toast } = useToast();
  const [selectedShoots, setSelectedShoots] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('eligible');
  const [activeAction, setActiveAction] = useState<BulkAction>('pay');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('square');
  const [processing, setProcessing] = useState(false);
  const [detailShootId, setDetailShootId] = useState<string | number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [squarePaymentOpen, setSquarePaymentOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDetailShootId(null);
      setIsDetailOpen(false);
      return;
    }
    setSelectedShoots(new Set());
    setSearchTerm('');
    setFilterMode('eligible');
    setActiveAction('pay');
    setPaymentMethod('square');
  }, [isOpen]);

  const filteredShoots = useMemo(() => {
    const lowered = searchTerm.trim().toLowerCase();
    return shoots.filter((shoot) => {
      if (filterMode === 'unpaid' && !isUnpaid(shoot)) return false;
      if (filterMode === 'uploaded' && !isUploaded(shoot)) return false;
      if (filterMode === 'editing' && !isEditing(shoot)) return false;
      if (filterMode === 'eligible' && !isEligibleForAction(shoot, activeAction)) return false;

      if (!lowered) return true;
      const address = resolveAddress(shoot).toLowerCase();
      const client = shoot.client?.name?.toLowerCase() ?? '';
      const shootId = String(shoot.id ?? '').toLowerCase();
      return (
        address.includes(lowered) ||
        client.includes(lowered) ||
        shootId.includes(lowered)
      );
    });
  }, [shoots, searchTerm, filterMode, activeAction]);

  const selectedShootsData = useMemo(
    () => shoots.filter((shoot) => selectedShoots.has(String(shoot.id))),
    [shoots, selectedShoots],
  );

  const eligibleShoots = useMemo(
    () => selectedShootsData.filter((shoot) => isEligibleForAction(shoot, activeAction)),
    [selectedShootsData, activeAction],
  );

  const totalDue = useMemo(
    () =>
      eligibleShoots.reduce((sum, shoot) => {
        const quote = shoot.payment?.totalQuote ?? 0;
        const paid = shoot.payment?.totalPaid ?? 0;
        return sum + Math.max(quote - paid, 0);
      }, 0),
    [eligibleShoots],
  );

  const toggleShoot = (shootId: string) => {
    setSelectedShoots((prev) => {
      const next = new Set(prev);
      if (next.has(shootId)) {
        next.delete(shootId);
      } else {
        next.add(shootId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const ids = filteredShoots.map((shoot) => String(shoot.id));
    const allSelected = ids.every((id) => selectedShoots.has(id));
    setSelectedShoots((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleAction = async () => {
    if (!selectedShootsData.length) {
      toast({
        title: 'No shoots selected',
        description: 'Select at least one shoot to continue.',
        variant: 'destructive',
      });
      return;
    }

    if (!eligibleShoots.length) {
      toast({
        title: 'No eligible shoots',
        description: 'Your selection does not include shoots eligible for this action.',
        variant: 'destructive',
      });
      return;
    }

    if (activeAction === 'delete') {
      const confirmed = window.confirm(
        `Delete ${eligibleShoots.length} shoot(s)? This action cannot be undone.`
      );
      if (!confirmed) {
        return;
      }
    }

    if (activeAction === 'pay' && paymentMethod === 'square') {
      setSquarePaymentOpen(true);
      return;
    }

    setProcessing(true);

    try {
      if (activeAction === 'delete') {
        await Promise.all(
          eligibleShoots.map((shoot) => apiClient.delete(`/shoots/${shoot.id}`)),
        );
        toast({
          title: 'Shoots deleted',
          description: `${eligibleShoots.length} shoot(s) deleted successfully.`,
        });
      } else if (activeAction === 'editing') {
        await Promise.all(
          eligibleShoots.map((shoot) => apiClient.post(`/shoots/${shoot.id}/start-editing`)),
        );
        toast({
          title: 'Sent to editing',
          description: `${eligibleShoots.length} shoot(s) moved to editing.`,
        });
      } else if (activeAction === 'finalize') {
        await Promise.all(
          eligibleShoots.map((shoot) => apiClient.post(`/shoots/${shoot.id}/finalize`)),
        );
        toast({
          title: 'Finalized shoots',
          description: `${eligibleShoots.length} shoot(s) finalized successfully.`,
        });
      } else {
        await Promise.all(
          eligibleShoots.map((shoot) => {
            const quote = shoot.payment?.totalQuote ?? 0;
            const paid = shoot.payment?.totalPaid ?? 0;
            const amount = Math.max(quote - paid, 0);
            return apiClient.post(`/shoots/${shoot.id}/mark-paid`, {
              payment_type: 'manual',
              amount,
            });
          }),
        );
        toast({
          title: 'Marked as paid',
          description: `${eligibleShoots.length} shoot(s) updated.`,
        });
      }

      if (onComplete) {
        await onComplete();
      }
      onClose();
    } catch (error: any) {
      toast({
        title: 'Action failed',
        description:
          error?.response?.data?.message ||
          'Something went wrong while processing the bulk action.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSquarePaymentSuccess = async () => {
    setSquarePaymentOpen(false);
    setProcessing(true);

    try {
      await Promise.all(
        eligibleShoots.map((shoot) => {
          const quote = shoot.payment?.totalQuote ?? 0;
          const paid = shoot.payment?.totalPaid ?? 0;
          const amount = Math.max(quote - paid, 0);
          return apiClient.post(`/shoots/${shoot.id}/mark-paid`, {
            payment_type: 'square',
            amount,
          });
        }),
      );

      toast({
        title: 'Payment recorded',
        description: `${eligibleShoots.length} shoot(s) updated.`,
      });

      if (onComplete) {
        await onComplete();
      }
      onClose();
    } catch (error: any) {
      toast({
        title: 'Payment update failed',
        description: error?.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1100px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Actions</DialogTitle>
          <DialogDescription>
            Select multiple shoots and apply a batch action in one pass.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 flex-1 overflow-hidden">
          <div className="flex flex-col gap-4 overflow-visible">
            <div className="flex flex-wrap items-center gap-3 overflow-visible">
              <div className="relative flex-1 min-w-[240px] z-20 rounded-md focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring">
                <Input
                  placeholder="Search by address, client, or shoot id"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <Button variant="outline" size="sm" onClick={toggleSelectAll} className="relative z-0">
                {filteredShoots.length > 0 &&
                filteredShoots.every((shoot) => selectedShoots.has(String(shoot.id)))
                  ? 'Deselect visible'
                  : 'Select visible'}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {([
                { key: 'eligible', label: 'Eligible' },
                { key: 'all', label: 'All' },
                { key: 'unpaid', label: 'Unpaid' },
                { key: 'uploaded', label: 'Uploaded' },
                { key: 'editing', label: 'Editing' },
              ] as Array<{ key: FilterMode; label: string }>).map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant={filterMode === item.key ? 'default' : 'outline'}
                  onClick={() => setFilterMode(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{filteredShoots.length} shoots</span>
              <span>{selectedShootsData.length} selected</span>
            </div>

            <div className="space-y-2 overflow-y-auto pr-2 flex-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
                  <Loader2 className="h-6 w-6 animate-spin mb-3" />
                  <p className="text-sm">Loading shoots...</p>
                </div>
              ) : filteredShoots.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
                  <AlertCircle className="h-10 w-10 mb-3 opacity-50" />
                  <p className="font-medium">No shoots found</p>
                  <p className="text-sm">Adjust filters or search to see results.</p>
                </div>
              ) : (
                filteredShoots.map((shoot) => {
                  const shootId = String(shoot.id);
                  const isSelected = selectedShoots.has(shootId);
                  const statusLabel = formatWorkflowStatus(shoot.workflowStatus ?? shoot.status ?? '');
                  const paymentStatus = isUnpaid(shoot) ? 'Unpaid' : 'Paid';
                  const scheduledDate = shoot.scheduledDate
                    ? format(new Date(shoot.scheduledDate), 'MMM d, yyyy')
                    : 'Date TBD';

                  return (
                    <Card
                      key={shootId}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-inset ring-primary/20'
                          : 'hover:bg-muted/40'
                      }`}
                      onClick={() => toggleShoot(shootId)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleShoot(shootId)}
                            onClick={(event) => event.stopPropagation()}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{resolveAddress(shoot)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {scheduledDate} · {shoot.client?.name ?? 'Client'}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  {statusLabel}
                                </Badge>
                                <Badge variant={paymentStatus === 'Paid' ? 'outline' : 'destructive'} className="text-xs">
                                  {paymentStatus}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (shoot.id) {
                                      setDetailShootId(shoot.id);
                                      setIsDetailOpen(true);
                                    }
                                  }}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Overview
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5 overflow-hidden">
            <div className="grid gap-2">
              <Button
                variant={activeAction === 'editing' ? 'default' : 'outline'}
                className="justify-start gap-2"
                onClick={() => setActiveAction('editing')}
              >
                <Edit3 className="h-4 w-4" />
                Send to Editing
              </Button>
              <Button
                variant={activeAction === 'delete' ? 'destructive' : 'outline'}
                className="justify-start gap-2"
                onClick={() => setActiveAction('delete')}
              >
                <Trash2 className="h-4 w-4" />
                Delete Shoots
              </Button>
              <Button
                variant={activeAction === 'finalize' ? 'default' : 'outline'}
                className="justify-start gap-2"
                onClick={() => setActiveAction('finalize')}
              >
                <Sparkles className="h-4 w-4" />
                Finalize Shoots
              </Button>
              <Button
                variant={activeAction === 'pay' ? 'default' : 'outline'}
                className="justify-start gap-2"
                onClick={() => setActiveAction('pay')}
              >
                <CreditCard className="h-4 w-4" />
                Pay Multiple
              </Button>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Selected</span>
                <span className="font-semibold">{selectedShootsData.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Eligible</span>
                <span className="font-semibold">{eligibleShoots.length}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total due</span>
                <span className="flex items-center gap-2 font-semibold">
                  <DollarSign className="h-4 w-4" />
                  {currencyFormatter.format(totalDue)}
                </span>
              </div>
            </div>

            {activeAction === 'pay' && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Payment method</p>
                <div className="grid gap-2">
                  <Card
                    className={`cursor-pointer transition-all ${
                      paymentMethod === 'square'
                        ? 'border-primary bg-primary/5 ring-2 ring-inset ring-primary/20'
                        : 'hover:bg-muted/40'
                    }`}
                    onClick={() => setPaymentMethod('square')}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <CreditCard className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">Card payment</p>
                        <p className="text-xs text-muted-foreground">Square checkout</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className={`cursor-pointer transition-all ${
                      paymentMethod === 'mark-paid'
                        ? 'border-primary bg-primary/5 ring-2 ring-inset ring-primary/20'
                        : 'hover:bg-muted/40'
                    }`}
                    onClick={() => setPaymentMethod('mark-paid')}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">Mark as paid</p>
                        <p className="text-xs text-muted-foreground">Manual payment</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeAction === 'delete' && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium">Deleting shoots is permanent.</p>
                  <p>All media, invoices, and history for selected shoots will be removed.</p>
                </div>
              </div>
            )}

            {eligibleShoots.length === 0 && selectedShootsData.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium">No eligible shoots for this action.</p>
                  <p>Select shoots that match the action requirements.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={onClose} disabled={processing} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={processing || isLoading || eligibleShoots.length === 0}
                variant={activeAction === 'delete' ? 'destructive' : 'default'}
                className="flex-1"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : activeAction === 'editing' ? (
                  'Send to Editing'
                ) : activeAction === 'delete' ? (
                  'Delete Shoots'
                ) : activeAction === 'finalize' ? (
                  'Finalize Shoots'
                ) : paymentMethod === 'square' ? (
                  `Pay ${currencyFormatter.format(totalDue)}`
                ) : (
                  'Mark as Paid'
                )}
              </Button>
            </div>
          </div>
        </div>
        {detailShootId !== null && (
          <ShootDetailsModal
            shootId={detailShootId}
            isOpen={isDetailOpen}
            onClose={() => {
              setIsDetailOpen(false);
              setDetailShootId(null);
            }}
            onShootUpdate={onComplete}
          />
        )}
        <SquarePaymentDialog
          isOpen={squarePaymentOpen}
          onClose={() => setSquarePaymentOpen(false)}
          amount={totalDue}
          shootAddress={`${eligibleShoots.length} shoots selected`}
          shootServices={eligibleShoots.map((shoot) => resolveAddress(shoot)).slice(0, 5)}
          totalQuote={eligibleShoots.reduce((sum, shoot) => sum + (shoot.payment?.totalQuote ?? 0), 0)}
          totalPaid={eligibleShoots.reduce((sum, shoot) => sum + (shoot.payment?.totalPaid ?? 0), 0)}
          onPaymentSuccess={handleSquarePaymentSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
