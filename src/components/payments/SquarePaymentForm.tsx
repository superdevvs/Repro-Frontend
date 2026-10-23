import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CreditCard as CreditCardIcon, MapPin, Package, User, Calendar, XCircle } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { format, parseISO, isValid } from 'date-fns';
import { API_BASE_URL, STRIPE_PUBLISHABLE_KEY } from '@/config/env';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js/pure';
import { blurActiveElement } from '@/components/shoots/dialogFocusUtils';
import type { PricingBreakdown } from '@/utils/pricing';
import {
  triggerDashboardOverviewRefresh,
  triggerInvoicesRefresh,
  triggerShootDetailRefresh,
  triggerShootHistoryRefresh,
} from '@/realtime/realtimeRefreshBus';
import { getCurrentReturnTo, sanitizeRelativeReturnTo } from '@/utils/paymentReturn';
import {
  getStripeConfirmationFailureMessage,
  isStripeSessionPaymentRecorded,
  isStripeSessionRefundedAsStale,
  isStripeConfirmationPending,
  readStripeConfirmation,
} from '@/utils/stripeConfirmation';
import { startPaymentStatusPolling } from '@/utils/paymentStatusPolling';
import type { NormalizedShootServiceItem } from '@/utils/shootServiceItems';
import { formatServiceItemStatus } from '@/utils/shootServiceItems';
import { getPaymentErrorMessage } from './paymentErrorMessage';
import type { PaymentSessionConfirmationResponse } from './squarePaymentModel';
type EmbeddedCheckoutInstance = {
  mount: (element: HTMLElement | string) => void;
  destroy: () => void;
};

type CheckoutOperation = {
  scope: string; sessionId: string | null; clientSecret: string | null; amount: number;
  controller: AbortController; request: AbortController | null; done: boolean; inFlight: boolean;
  mounting: boolean; mountVersion: number; completed: boolean; checks: number; closed: boolean;
  stop?: () => void; grace?: ReturnType<typeof setTimeout>; frame?: number;
};

export interface SquarePaymentSuccessPayload {
  status: 'success';
  amount: number;
  returnTo?: string | null;
}

export interface SquarePaymentFormHandle {
  /**
   * Programmatically open Stripe checkout for whatever amount is currently
   * configured. Used by SquarePaymentDialog to chain Cash → Stripe.
   */
  chargeOutstandingViaStripe: (amountOverride?: number) => void;
}

interface SquarePaymentFormProps {
  amount: number;
  paymentAmount?: number;
  currency?: string;
  shootId?: string;
  shootIds?: string[];
  clientEmail?: string;
  clientName?: string;
  shootAddress?: string;
  shootServices?: string[];
  serviceItems?: NormalizedShootServiceItem[];
  shootDate?: string;
  shootTime?: string;
  totalQuote?: number;
  totalPaid?: number;
  pricing?: PricingBreakdown;
  onPaymentSuccess?: (payment: SquarePaymentSuccessPayload) => void;
  onPaymentError?: (error: unknown) => void;
  disabled?: boolean;
  showShootDetails?: boolean;
  showAmountControls?: boolean;
  showPartialToggle?: boolean;
  onTogglePartial?: () => void;
  isPartialOpen?: boolean;
  onCheckoutActiveChange?: (active: boolean) => void;
  onCheckoutMounted?: () => void;
  /** Clients may pay the full balance or select service rows; arbitrary partials are not allocated. */
  requireAllocatedPartial?: boolean;
}

