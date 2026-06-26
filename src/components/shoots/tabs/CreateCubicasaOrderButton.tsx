import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { Loader2, FilePlus2 } from 'lucide-react';

export interface CreateCubicasaOrderButtonProps {
  /** Shoot identifier the order will be created against. */
  shootId: number | string;
  /** Current cubicasa_status (or null when no order linked). Displayed before activation per AC 19.8. */
  currentStatus?: string | null;
  /**
   * Whether the shoot already has a linked CubiCasa order. When true, the button label/dialog
   * indicates the call will sync the existing order rather than create a duplicate (AC 19.5).
   */
  alreadyLinked?: boolean;
  /** Callback invoked after a successful response so the caller can refresh shoot state. */
  onCreated?: () => void;
  /** Render only when the caller is permitted; defaults to true so the parent can gate visibility. */
  visible?: boolean;
  /** External disable signal (e.g. another mutation in flight). */
  disabled?: boolean;
}

/**
 * Manual CubiCasa order creation control (Req 19).
 *
 * Behavior:
 * - Displays the shoot's current cubicasa_status before activation (AC 19.8).
 * - Activates a confirmation dialog requiring confirmation before sending the create request
 *   (AC 19.7).
 * - Disables the control while the create request is in flight (AC 19.9).
 * - On confirm, POSTs to /api/integrations/shoots/{shoot}/cubicasa/order. The backend either
 *   creates a new order with a per-shoot Idempotency-Key (when unlinked) or syncs the existing
 *   order (when already linked) — see CubiCasaService::createOrder.
 * - Refreshes shoot state via onCreated() on success and surfaces error messages for non-2xx
 *   responses.
 */
export function CreateCubicasaOrderButton({
  shootId,
  currentStatus,
  alreadyLinked = false,
  onCreated,
  visible = true,
  disabled = false,
}: CreateCubicasaOrderButtonProps) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!visible) return null;

  const statusLabel = currentStatus ?? 'not_linked';
  const statusVariant: 'default' | 'destructive' | 'secondary' | 'outline' = (() => {
    const s = (currentStatus || '').toString().toLowerCase();
    if (s === 'ready') return 'default';
    if (s === 'fixing') return 'destructive';
    if (s === 'pending') return 'secondary';
    return 'outline';
  })();

  const buttonLabel = alreadyLinked ? 'Sync CubiCasa order' : 'Create CubiCasa order';
  const dialogTitle = alreadyLinked
    ? 'Sync existing CubiCasa order?'
    : 'Create CubiCasa order?';
  const dialogDescription = alreadyLinked
    ? `This shoot already has a linked CubiCasa order (status: ${statusLabel}). Confirming will sync the existing order with CubiCasa rather than creating a duplicate.`
    : `This will send a manual create request to CubiCasa for this shoot (current status: ${statusLabel}). A per-shoot idempotency key prevents duplicate orders if the request is retried.`;
  const confirmLabel = alreadyLinked ? 'Sync now' : 'Create order';

  const submitCreate = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/api/integrations/shoots/${shootId}/cubicasa/order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || (json && json.success === false)) {
        const message =
          (json && (json.message || json.error)) ||
          `CubiCasa order create failed (${res.status})`;
        throw new Error(message);
      }
      const synced = Boolean((json && (json.synced || json.mode === 'synced')) || alreadyLinked);
      toast({
        title: synced ? 'CubiCasa order synced' : 'CubiCasa order created',
        description: synced
          ? 'Existing CubiCasa order refreshed.'
          : 'CubiCasa order created and linked to this shoot.',
      });
      setConfirmOpen(false);
      if (onCreated) onCreated();
    } catch (err: any) {
      console.error('Create CubiCasa order failed', err);
      toast({
        title: 'CubiCasa order failed',
        description: err?.message || 'Could not create CubiCasa order.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="create-cubicasa-order-button"
    >
      {/* AC 19.8 — surface current cubicasa_status next to the control. */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">CubiCasa status:</span>
        <Badge variant={statusVariant} data-testid="cubicasa-current-status">
          {statusLabel}
        </Badge>
      </div>
      <span className="inline-flex" data-testid="cubicasa-create-order-button">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={disabled || isSubmitting}
          data-testid="create-cubicasa-order-trigger"
          title={
            alreadyLinked
              ? 'Sync the existing CubiCasa order for this shoot'
              : 'Manually create a CubiCasa order for this shoot'
          }
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              {alreadyLinked ? 'Syncing…' : 'Creating…'}
            </>
          ) : (
            <>
              <FilePlus2 className="mr-1 h-3.5 w-3.5" />
              {buttonLabel}
            </>
          )}
        </Button>
      </span>

      {/* AC 19.7 — explicit confirmation dialog before the create request is sent. */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          // Block closing the dialog while a request is in flight (AC 19.9).
          if (isSubmitting) return;
          setConfirmOpen(next);
        }}
      >
        <AlertDialogContent data-testid="create-cubicasa-order-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void submitCreate();
              }}
              disabled={isSubmitting}
              data-testid="create-cubicasa-order-confirm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  {alreadyLinked ? 'Syncing…' : 'Creating…'}
                </>
              ) : (
                confirmLabel
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CreateCubicasaOrderButton;
