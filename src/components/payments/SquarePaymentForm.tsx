import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard as CreditCardIcon, MapPin, Package, User, Calendar, Tag, CheckCircle2, XCircle } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { API_BASE_URL, STRIPE_PUBLISHABLE_KEY } from '@/config/env';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';
import { blurActiveElement } from '@/components/shoots/dialogFocusUtils';

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
  shootDate?: string;
  shootTime?: string;
  totalQuote?: number;
  totalPaid?: number;
  onPaymentSuccess?: (payment: any) => void;
  onPaymentError?: (error: any) => void;
  disabled?: boolean;
  showShootDetails?: boolean;
  showAmountControls?: boolean;
  showPartialToggle?: boolean;
  onTogglePartial?: () => void;
  isPartialOpen?: boolean;
  onCheckoutActiveChange?: (active: boolean) => void;
  onCheckoutMounted?: () => void;
}

export function SquarePaymentForm({
  amount,
  paymentAmount: paymentAmountOverride,
  currency = 'USD',
  shootId,
  shootIds,
  clientEmail,
  clientName,
  shootAddress,
  shootServices = [],
  shootDate,
  shootTime,
  totalQuote,
  totalPaid,
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
}: SquarePaymentFormProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [embeddedCheckoutLoading, setEmbeddedCheckoutLoading] = useState(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const embeddedCheckoutRef = useRef<any>(null);
  const checkoutMountRef = useRef<HTMLDivElement>(null);
  const checkoutSessionIdRef = useRef<string | null>(null);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; discountType: 'percentage' | 'fixed' } | null>(null);
  
  // Partial payment state
  const [paymentAmount, setPaymentAmount] = useState(amount);
  const [paymentAmountInput, setPaymentAmountInput] = useState(amount.toFixed(2));
  const [isPartialPaymentMode, setIsPartialPaymentMode] = useState(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const paymentAmountInputRef = useRef<HTMLInputElement>(null);
  const outstandingAmount = amount;
  const effectivePaymentAmount = paymentAmountOverride ?? paymentAmount;

  // Update payment amount when props change
  useEffect(() => {
    const nextAmount = paymentAmountOverride ?? amount;
    setPaymentAmount(nextAmount);
    setPaymentAmountInput(nextAmount.toFixed(2));
  }, [amount, paymentAmountOverride]);

  // Cleanup polling and embedded checkout on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (embeddedCheckoutRef.current) {
        embeddedCheckoutRef.current.destroy();
        embeddedCheckoutRef.current = null;
      }
    };
  }, []);
  
  const remainingBalanceAfterPayment = outstandingAmount - effectivePaymentAmount;

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

      if (effectivePaymentAmount <= 0 || effectivePaymentAmount > outstandingAmount) {
        toast({
          title: 'Invalid Payment Amount',
          description: `Payment amount must be between $0.01 and $${outstandingAmount.toFixed(2)}`,
          variant: 'destructive',
        });
        return;
      }
    
    if (isProcessing || disabled) {
      return;
    }

    blurActiveElement();
    setShowConfirmationDialog(true);
  };

  // Process payment via Stripe Checkout after confirmation
  const handleConfirmPayment = async () => {
    setShowConfirmationDialog(false);
    setStripeLoading(true);
    setStripeError(null);

    try {
      const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');

      const isBulk = shootIds && shootIds.length > 0;
      const url = isBulk
        ? `${API_BASE_URL}/api/payments/stripe-multiple-shoots-embedded`
        : `${API_BASE_URL}/api/shoots/${shootId}/create-stripe-embedded-checkout`;
      const body = isBulk
        ? { shoot_ids: shootIds }
        : { amount: effectivePaymentAmount };

      const response = await axios.post(url, body, {
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          'Content-Type': 'application/json',
        },
      });

      if (!response.data?.clientSecret) {
        setStripeLoading(false);
        throw new Error('No client secret returned');
      }

      checkoutSessionIdRef.current = response.data.sessionId || null;

      // Show inline embedded checkout
      authTokenRef.current = authToken;
      setShowCheckoutDialog(true);
      setEmbeddedCheckoutLoading(true);
      onCheckoutActiveChange?.(true);

      // Mount embedded checkout after the inline container renders
      requestAnimationFrame(async () => {
        try {
          const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
          if (!stripe) throw new Error('Failed to load Stripe');

          const checkout = await stripe.initEmbeddedCheckout({
            clientSecret: response.data.clientSecret,
          });
          embeddedCheckoutRef.current = checkout;

          // Wait for mount element to be ready
          const waitForMount = () => {
            if (checkoutMountRef.current) {
              checkout.mount(checkoutMountRef.current);
              setEmbeddedCheckoutLoading(false);
              // Notify parent after mount so it can scroll
              setTimeout(() => onCheckoutMounted?.(), 100);
            } else {
              requestAnimationFrame(waitForMount);
            }
          };
          waitForMount();
        } catch (mountErr: any) {
          console.error('Stripe embedded checkout mount error:', mountErr);
          setEmbeddedCheckoutLoading(false);
        }
      });

      startPaymentPolling();
    } catch (error: any) {
      setStripeLoading(false);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        'Failed to create Stripe checkout session.';

      setStripeError(errorMessage);
      toast({
        title: 'Payment Error',
        description: errorMessage,
        variant: 'destructive',
      });

      if (onPaymentError) {
        onPaymentError(error);
      }
    }
  };

  const startPaymentPolling = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    const isBulk = shootIds && shootIds.length > 0;

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const token = authTokenRef.current;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        if (!isBulk && shootId && checkoutSessionIdRef.current) {
          await axios.post(
            `${API_BASE_URL}/api/shoots/${shootId}/confirm-stripe-session`,
            { session_id: checkoutSessionIdRef.current },
            { headers }
          ).catch(() => null);
        }

        if (isBulk) {
          // Poll each shoot and check if any payment was made
          const results = await Promise.all(
            shootIds.map((id) =>
              axios.get(`${API_BASE_URL}/api/shoots/${id}/payment-details`, { headers }).catch(() => null)
            )
          );
          let totalCurrentDue = 0;
          for (const res of results) {
            if (!res) continue;
            const d = res.data?.data || res.data;
            const paid = d?.payments?.filter((p: any) => p.status === 'completed').reduce((s: number, p: any) => s + (p.amount || 0), 0) || 0;
            totalCurrentDue += Math.max((d?.total_quote || 0) - paid, 0);
          }
          if (totalCurrentDue < outstandingAmount) {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setStripeLoading(false);
            setShowCheckoutDialog(false);
            onCheckoutActiveChange?.(false);
            checkoutSessionIdRef.current = null;
            if (embeddedCheckoutRef.current) { embeddedCheckoutRef.current.destroy(); embeddedCheckoutRef.current = null; }
            toast({ title: 'Payment Successful', description: `Bulk payment has been processed via Stripe.` });
            if (onPaymentSuccess) onPaymentSuccess({ status: 'success', amount: effectivePaymentAmount });
          }
        } else {
          const statusRes = await axios.get(
            `${API_BASE_URL}/api/shoots/${shootId}/payment-details`,
            { headers }
          );
          const shootData = statusRes.data?.data || statusRes.data;
          const totalPaid = shootData?.payments
            ?.filter((p: any) => p.status === 'completed')
            .reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
          const currentDue = (shootData?.total_quote || 0) - totalPaid;

          if (currentDue < outstandingAmount) {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setStripeLoading(false);
            setShowCheckoutDialog(false);
            onCheckoutActiveChange?.(false);
            checkoutSessionIdRef.current = null;
            if (embeddedCheckoutRef.current) { embeddedCheckoutRef.current.destroy(); embeddedCheckoutRef.current = null; }
            toast({ title: 'Payment Successful', description: `Payment of $${effectivePaymentAmount.toFixed(2)} has been processed via Stripe.` });
            if (onPaymentSuccess) onPaymentSuccess({ status: 'success', amount: effectivePaymentAmount });
          }
        }
      } catch {
        // Ignore polling errors, will retry
      }
    }, 3000);
  };

  const handleCloseCheckoutDialog = () => {
    setShowCheckoutDialog(false);
    onCheckoutActiveChange?.(false);
    if (embeddedCheckoutRef.current) {
      embeddedCheckoutRef.current.destroy();
      embeddedCheckoutRef.current = null;
    }
    // Keep polling for 10s after dialog closed in case webhook is processing
    setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
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
            {shootServices && shootServices.length > 0 && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Services ({shootServices.length})</p>
                    <div className="text-sm font-medium">
                      {shootServices.map((service, idx) => (
                        <div key={idx} className="text-sm">• {service}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Summary */}
            {(totalQuote !== undefined || totalPaid !== undefined) && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2">Payment Summary</p>
                <div className="space-y-1 text-sm">
                  {totalQuote !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Quote</span>
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
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Label htmlFor="paymentAmount" className="text-xs text-muted-foreground">Amount</Label>
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>
                <div className="flex gap-1">
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
                </div>
              </div>
              {remainingBalanceAfterPayment > 0 && effectivePaymentAmount > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Remaining after payment: <span className="text-orange-600 font-medium">${remainingBalanceAfterPayment.toFixed(2)}</span>
                </p>
              )}
            </div>
          )}

          {/* Coupon Code Input */}
          <div className="p-3 border rounded-lg bg-muted/30">
            <Label htmlFor="couponCode" className="text-xs flex items-center gap-1 mb-2">
              <Tag className="h-3 w-3" />
              Coupon Code (Optional)
            </Label>
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    {appliedCoupon.code} - {appliedCoupon.discountType === 'percentage' 
                      ? `${appliedCoupon.discount}% off` 
                      : `$${appliedCoupon.discount.toFixed(2)} off`}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-600 hover:text-red-700"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponCode('');
                    setCouponError(null);
                  }}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="couponCode"
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setCouponError(null);
                  }}
                  placeholder="Enter coupon code"
                  className="h-9 text-sm flex-1"
                  disabled={couponLoading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={!couponCode.trim() || couponLoading}
                  onClick={async () => {
                    if (!couponCode.trim()) return;
                    setCouponLoading(true);
                    setCouponError(null);
                    try {
                      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
                      const res = await axios.post(
                        `${API_BASE_URL}/api/coupons/validate`,
                        { code: couponCode.trim(), amount: effectivePaymentAmount },
                        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
                      );
                      if (res.data.valid) {
                        setAppliedCoupon({
                          code: couponCode.trim(),
                          discount: res.data.discount || res.data.discount_amount || 0,
                          discountType: res.data.discount_type || 'fixed',
                        });
                        toast({ title: 'Coupon Applied!', description: `Discount of ${res.data.discount_type === 'percentage' ? `${res.data.discount}%` : `$${res.data.discount}`} applied.` });
                      } else {
                        setCouponError(res.data.message || 'Invalid coupon code');
                      }
                    } catch (err: any) {
                      setCouponError(err.response?.data?.message || 'Failed to validate coupon');
                    } finally {
                      setCouponLoading(false);
                    }
                  }}
                >
                  {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
            )}
            {couponError && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {couponError}
              </p>
            )}
            {appliedCoupon && (
              <p className="text-xs text-green-600 mt-2">
                New total: <span className="font-bold">${Math.max(0, effectivePaymentAmount - (appliedCoupon.discountType === 'percentage' ? effectivePaymentAmount * appliedCoupon.discount / 100 : appliedCoupon.discount)).toFixed(2)}</span>
              </p>
            )}
          </div>

          {/* Stripe Error */}
          {stripeError && (
            <div className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <XCircle className="h-3 w-3 flex-shrink-0" />
                {stripeError}
              </p>
            </div>
          )}

          {/* Stripe Waiting State */}
          {stripeLoading && (
            <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
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
            disabled={disabled || isProcessing || stripeLoading || effectivePaymentAmount <= 0}
          >
            {stripeLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            <DialogDescription>You'll be redirected to Stripe to complete payment</DialogDescription>
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
                <span className="text-green-600 font-medium">Full Payment</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmationDialog(false)} disabled={stripeLoading}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPayment} disabled={stripeLoading}>
              {stripeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay with Stripe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