export const SquarePaymentForm = forwardRef<SquarePaymentFormHandle, SquarePaymentFormProps>(function SquarePaymentForm({
  amount,
  paymentAmount: paymentAmountOverride,
  currency = 'USD',
  shootId,
  shootIds,
  clientEmail,
  clientName,
  shootAddress,
  shootServices = [],
  serviceItems = [],
  shootDate,
  shootTime,
  totalQuote,
  totalPaid,
  pricing,
  onPaymentSuccess,
  onPaymentError,
  disabled = false,
  showShootDetails = true,
  showAmountControls = true,
  showPartialToggle = false,
  onTogglePartial,
  isPartialOpen = false,
  onCheckoutActiveChange,
  onCheckoutMounted,
  requireAllocatedPartial = false,
}: SquarePaymentFormProps, ref) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [embeddedCheckoutLoading, setEmbeddedCheckoutLoading] = useState(false);
  const embeddedCheckoutRef = useRef<EmbeddedCheckoutInstance | null>(null);
  const checkoutMountRef = useRef<HTMLDivElement>(null);
  const checkoutSessionIdRef = useRef<string | null>(null);
  const operationRef = useRef<CheckoutOperation | null>(null);
  const mountedRef = useRef(true);
  const scope = JSON.stringify([shootId ?? null, [...(shootIds ?? [])].sort()]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [completedCheckout, setCompletedCheckout] = useState(false);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);
  const callbacksRef = useRef({ onPaymentSuccess, onPaymentError, onCheckoutActiveChange, onCheckoutMounted });
  callbacksRef.current = { onPaymentSuccess, onPaymentError, onCheckoutActiveChange, onCheckoutMounted };

  const isCurrent = (operation: CheckoutOperation) => mountedRef.current
    && operationRef.current === operation && operation.scope === scopeRef.current && !operation.controller.signal.aborted;
  const notifyCheckoutUi = (operation: CheckoutOperation, notify: () => void) => {
    if (!isCurrent(operation)) return;
    try { void Promise.resolve(notify()).catch(() => undefined); }
    catch { /* A consumer UI callback cannot change the recorded payment outcome. */ }
  };
  const disposeCheckout = useCallback(() => {
    const operation = operationRef.current;
    operation?.stop?.();
    operation?.controller.abort();
    operation?.request?.abort();
    if (operation?.grace) clearTimeout(operation.grace);
    if (operation?.frame) cancelAnimationFrame(operation.frame);
    embeddedCheckoutRef.current?.destroy();
    embeddedCheckoutRef.current = null;
    operationRef.current = null;
    checkoutSessionIdRef.current = null;
  }, []);

  // Partial payment state
  const [paymentAmount, setPaymentAmount] = useState(amount);
  const [paymentAmountInput, setPaymentAmountInput] = useState(amount.toFixed(2));
  const [isPartialPaymentMode, setIsPartialPaymentMode] = useState(false);
  const [paymentScope, setPaymentScope] = useState<'full' | 'selected'>('full');
  const [selectedServiceItemIds, setSelectedServiceItemIds] = useState<string[]>([]);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const paymentAmountInputRef = useRef<HTMLInputElement>(null);
  const payableServiceItems = useMemo(
    () => serviceItems.filter((item) => item.id && item.balanceDue > 0.01),
    [serviceItems],
  );
  const displayShootServices = useMemo(() => {
    const serviceItemNames = serviceItems
      .map((item) => item.name)
      .filter((name): name is string => Boolean(name?.trim()));

    return serviceItemNames.length > 0
      ? Array.from(new Set(serviceItemNames))
      : shootServices;
  }, [serviceItems, shootServices]);
  const selectedServiceItems = useMemo(
    () => payableServiceItems.filter((item) => selectedServiceItemIds.includes(item.id)),
    [payableServiceItems, selectedServiceItemIds],
  );
  const selectedServiceBalance = selectedServiceItems.reduce((sum, item) => sum + item.balanceDue, 0);
  const isSelectedServicePayment = paymentScope === 'selected';
  const outstandingAmount = isSelectedServicePayment ? selectedServiceBalance : amount;
  const effectivePaymentAmount = paymentAmountOverride ?? paymentAmount;
  const confirmationStatusLabel = isSelectedServicePayment
    ? (selectedServiceItems.length === 1 ? 'Selected Service Payment' : 'Selected Services Payment')
    : 'Full Payment';

  // Update payment amount when props change
  useEffect(() => {
    const nextAmount = paymentAmountOverride ?? outstandingAmount;
    setPaymentAmount(nextAmount);
    setPaymentAmountInput(nextAmount.toFixed(2));
  }, [outstandingAmount, paymentAmountOverride]);

  useEffect(() => {
    if (paymentScope !== 'selected') return;
    setSelectedServiceItemIds((currentIds) => {
      const validIds = new Set(payableServiceItems.map((item) => item.id));
      const retained = currentIds.filter((id) => validIds.has(id));
      if (retained.length > 0 || payableServiceItems.length === 0) {
        return retained;
      }
      return [payableServiceItems[0].id];
    });
  }, [payableServiceItems, paymentScope]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; disposeCheckout(); };
  }, [disposeCheckout]);
  useEffect(() => {
    if (operationRef.current?.scope !== scope) {
      disposeCheckout();
      setPendingCheckout(false); setShowCheckoutDialog(false); setStripeLoading(false); setStripeError(null); setConfirmationNotice(null);
    }
    setCompletedCheckout(false);
  }, [disposeCheckout, scope]);
  useEffect(() => { setCompletedCheckout(false); }, [amount]);

  const remainingBalanceAfterPayment = outstandingAmount - effectivePaymentAmount;

  useImperativeHandle(ref, () => ({
    chargeOutstandingViaStripe: (amountOverride?: number) => {
      if (operationRef.current && !operationRef.current.done) return;
      const requestedAmount = amountOverride ?? effectivePaymentAmount;
      if (requestedAmount <= 0 || requestedAmount > outstandingAmount) {
        return;
      }
      if (amountOverride !== undefined) {
        setPaymentScope('full');
        setPaymentAmount(requestedAmount);
        setPaymentAmountInput(requestedAmount.toFixed(2));
        setIsPartialPaymentMode(requestedAmount < outstandingAmount);
      }
      blurActiveElement();
      setShowConfirmationDialog(true);
    },
  }), [effectivePaymentAmount, outstandingAmount]);

  const triggerPostPaymentRefreshes = useCallback((valid: () => boolean) => {
    const refreshes = [triggerDashboardOverviewRefresh, triggerInvoicesRefresh, triggerShootHistoryRefresh,
      ...(shootId ? [() => triggerShootDetailRefresh(shootId)] : []),
      ...(shootIds ?? []).map(id => () => triggerShootDetailRefresh(id))];
    for (const refresh of refreshes) { if (!valid()) return; refresh(); }
  }, [shootId, shootIds]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (effectivePaymentAmount <= 0 || effectivePaymentAmount > outstandingAmount) {
      toast({
        title: 'Invalid Payment Amount',
        description: outstandingAmount > 0
          ? `Payment amount must be between $0.01 and $${outstandingAmount.toFixed(2)}`
          : 'Select at least one unpaid service before continuing.',
        variant: 'destructive',
      });
      return;
    }

    if (isSelectedServicePayment && selectedServiceItemIds.length === 0) {
      toast({
        title: 'Select a Service',
        description: 'Choose at least one service item to allocate this payment.',
        variant: 'destructive',
      });
      return;
    }

    if (
      requireAllocatedPartial
      && !isSelectedServicePayment
      && Math.abs(effectivePaymentAmount - amount) > 0.009
    ) {
      toast({
        title: 'Choose Payment Scope',
        description: 'Pay the full order balance or select the service items you want to pay.',
        variant: 'destructive',
      });
      return;
    }

    if (isProcessing || disabled || completedCheckout || (operationRef.current && !operationRef.current.done)) {
      return;
    }

    blurActiveElement();
    setShowConfirmationDialog(true);
  };

  // One operation owns checkout creation, mounting, status checks and close timers.
  const handleConfirmPayment = async () => {
    if (disabled || completedCheckout || (operationRef.current && !operationRef.current.done)) return;
    disposeCheckout();
    const operation: CheckoutOperation = { scope, sessionId: null, clientSecret: null, amount: effectivePaymentAmount,
      controller: new AbortController(), request: null, done: false, inFlight: false,
      mounting: false, mountVersion: 0, completed: false, checks: 0, closed: false };
    operationRef.current = operation;
    setShowConfirmationDialog(false); setStripeLoading(true); setStripeError(null); setConfirmationNotice(null);
    try {
      if (!shootIds?.length && !shootId) throw new Error('This payment is missing its shoot reference. Refresh the page and try again.');
      if (!STRIPE_PUBLISHABLE_KEY) throw new Error('Stripe is not configured for this site.');
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await axios.post(shootIds?.length
        ? `${API_BASE_URL}/api/payments/stripe-multiple-shoots-embedded`
        : `${API_BASE_URL}/api/shoots/${shootId}/create-stripe-embedded-checkout`,
      shootIds?.length ? { shoot_ids: shootIds } : { amount: effectivePaymentAmount, return_to: getCurrentReturnTo() ?? undefined,
        ...(isSelectedServicePayment ? { shoot_service_ids: selectedServiceItemIds, allocation_strategy: 'selected_services' } : {}) },
      { signal: operation.controller.signal, timeout: 10000,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' } });
      if (!isCurrent(operation)) return;
      if (typeof response.data?.clientSecret !== 'string' || typeof response.data?.sessionId !== 'string'
        || !response.data.clientSecret || !response.data.sessionId) throw new Error('Stripe did not return a complete checkout session.');
      operation.sessionId = response.data.sessionId;
      operation.clientSecret = response.data.clientSecret;
      checkoutSessionIdRef.current = operation.sessionId;
      setPendingCheckout(true);
      mountCheckout(operation);
      startPaymentPolling(operation);
    } catch (error) {
      if (!isCurrent(operation)) return;
      operation.done = true;
      setStripeLoading(false);
      const message = getPaymentErrorMessage(error, 'Failed to open Stripe checkout.');
      setStripeError(message);
      toast({ title: 'Checkout unavailable', description: message, variant: 'destructive' });
      callbacksRef.current.onPaymentError?.(error);
    }
  };

  const pauseConfirmation = (operation: CheckoutOperation, message: string) => {
    if (!isCurrent(operation) || operation.done) return;
    operation.stop?.();
    setStripeLoading(false);
    setConfirmationNotice(message);
  };

  const startPaymentPolling = (operation: CheckoutOperation) => {
    if (!isCurrent(operation) || operation.done || operation.inFlight || !operation.sessionId) return;
    operation.stop?.();
    operation.stop = startPaymentStatusPolling(async isActive => {
      if (!isCurrent(operation) || operation.done || operation.inFlight || !operation.sessionId) return;
      operation.inFlight = true;
      const request = new AbortController();
      operation.request = request;
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await axios.post(shootIds?.length ? `${API_BASE_URL}/api/payments/stripe-session/confirm`
          : `${API_BASE_URL}/api/shoots/${shootId}/confirm-stripe-session`, { session_id: operation.sessionId },
        { signal: request.signal, timeout: 10000, headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!isActive() || !isCurrent(operation) || operation.done) return;
        const confirmation = readStripeConfirmation(response.data?.data ?? response.data) as PaymentSessionConfirmationResponse | null;
        if (isStripeSessionPaymentRecorded(confirmation, operation.sessionId)
          || isStripeSessionRefundedAsStale(confirmation, operation.sessionId)) {
          const paid = isStripeSessionPaymentRecorded(confirmation, operation.sessionId);
          operation.done = true;
          operation.stop?.();
          if (operation.grace) clearTimeout(operation.grace);
          embeddedCheckoutRef.current?.destroy(); embeddedCheckoutRef.current = null;
          checkoutSessionIdRef.current = null;
          setPendingCheckout(false); setCompletedCheckout(true); setShowCheckoutDialog(false); setEmbeddedCheckoutLoading(false);
          setStripeLoading(false); setConfirmationNotice(null);
          notifyCheckoutUi(operation, () => callbacksRef.current.onCheckoutActiveChange?.(false));
          if (!isCurrent(operation)) return;
          if (!paid) {
            const message = getStripeConfirmationFailureMessage(confirmation, operation.sessionId,
              'The Stripe charge was refunded because the invoice balance changed.');
            setStripeError(message);
            toast({ title: 'Payment refunded', description: message, variant: 'destructive' });
            if (isCurrent(operation)) callbacksRef.current.onPaymentError?.(new Error(message));
            return;
          }
          setStripeError(null);
          triggerPostPaymentRefreshes(() => isCurrent(operation));
          if (!isCurrent(operation)) return;
          const parsedAmount = Number(confirmation?.last_payment_amount ?? operation.amount);
          const amountPaid = Number.isFinite(parsedAmount) ? parsedAmount : operation.amount;
          toast({ title: 'Payment Successful', description: `Payment of $${amountPaid.toFixed(2)} has been processed via Stripe.` });
          if (isCurrent(operation)) {
            try {
              void Promise.resolve(callbacksRef.current.onPaymentSuccess?.({ status: 'success', amount: amountPaid,
                returnTo: sanitizeRelativeReturnTo(confirmation?.return_to ?? null) })).catch(() => {
                if (isCurrent(operation)) toast({ title: 'Payment received', description: 'Reload the dashboard to refresh your invoice.' });
              });
            } catch {
              if (isCurrent(operation)) toast({ title: 'Payment received', description: 'Reload the dashboard to refresh your invoice.' });
            }
          }
          return;
        }
        operation.checks += 1;
        if (!confirmation || confirmation.session_id !== operation.sessionId) {
          pauseConfirmation(operation, 'We could not verify this checkout. Check its status again or contact support before making another payment.');
        } else if (!isStripeConfirmationPending(confirmation, operation.sessionId) || (operation.completed && operation.checks >= 6)) {
          pauseConfirmation(operation, 'Payment confirmation is pending. Check its status again before making another payment.');
        }
      } catch (error) {
        if (!isActive() || !isCurrent(operation) || operation.done || request.signal.aborted) return;
        operation.checks += 1;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if ((status && status !== 408 && status !== 429 && status < 500) || (operation.completed && operation.checks >= 6)) {
          pauseConfirmation(operation, 'Payment confirmation is unavailable. Check its status again or contact support before making another payment.');
        }
      } finally {
        operation.inFlight = false;
        if (operation.request === request) operation.request = null;
        if (isCurrent(operation)) setStripeLoading(false);
      }
    });
  };

  const checkPaymentStatus = (operation: CheckoutOperation) => {
    if (!isCurrent(operation) || operation.done || operation.inFlight) return;
    if (operation.grace) clearTimeout(operation.grace);
    operation.completed = true; operation.checks = 0;
    setConfirmationNotice('Checking this checkout’s payment status...'); setStripeLoading(true);
    startPaymentPolling(operation);
  };

  const mountCheckout = (operation: CheckoutOperation) => {
    if (!isCurrent(operation) || operation.done || operation.mounting || !operation.clientSecret) return;
    if (operation.grace) clearTimeout(operation.grace);
    operation.closed = false; operation.mounting = true;
    const mountVersion = ++operation.mountVersion;
    setShowCheckoutDialog(true); setEmbeddedCheckoutLoading(true); setStripeError(null);
    notifyCheckoutUi(operation, () => callbacksRef.current.onCheckoutActiveChange?.(true));
    if (!isCurrent(operation)) return;
    operation.frame = requestAnimationFrame(async () => {
      try {
        if (!isCurrent(operation) || operation.done || operation.closed || operation.mountVersion !== mountVersion) return;
        const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
        if (!isCurrent(operation) || operation.done || operation.closed || operation.mountVersion !== mountVersion) return;
        if (!stripe) throw new Error('Failed to load Stripe');
        const checkout = await stripe.initEmbeddedCheckout({ clientSecret: operation.clientSecret!, onComplete: () => {
          if (!isCurrent(operation) || operation.done || operation.completed || operation.mountVersion !== mountVersion) return;
          operation.completed = true; operation.checks = 0;
          setConfirmationNotice('Checking this checkout’s payment status...');
          if (!operation.inFlight) startPaymentPolling(operation);
        } });
        if (!isCurrent(operation) || operation.done || operation.closed || operation.mountVersion !== mountVersion) { checkout.destroy(); return; }
        embeddedCheckoutRef.current = checkout;
        const waitForMount = () => {
          if (!isCurrent(operation) || operation.done || operation.closed || operation.mountVersion !== mountVersion) return;
          if (!checkoutMountRef.current) { operation.frame = requestAnimationFrame(waitForMount); return; }
          checkout.mount(checkoutMountRef.current);
          setEmbeddedCheckoutLoading(false); setStripeLoading(false);
          notifyCheckoutUi(operation, () => callbacksRef.current.onCheckoutMounted?.());
        };
        waitForMount();
      } catch {
        if (!isCurrent(operation) || operation.done || operation.closed || operation.mountVersion !== mountVersion) return;
        setShowCheckoutDialog(false); setEmbeddedCheckoutLoading(false); setStripeLoading(false);
        setConfirmationNotice('Checkout could not be displayed. Check its payment status or resume the same checkout.');
        notifyCheckoutUi(operation, () => callbacksRef.current.onCheckoutActiveChange?.(false));
      } finally { if (operation.mountVersion === mountVersion) operation.mounting = false; }
    });
  };

  const handleCloseCheckoutDialog = () => {
    const operation = operationRef.current;
    if (!operation || !isCurrent(operation) || operation.done) return;
    operation.closed = true;
    operation.mountVersion += 1; operation.mounting = false;
    if (operation.frame) cancelAnimationFrame(operation.frame);
    setShowCheckoutDialog(false); setStripeLoading(false); setEmbeddedCheckoutLoading(false);
    embeddedCheckoutRef.current?.destroy(); embeddedCheckoutRef.current = null;
    notifyCheckoutUi(operation, () => callbacksRef.current.onCheckoutActiveChange?.(false));
    if (!isCurrent(operation)) return;
    setConfirmationNotice('Payment confirmation is pending. Check the existing checkout before starting another payment.');
    if (operation.grace) clearTimeout(operation.grace);
    operation.grace = setTimeout(() => {
      if (!isCurrent(operation) || operation.done || !operation.closed) return;
      operation.stop?.(); operation.request?.abort();
      setStripeLoading(false);
    }, 10000);
  };
  const hasShootDetails = showShootDetails
    && (shootAddress
      || (shootServices && shootServices.length > 0)
      || totalQuote !== undefined
      || clientName
      || shootDate);

  const gridCols = showCheckoutDialog
    ? hasShootDetails
      ? 'grid-cols-1 lg:grid-cols-[1fr_1fr_1.2fr]'
      : 'grid-cols-1 lg:grid-cols-[1fr_1.2fr]'
    : hasShootDetails
      ? 'grid-cols-1 lg:grid-cols-2'
      : 'grid-cols-1';

  return (
    <div className={`grid gap-4 lg:h-full ${gridCols}`}>
      {/* Left Column - Shoot Details */}
      {hasShootDetails && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Shoot Details</h3>
          <div className="space-y-2">
            {/* Location */}
            {shootAddress && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium">{shootAddress}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Client Info */}
            {(clientName || clientEmail) && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Client</p>
                    {clientName && <p className="text-sm font-medium">{clientName}</p>}
                    {clientEmail && <p className="text-xs text-muted-foreground">{clientEmail}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Date & Time */}
            {(shootDate || shootTime) && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                    <p className="text-sm font-medium">
                      {(() => {
                        // Format the date nicely
                        let formattedDate = shootDate;
                        if (shootDate) {
                          try {
                            const parsed = typeof shootDate === 'string' && shootDate.includes('T') 
                              ? parseISO(shootDate) 
                              : new Date(shootDate);
                            if (isValid(parsed)) {
                              formattedDate = format(parsed, 'MMMM d, yyyy');
                            }
                          } catch (e) {
                            // Keep original if parsing fails
                          }
                        }
                        return formattedDate;
                      })()}
                      {shootTime && ` at ${shootTime}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Services */}
            {displayShootServices.length > 0 && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Services ({displayShootServices.length})</p>
                    <div className="text-sm font-medium">
                      {displayShootServices.map((service, idx) => (
                        <div key={idx} className="text-sm">• {service}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Summary */}
            {(totalQuote !== undefined || totalPaid !== undefined || pricing) && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2">Payment Summary</p>
                <div className="space-y-1 text-sm">
                  {pricing && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-semibold">${pricing.serviceSubtotal.toFixed(2)}</span>
                      </div>
                      {pricing.discountAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Discount</span>
                          <span className="font-semibold text-green-600">-${pricing.discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-semibold">${pricing.taxAmount.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {totalQuote !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{pricing ? 'Total' : 'Total Quote'}</span>
                      <span className="font-semibold">${totalQuote.toFixed(2)}</span>
                    </div>
                  )}
                  {totalPaid !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount Paid</span>
                      <span className="font-semibold text-green-600">${totalPaid.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span className="font-bold text-orange-600">${outstandingAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Column - Payment Form (Compact) */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold">Payment Details</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Payment Amount - Compact */}
          {showAmountControls && (
            <div className="p-3 border rounded-lg bg-muted/30">
              {payableServiceItems.length > 0 && (
                <div className="mb-3 space-y-2">
                  <Label className="text-xs text-muted-foreground">Payment Scope</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={paymentScope === 'full' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setPaymentScope('full');
                        setPaymentAmount(amount);
                        setPaymentAmountInput(amount.toFixed(2));
                        setIsPartialPaymentMode(false);
                      }}
                    >
                      Full Order
                    </Button>
                    <Button
                      type="button"
                      variant={paymentScope === 'selected' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setPaymentScope('selected');
                      }}
                    >
                      Selected Services
                    </Button>
                  </div>
                  {paymentScope === 'selected' && (
                    <div className="space-y-1.5 rounded-md border bg-background/60 p-2">
                      {payableServiceItems.map((item) => {
                        const checked = selectedServiceItemIds.includes(item.id);
                        return (
                          <label key={item.id} className="flex items-start gap-2 rounded-sm px-1 py-1 text-xs">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                setSelectedServiceItemIds((currentIds) => {
                                  if (value) {
                                    return currentIds.includes(item.id) ? currentIds : [...currentIds, item.id];
                                  }
                                  return currentIds.filter((id) => id !== item.id);
                                });
                              }}
                              className="mt-0.5"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{item.name}</span>
                              <span className="block text-[11px] text-muted-foreground">
                                {formatServiceItemStatus(item.paymentStatus)} · ${item.balanceDue.toFixed(2)} due
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Label htmlFor="paymentAmount" className="text-xs text-muted-foreground">Amount</Label>
                  <div className="flex items-center gap-2">
                    {requireAllocatedPartial ? (
                      <span className="text-lg font-bold" data-testid="allocated-payment-amount">
                        ${effectivePaymentAmount.toFixed(2)}
                      </span>
                    ) : (<>
                      <span className="text-lg font-bold">$</span>
                      <Input
                      ref={paymentAmountInputRef}
                      id="paymentAmount"
                      type="text"
                      inputMode="decimal"
                      value={paymentAmountInput}
                      onChange={(e) => {
                        let inputValue = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = inputValue.split('.');
                        if (parts.length > 2) inputValue = parts[0] + '.' + parts.slice(1).join('');
                        if (parts.length === 2 && parts[1].length > 2) inputValue = parts[0] + '.' + parts[1].substring(0, 2);
                        setPaymentAmountInput(inputValue);
                        setIsPartialPaymentMode(true);
                        const numericValue = parseFloat(inputValue);
                        if (!isNaN(numericValue) && numericValue > 0) {
                          setPaymentAmount(Math.min(numericValue, outstandingAmount));
                        } else {
                          setPaymentAmount(0);
                        }
                      }}
                      onBlur={(e) => {
                        const numericValue = parseFloat(e.target.value);
                        if (isNaN(numericValue) || numericValue < 0.01) {
                          setPaymentAmountInput(outstandingAmount.toFixed(2));
                          setPaymentAmount(outstandingAmount);
                        } else if (numericValue > outstandingAmount) {
                          setPaymentAmountInput(outstandingAmount.toFixed(2));
                          setPaymentAmount(outstandingAmount);
                        } else {
                          setPaymentAmountInput(numericValue.toFixed(2));
                          setPaymentAmount(numericValue);
                        }
                        setIsPartialPaymentMode(false);
                      }}
                      className="text-lg font-bold h-9 w-28 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </>)}
                  </div>
                </div>
                {!requireAllocatedPartial && <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={!isPartialPaymentMode ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      setPaymentAmount(outstandingAmount);
                      setPaymentAmountInput(outstandingAmount.toFixed(2));
                      setIsPartialPaymentMode(false);
                    }}
                  >
                    Full
                  </Button>
                  <Button
                    type="button"
                    variant={isPartialPaymentMode ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      setIsPartialPaymentMode(true);
                      const half = Math.ceil(outstandingAmount * 0.5 * 100) / 100;
                      setPaymentAmount(half);
                      setPaymentAmountInput(half.toFixed(2));
                      paymentAmountInputRef.current?.focus();
                    }}
                  >
                    Partial
                  </Button>
                </div>}
              </div>
              {remainingBalanceAfterPayment > 0 && effectivePaymentAmount > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Remaining after payment: <span className="text-orange-600 font-medium">${remainingBalanceAfterPayment.toFixed(2)}</span>
                </p>
              )}
            </div>
          )}

          {/* Stripe Error */}
          {stripeError && (
            <div className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <XCircle className="h-3 w-3 flex-shrink-0" />
                {stripeError}
              </p>
            </div>
          )}

          {pendingCheckout && confirmationNotice && (
            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <p role="status" className="text-sm">{confirmationNotice}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={stripeLoading} onClick={() => {
                  if (operationRef.current) checkPaymentStatus(operationRef.current);
                }}>Check payment status</Button>
                {!showCheckoutDialog && <Button type="button" variant="outline" size="sm" onClick={() => {
                  const operation = operationRef.current;
                  if (!operation || !isCurrent(operation) || operation.done) return;
                  mountCheckout(operation); startPaymentPolling(operation);
                }}>Resume secure checkout</Button>}
              </div>
            </div>
          )}

          {/* Stripe Waiting State */}
          {stripeLoading && (
            <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Waiting for payment to complete...
                </p>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Complete the payment in the Stripe checkout window.
              </p>
            </div>
          )}

          {showPartialToggle && onTogglePartial && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onTogglePartial}
            >
              {isPartialOpen ? 'Pay Full Amount' : 'Pay Partial'}
            </Button>
          )}

          {/* Pay Now Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={disabled || isProcessing || stripeLoading || pendingCheckout || completedCheckout || effectivePaymentAmount <= 0}
          >
            {stripeLoading ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" />
                Waiting for payment...
              </>
            ) : (
              <>
                <CreditCardIcon className="mr-2 h-4 w-4" />
                {`Pay $${effectivePaymentAmount.toFixed(2)} with Stripe`}
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Inline Stripe Embedded Checkout (third column) */}
      {showCheckoutDialog && (
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between flex-shrink-0 mb-3">
            <h3 className="text-base font-semibold">Stripe Checkout</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleCloseCheckoutDialog}
            >
              <XCircle className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>
          <div className="border rounded-lg overflow-y-auto bg-white dark:bg-background flex-1 min-h-0">
            {embeddedCheckoutLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div ref={checkoutMountRef} className="w-full" />
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>You'll complete payment securely with Stripe below.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Amount:</span>
              <span className="text-xl font-bold">${effectivePaymentAmount.toFixed(2)}</span>
            </div>
            <Separator />
            {remainingBalanceAfterPayment > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining:</span>
                <span className="text-orange-600 font-medium">${remainingBalanceAfterPayment.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="text-green-600 font-medium">{confirmationStatusLabel}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmationDialog(false)} disabled={stripeLoading}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPayment} disabled={stripeLoading}>
              {stripeLoading ? <Loader2 aria-hidden="true" className="h-4 w-4" /> : 'Pay with Stripe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
