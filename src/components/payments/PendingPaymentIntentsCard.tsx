import React, { useState } from 'react';
import { Banknote, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  confirmOfflinePaymentIntent,
  declineOfflinePaymentIntent,
} from '@/services/offlinePaymentService';
import type { PendingPaymentIntent } from '@/types/shoots';

interface PendingPaymentIntentsCardProps {
  shootId: number | string;
  pendingPayments: PendingPaymentIntent[];
  /**
   * When true, render Confirm/Decline action buttons. Otherwise the card is
   * read-only (client view).
   */
  canModerate: boolean;
  onChanged?: () => void;
}

const formatMethod = (method: string): string =>
  method === 'check' ? 'Cheque' : method === 'cash' ? 'Cash' : method;

export function PendingPaymentIntentsCard({
  shootId,
  pendingPayments,
  canModerate,
  onChanged,
}: PendingPaymentIntentsCardProps) {
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [declineTarget, setDeclineTarget] = useState<PendingPaymentIntent | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  if (!pendingPayments || pendingPayments.length === 0) {
    return null;
  }

  const total = pendingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const handleConfirm = async (payment: PendingPaymentIntent) => {
    setBusyId(payment.id);
    try {
      await confirmOfflinePaymentIntent(shootId, payment.id);
      toast({
        title: 'Payment confirmed',
        description: `$${Number(payment.amount).toFixed(2)} recorded successfully.`,
      });
      onChanged?.();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : 'Unable to confirm payment.');
      toast({ title: 'Confirm failed', description: message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async () => {
    if (!declineTarget) return;
    setBusyId(declineTarget.id);
    try {
      await declineOfflinePaymentIntent(shootId, declineTarget.id, declineReason);
      toast({
        title: 'Payment declined',
        description: 'The client has been notified.',
      });
      setDeclineTarget(null);
      setDeclineReason('');
      onChanged?.();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : 'Unable to decline payment.');
      toast({ title: 'Decline failed', description: message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm dark:border-amber-700/40 dark:bg-amber-950/40">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
          <Banknote className="h-4 w-4" />
          Pending offline payments
        </p>
        <span className="text-xs font-medium text-amber-900/80 dark:text-amber-200/80">
          ${total.toFixed(2)} awaiting review
        </span>
      </div>
      <ul className="space-y-2">
        {pendingPayments.map((payment) => (
          <li
            key={payment.id}
            className="rounded-md border border-amber-200/70 bg-white p-2.5 text-xs dark:border-amber-800/40 dark:bg-amber-900/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  ${Number(payment.amount).toFixed(2)} · {formatMethod(payment.paymentMethod)}
                </p>
                {payment.submittedByName && (
                  <p className="text-muted-foreground">
                    Submitted by {payment.submittedByName}
                    {payment.submittedByRole ? ` (${payment.submittedByRole})` : ''}
                  </p>
                )}
                {payment.checkNumber && (
                  <p className="text-muted-foreground">Cheque #{payment.checkNumber}</p>
                )}
                {payment.paymentDate && (
                  <p className="text-muted-foreground">Date: {payment.paymentDate}</p>
                )}
                {payment.notes && (
                  <p className="text-muted-foreground">Notes: {payment.notes}</p>
                )}
              </div>
              {canModerate && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={busyId === payment.id}
                    onClick={() => handleConfirm(payment)}
                  >
                    {busyId === payment.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Confirm
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === payment.id}
                    onClick={() => {
                      setDeclineTarget(payment);
                      setDeclineReason('');
                    }}
                  >
                    <XCircle className="mr-1 h-3 w-3" /> Decline
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!canModerate && (
        <p className="mt-2 text-xs text-amber-900/80 dark:text-amber-200/70">
          Your shoot balance will update once an admin confirms the payment.
        </p>
      )}

      <Dialog open={Boolean(declineTarget)} onOpenChange={(open) => !open && setDeclineTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Decline payment</DialogTitle>
            <DialogDescription>
              Optional reason — the client will see this in the email.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={declineReason}
            onChange={(event) => setDeclineReason(event.target.value)}
            rows={4}
            placeholder="Reason for declining (optional)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineTarget(null)} disabled={busyId !== null}>
              Cancel
            </Button>
            <Button onClick={handleDecline} disabled={busyId !== null}>
              {busyId !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
