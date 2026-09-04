import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Calendar, Camera, CreditCard, Lock, XCircle } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL, STRIPE_PUBLISHABLE_KEY } from '@/config/env';
import { loadStripe } from '@stripe/stripe-js/pure';
import { canUseSafeHistoryFallback, sanitizeRelativeReturnTo } from '@/utils/paymentReturn';
import { sumCompletedPayments } from '@/utils/shootPaymentSummary';
import {
  getStripeConfirmationFailureMessage,
  isStripeSessionPaymentRecorded,
  isStripeSessionRefundedAsStale,
} from '@/utils/stripeConfirmation';
import { PaymentAlreadyPaidState, PaymentErrorState, PaymentLoadingState } from './PaymentPageStates';
import { PaymentSuccessReceipt } from './PaymentSuccessReceipt';
import { getPaymentErrorMessage } from '@/components/payments/paymentErrorMessage';

import {
  AUTO_RETURN_DELAY_SECONDS,
  POPUP_CLOSE_DELAY_SECONDS,
  formatPaymentCurrency as formatCurrency,
  formatPaymentScheduledAt as formatScheduledAt,
  resolvePaymentInvoiceAdjustmentsTotal,
  type EmbeddedCheckoutInstance,
  type PaymentConfirmationResult,
  type ShootDetails,
} from './paymentPageModel';

export default function PaymentPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSessionId = searchParams.get('session_id');
  const initialReturnTo = searchParams.get('return_to');
  const isSuccessRedirect = searchParams.get('success') === 'true' && Boolean(initialSessionId);
  const [shoot, setShoot] = useState<ShootDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(isSuccessRedirect);
  const [isPartialOpen, setIsPartialOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentAmountInput, setPaymentAmountInput] = useState('0.00');
  const [lastPaymentAmount, setLastPaymentAmount] = useState<number | null>(null);
  const [resolvedReturnTo, setResolvedReturnTo] = useState<string | null>(
    sanitizeRelativeReturnTo(initialReturnTo),
  );
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [embeddedCheckoutLoading, setEmbeddedCheckoutLoading] = useState(false);
  const [autoReturnCancelled, setAutoReturnCancelled] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const embeddedCheckoutRef = useRef<EmbeddedCheckoutInstance | null>(null);
  const checkoutMountRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkoutSessionIdRef = useRef<string | null>(initialSessionId);
  const fetchShootDetails = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/public/payments/${token}`);
      setShoot(response.data.data || response.data);
    } catch (error: unknown) {
      console.error('Failed to fetch shoot details:', error);
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setError(message || 'Failed to load shoot details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);
  const destroyEmbeddedCheckout = useCallback(() => {
    if (!embeddedCheckoutRef.current) return;
    try {
      embeddedCheckoutRef.current.destroy();
    } catch (destroyError) {
      console.warn('Failed to destroy embedded checkout cleanly:', destroyError);
    } finally {
      embeddedCheckoutRef.current = null;
    }
  }, []);
  const confirmStripeSession = useCallback(async (sessionId: string): Promise<PaymentConfirmationResult | null> => {
    if (!token || !sessionId) {
      return null;
    }
    try {
      const response = await axios.post(`${API_BASE_URL}/api/public/payments/${token}/confirm`, {
        session_id: sessionId,
      });
      return (response.data?.data || response.data) as PaymentConfirmationResult;
    } catch {
      // Ignore confirmation errors and let polling/webhooks continue
      return null;
    }
  }, [token]);
  useEffect(() => {
    if (token && !isSuccessRedirect) {
      fetchShootDetails();
    }
  }, [token, fetchShootDetails, isSuccessRedirect]);
  useEffect(() => {
    if (!isSuccessRedirect || !initialSessionId) {
      setConfirmingPayment(false);
      return;
    }
    let cancelled = false;
    const confirmPayment = async () => {
      setConfirmingPayment(true);
      const confirmation = await confirmStripeSession(initialSessionId);
      const paymentRecorded = isStripeSessionPaymentRecorded(confirmation, initialSessionId);
      if (paymentRecorded) {
        // The payment webhook may already have revoked the public link, so a
        // paid exact-session confirmation is sufficient for the receipt page.
        setError(null);
        setLoading(false);
      } else {
        await fetchShootDetails();
      }
      if (cancelled) {
        return;
      }
      const confirmedAmount = Number(confirmation?.last_payment_amount ?? Number.NaN);
      if (paymentRecorded) {
        if (Number.isFinite(confirmedAmount) && confirmedAmount > 0) {
          setLastPaymentAmount(confirmedAmount);
        }
        if (confirmation?.shoot) {
          setShoot(confirmation.shoot);
        } else if (confirmation?.receipt) {
          setShoot((current) => current ? { ...current, receipt: confirmation.receipt ?? null } : current);
        }
      }
      setResolvedReturnTo(
        sanitizeRelativeReturnTo(confirmation?.return_to ?? initialReturnTo),
      );
      setAutoReturnCancelled(false);
      setPaymentSuccess(paymentRecorded);
      if (!paymentRecorded) {
        setStripeError(getStripeConfirmationFailureMessage(
          confirmation,
          initialSessionId,
          'This Stripe session has not been confirmed as paid yet. Please retry or contact support if the charge appears on your card.',
        ));
      }
      setConfirmingPayment(false);
    };
    void confirmPayment();
    return () => {
      cancelled = true;
    };
  }, [confirmStripeSession, fetchShootDetails, initialReturnTo, initialSessionId, isSuccessRedirect]);
  const totalPaid = sumCompletedPayments(shoot?.payments);
  const amountDue = Math.max((shoot?.total_quote || 0) - totalPaid, 0);
  const fullAddress = shoot
    ? [shoot.address, shoot.city, shoot.state, shoot.zip].filter(Boolean).join(', ')
    : '';
  useEffect(() => {
    setPaymentAmount(amountDue);
    setPaymentAmountInput(amountDue.toFixed(2));
    setIsPartialOpen(false);
  }, [amountDue]);
  const effectivePaymentAmount = isPartialOpen ? paymentAmount : amountDue;
  const remainingAfterPartial = Math.max(amountDue - paymentAmount, 0);
  const scheduledAtLabel = formatScheduledAt(shoot?.scheduled_date, shoot?.time);
  const subtotalAmount = shoot?.service_subtotal ?? ((shoot?.base_quote || 0) + (shoot?.discount_amount || 0));
  const invoiceAdjustmentsTotal = resolvePaymentInvoiceAdjustmentsTotal(shoot);
  const mobileServiceCount = shoot?.services?.length ?? 0;
  const pageMaxWidthClass = showEmbeddedCheckout ? 'max-w-[1480px]' : 'max-w-[1180px]';
  const paymentLayoutClass = showEmbeddedCheckout
    ? 'xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]'
    : 'xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]';
  const handleTogglePartial = () => {
    setIsPartialOpen((prev) => {
      const next = !prev;
      if (!next) {
        setPaymentAmount(amountDue);
        setPaymentAmountInput(amountDue.toFixed(2));
      } else if (paymentAmount <= 0 || paymentAmount > amountDue) {
        setPaymentAmount(amountDue);
        setPaymentAmountInput(amountDue.toFixed(2));
      }
      return next;
    });
  };
  const handlePartialAmountChange = (value: string) => {
    let inputValue = value.replace(/[^0-9.]/g, '');
    const parts = inputValue.split('.');
    if (parts.length > 2) inputValue = parts[0] + '.' + parts.slice(1).join('');
    if (parts.length === 2 && parts[1].length > 2) {
      inputValue = parts[0] + '.' + parts[1].substring(0, 2);
    }
    setPaymentAmountInput(inputValue);
    const numericValue = parseFloat(inputValue);
    if (!isNaN(numericValue)) {
      setPaymentAmount(Math.min(numericValue, amountDue));
    } else {
      setPaymentAmount(0);
    }
  };
  const handlePartialAmountBlur = () => {
    const numericValue = parseFloat(paymentAmountInput);
    if (isNaN(numericValue)) {
      setPaymentAmount(amountDue);
      setPaymentAmountInput(amountDue.toFixed(2));
      return;
    }
    const clamped = Math.min(Math.max(numericValue, 0.01), amountDue);
    setPaymentAmount(clamped);
    setPaymentAmountInput(clamped.toFixed(2));
  };
  const handlePaymentSuccess = (processedAmount: number, returnTo?: string | null) => {
    setLastPaymentAmount(processedAmount);
    setResolvedReturnTo(sanitizeRelativeReturnTo(returnTo ?? null));
    setAutoReturnCancelled(false);
    setPaymentSuccess(true);
    void fetchShootDetails();
  };
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      destroyEmbeddedCheckout();
    };
  }, [destroyEmbeddedCheckout]);
  const handleStripeCheckout = async () => {
    if (!token) return;
    setStripeLoading(true);
    setStripeError(null);
    try {
      if (!STRIPE_PUBLISHABLE_KEY) {
        throw new Error('Stripe is not configured for this site.');
      }
      const response = await axios.post(
        `${API_BASE_URL}/api/public/payments/${token}/checkout`,
        { amount: effectivePaymentAmount },
      );
      if (!response.data?.clientSecret || !response.data?.sessionId) {
        throw new Error('Stripe did not return a complete checkout session.');
      }
      checkoutSessionIdRef.current = response.data.sessionId || null;
      setShowEmbeddedCheckout(true);
      setEmbeddedCheckoutLoading(true);
      // Start polling for payment success
      startPaymentPolling(response.data.sessionId || null);
      // Mount embedded checkout
      requestAnimationFrame(async () => {
        try {
          const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
          if (!stripe) throw new Error('Failed to load Stripe');
          const checkout = await stripe.initEmbeddedCheckout({
            clientSecret: response.data.clientSecret,
          });
          embeddedCheckoutRef.current = checkout;
          const waitForMount = () => {
            if (checkoutMountRef.current) {
              checkout.mount(checkoutMountRef.current);
              setEmbeddedCheckoutLoading(false);
              setStripeLoading(false);
            } else {
              requestAnimationFrame(waitForMount);
            }
          };
          waitForMount();
        } catch (mountError: unknown) {
          console.error('Stripe embedded checkout mount error:', mountError);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          destroyEmbeddedCheckout();
          checkoutSessionIdRef.current = null;
          setShowEmbeddedCheckout(false);
          setEmbeddedCheckoutLoading(false);
          setStripeLoading(false);
          setStripeError('Stripe checkout could not be loaded. Please try again.');
        }
      });
    } catch (error: unknown) {
      setStripeError(getPaymentErrorMessage(error, 'Failed to create checkout session.'));
      setStripeLoading(false);
    }
  };
  const startPaymentPolling = (sessionId?: string | null) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const activeSessionId = sessionId ?? checkoutSessionIdRef.current;
        const confirmation = activeSessionId
          ? await confirmStripeSession(activeSessionId)
          : null;
        const paymentRecorded = isStripeSessionPaymentRecorded(confirmation, activeSessionId);
        if (paymentRecorded) {
          const confirmedAmount = Number(confirmation?.last_payment_amount ?? effectivePaymentAmount);
          const confirmedReturnTo = sanitizeRelativeReturnTo(confirmation?.return_to ?? null);
          setLastPaymentAmount(Number.isFinite(confirmedAmount) ? confirmedAmount : effectivePaymentAmount);
          setResolvedReturnTo(confirmedReturnTo);
          if (confirmation?.shoot) {
            setShoot(confirmation.shoot);
          } else if (confirmation?.receipt) {
            setShoot((current) => current ? { ...current, receipt: confirmation.receipt ?? null } : current);
          }
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          destroyEmbeddedCheckout();
          setShowEmbeddedCheckout(false);
          setStripeLoading(false);
          checkoutSessionIdRef.current = null;
          handlePaymentSuccess(
            Number(confirmation?.last_payment_amount ?? effectivePaymentAmount),
            confirmation?.return_to ?? null,
          );

          return;
        }

        if (isStripeSessionRefundedAsStale(confirmation, activeSessionId)) {
          if (confirmation?.shoot) {
            setShoot(confirmation.shoot);
          }
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          destroyEmbeddedCheckout();
          setShowEmbeddedCheckout(false);
          setStripeLoading(false);
          checkoutSessionIdRef.current = null;
          setStripeError(getStripeConfirmationFailureMessage(
            confirmation,
            activeSessionId,
            'The Stripe charge was refunded because the invoice balance changed.',
          ));

          return;
        }

        const statusRes = await axios.get(`${API_BASE_URL}/api/public/payments/${token}`);
        const shootData = statusRes.data?.data || statusRes.data;
        setShoot(shootData);
      } catch {
        // Ignore polling errors
      }
    }, 3000);
  };

  const handleCancelCheckout = () => {
    setShowEmbeddedCheckout(false);
    setStripeLoading(false);
    destroyEmbeddedCheckout();
    // Keep polling for 10s in case webhook is processing
    setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }, 10000);
  };

  const handleStayHere = useCallback(() => {
    setAutoReturnCancelled(true);
    setCountdownSeconds(null);
  }, []);

  const handlePrintReceipt = useCallback(() => {
    setAutoReturnCancelled(true);
    setCountdownSeconds(null);
    window.print();
  }, []);

  const handlePayRemainingBalance = useCallback(() => {
    setPaymentSuccess(false);
    setAutoReturnCancelled(false);
    setCountdownSeconds(null);
  }, []);

  const isPopup = typeof window !== 'undefined' && !!window.opener;
  const canGoBack = canUseSafeHistoryFallback();
  const canReturn = Boolean(resolvedReturnTo) || canGoBack;
  const autoActionSeconds = isPopup ? POPUP_CLOSE_DELAY_SECONDS : AUTO_RETURN_DELAY_SECONDS;

  const handleReturn = useCallback(() => {
    if (resolvedReturnTo) {
      navigate(resolvedReturnTo);
      return;
    }

    if (canUseSafeHistoryFallback()) {
      window.history.back();
    }
  }, [navigate, resolvedReturnTo]);

  useEffect(() => {
    if (!paymentSuccess) {
      setCountdownSeconds(null);
      return;
    }

    if (autoReturnCancelled) {
      setCountdownSeconds(null);
      return;
    }

    if (!isPopup && !canReturn) {
      setCountdownSeconds(null);
      return;
    }

    setCountdownSeconds(autoActionSeconds);

    const countdownInterval = window.setInterval(() => {
      setCountdownSeconds((current) => {
        if (current === null) {
          return null;
        }

        return current > 1 ? current - 1 : 1;
      });
    }, 1000);

    const actionTimer = window.setTimeout(() => {
      if (isPopup) {
        try {
          window.close();
        } catch (closeError) {
          console.warn('Unable to auto-close payment popup:', closeError);
        }

        return;
      }

      handleReturn();
    }, autoActionSeconds * 1000);

    return () => {
      window.clearInterval(countdownInterval);
      window.clearTimeout(actionTimer);
    };
  }, [autoActionSeconds, autoReturnCancelled, canReturn, handleReturn, isPopup, paymentSuccess]);

  if (loading || confirmingPayment) {
    return <PaymentLoadingState confirmingPayment={confirmingPayment} />;
  }

  if (paymentSuccess) {
    return (
      <PaymentSuccessReceipt
        shoot={shoot}
        fullAddress={fullAddress}
        scheduledAtLabel={scheduledAtLabel}
        amountDue={amountDue}
        lastPaymentAmount={lastPaymentAmount}
        fallbackPaymentAmount={effectivePaymentAmount}
        subtotalAmount={subtotalAmount}
        invoiceAdjustmentsTotal={invoiceAdjustmentsTotal}
        autoReturnCancelled={autoReturnCancelled}
        isPopup={isPopup}
        countdownSeconds={countdownSeconds}
        autoActionSeconds={autoActionSeconds}
        canReturn={canReturn}
        onPrintReceipt={handlePrintReceipt}
        onReturn={handleReturn}
        onStayHere={handleStayHere}
        onPayRemainingBalance={handlePayRemainingBalance}
      />
    );
  }

  if (error) {
    return <PaymentErrorState message={error} />;
  }

  if (amountDue <= 0) {
    return <PaymentAlreadyPaidState />;
  }

  return (
    <div className={`h-screen w-full overflow-x-hidden bg-[#060a0e] text-white ${showEmbeddedCheckout ? 'overflow-y-auto xl:overflow-hidden' : 'overflow-y-auto'}`}>
      <div className={`mx-auto w-full px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10 ${pageMaxWidthClass} transition-all duration-300`}>
        <div className="mb-6 flex flex-col gap-3 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
          <Logo variant="light" className="h-8 w-auto" />
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <span>Secure payment powered by</span>
            <svg className="h-5 w-auto" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Stripe">
              <path fillRule="evenodd" clipRule="evenodd" d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.6-5.65 7.6zM40 8.95c-.95 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.57h4.13v14.44h-4.13V5.57zm0-4.7L32.37 0v3.36l-4.13.88V.88zm-4.32 9.35v9.79H19.8V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.43-3.32.86zm-8.55 4.72c0 2.43 2.6 1.68 3.12 1.46v3.36c-.55.3-1.54.54-2.89.54a4.15 4.15 0 0 1-4.27-4.24l.01-13.17 4.02-.86v3.54h3.14V9.4h-3.13v5.54zm-4.91.7c0 2.83-2.31 4.41-5.7 4.41a11.71 11.71 0 0 1-4.46-.93v-3.93c1.38.75 3.1 1.31 4.46 1.31.92 0 1.53-.24 1.53-1C6.4 13.62 0 14.5 0 9.84 0 7.04 2.17 5.4 5.5 5.4c1.32 0 2.63.2 3.95.73v3.88a9.24 9.24 0 0 0-3.96-1.03c-.79 0-1.28.18-1.28.85 0 1.31 6.4.31 6.4 5.81z" fill="#635BFF"/>
            </svg>
          </div>
        </div>

        <Card className="overflow-hidden border border-gray-800/90 bg-[#0a0f1a]/95 shadow-[0_28px_70px_rgba(0,0,0,0.35)]">
          <CardContent className="p-0">
            <div className={`grid ${paymentLayoutClass} transition-all duration-300`}>
              <div className={`order-2 space-y-6 border-t border-gray-800 bg-[#0b111d] p-5 sm:p-6 xl:order-1 xl:border-r xl:border-t-0 xl:p-8 ${showEmbeddedCheckout ? 'hidden xl:block' : ''}`}>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Shoot Details</p>
                  <h1 className="text-2xl font-semibold text-white">Review & pay</h1>
                  <p className="max-w-sm text-sm text-gray-400">Confirm the shoot summary, then continue to the secure payment section.</p>
                </div>

                <div className="space-y-4">
                  {fullAddress && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-blue-400 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Location</p>
                        <p className="break-words text-white">{fullAddress}</p>
                      </div>
                    </div>
                  )}

                  {scheduledAtLabel && (
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-blue-400 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Scheduled</p>
                        <p className="break-words text-white">{scheduledAtLabel}</p>
                      </div>
                    </div>
                  )}

                  {shoot?.services && shoot.services.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Camera className="h-5 w-5 text-blue-400 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Services</p>
                        <ul className="space-y-2 text-white">
                          {shoot.services.map((service, idx) => (
                            <li key={idx} className="break-words">{service.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-800 bg-[#10192a] p-4 sm:p-5 space-y-3">
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Subtotal</span>
                    <span>${(shoot?.service_subtotal ?? ((shoot?.base_quote || 0) + (shoot?.discount_amount || 0))).toFixed(2)}</span>
                  </div>
                  {(shoot?.discount_amount || 0) > 0 && (
                    <div className="flex justify-between text-sm text-emerald-400">
                      <span>Discount</span>
                      <span>-${(shoot?.discount_amount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {invoiceAdjustmentsTotal > 0.005 && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Invoice adjustments</span>
                      <span>${invoiceAdjustmentsTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {(shoot?.tax_amount || 0) > 0 && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Tax</span>
                      <span>${(shoot?.tax_amount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Total</span>
                    <span>${(shoot?.total_quote || 0).toFixed(2)}</span>
                  </div>
                  {totalPaid > 0 && (
                    <div className="flex justify-between text-sm text-emerald-400">
                      <span>Paid</span>
                      <span>-${totalPaid.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold text-white border-t border-gray-700 pt-3">
                    <span>Amount Due</span>
                    <span>${amountDue.toFixed(2)}</span>
                  </div>
                </div>

              </div>

              <div className="order-1 min-w-0 space-y-6 p-5 sm:p-6 xl:order-2 xl:p-8">
                {!showEmbeddedCheckout ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Payment Details</p>
                      <h2 className="text-xl font-semibold text-white sm:text-2xl">Pay securely with Stripe</h2>
                      <p className="max-w-2xl text-sm text-gray-400">Choose full or partial payment, then continue to the secure Stripe checkout.</p>
                    </div>

                    <div className="space-y-4 sm:space-y-5">
                      <div className="rounded-2xl border border-gray-800 bg-[#0f1524] p-4 sm:p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Payment Amount</span>
                          <span className="text-2xl font-bold text-white sm:text-3xl">${effectivePaymentAmount.toFixed(2)}</span>
                        </div>
                        {isPartialOpen && effectivePaymentAmount < amountDue && (
                          <p className="text-xs text-gray-500">
                            Remaining after payment: ${remainingAfterPartial.toFixed(2)}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        className="w-full text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        onClick={handleTogglePartial}
                      >
                        {isPartialOpen ? 'Pay full amount' : 'Pay a partial amount instead'}
                      </button>

                      {isPartialOpen && (
                        <div className="rounded-2xl border border-dashed border-blue-500/40 bg-[#0f1524] p-4 sm:p-5">
                          <p className="text-xs uppercase tracking-wide text-gray-500">Partial payment</p>
                          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-semibold text-white">$</span>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={paymentAmountInput}
                                onChange={(e) => handlePartialAmountChange(e.target.value)}
                                onBlur={handlePartialAmountBlur}
                                className="h-12 w-full min-w-0 sm:w-48 bg-[#0a0f1a] border-gray-700 text-white text-xl font-semibold"
                              />
                            </div>
                            <div className="rounded-xl border border-gray-700 bg-[#0a0f1a] px-3 py-2 text-xs text-gray-400 sm:ml-auto">
                              Max available: ${amountDue.toFixed(2)}
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">Pay any amount up to ${amountDue.toFixed(2)}.</p>
                          {paymentAmount > 0 && paymentAmount < amountDue && (
                            <p className="mt-2 text-xs text-gray-400">
                              Remaining after payment: ${remainingAfterPartial.toFixed(2)}
                            </p>
                          )}
                        </div>
                      )}

                      {stripeError && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                          <p className="text-sm text-red-400">{stripeError}</p>
                        </div>
                      )}

                      <Button
                        onClick={handleStripeCheckout}
                        disabled={stripeLoading || effectivePaymentAmount <= 0}
                        className="h-12 w-full rounded-xl bg-[#635BFF] text-base font-semibold text-white transition-colors hover:bg-[#5851DB] sm:h-13"
                      >
                        {stripeLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Loading checkout...
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-5 w-5" />
                            Pay ${effectivePaymentAmount.toFixed(2)}
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Checkout</p>
                        <h2 className="text-xl font-semibold text-white sm:text-2xl">Complete Payment</h2>
                        <p className="max-w-2xl text-sm text-gray-400">Finish the payment securely below. On mobile, the shoot summary stays above this form; on larger screens it stays on the left.</p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-gray-700 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-gray-500 hover:text-white sm:w-auto sm:self-start"
                        onClick={handleCancelCheckout}
                      >
                        <XCircle className="h-4 w-4" /> Cancel
                      </button>
                    </div>

                    <div className="xl:hidden rounded-2xl border border-gray-800 bg-[#0f1524] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Shoot Summary</p>
                          {fullAddress && (
                            <p className="break-words text-sm font-medium text-white">{fullAddress}</p>
                          )}
                          {scheduledAtLabel && (
                            <p className="text-xs text-gray-400">{scheduledAtLabel}</p>
                          )}
                        </div>
                        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 sm:min-w-[180px]">
                          <p className="text-[11px] uppercase tracking-[0.28em] text-blue-200/80">Amount due</p>
                          <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(effectivePaymentAmount)}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-gray-300 sm:grid-cols-2">
                        <div className="flex items-center justify-between rounded-xl border border-gray-800/90 bg-[#0b111d] px-3 py-2">
                          <span className="text-gray-500">Subtotal</span>
                          <span>{formatCurrency(subtotalAmount)}</span>
                        </div>
                        {(shoot?.discount_amount || 0) > 0 && (
                          <div className="flex items-center justify-between rounded-xl border border-gray-800/90 bg-[#0b111d] px-3 py-2">
                            <span className="text-gray-500">Discount</span>
                            <span className="text-emerald-400">-{formatCurrency(shoot?.discount_amount || 0)}</span>
                          </div>
                        )}
                        {invoiceAdjustmentsTotal > 0.005 && (
                          <div className="flex items-center justify-between rounded-xl border border-gray-800/90 bg-[#0b111d] px-3 py-2">
                            <span className="text-gray-500">Invoice adjustments</span>
                            <span>{formatCurrency(invoiceAdjustmentsTotal)}</span>
                          </div>
                        )}
                        {(shoot?.tax_amount || 0) > 0 && (
                          <div className="flex items-center justify-between rounded-xl border border-gray-800/90 bg-[#0b111d] px-3 py-2">
                            <span className="text-gray-500">Tax</span>
                            <span>{formatCurrency(shoot?.tax_amount || 0)}</span>
                          </div>
                        )}
                        {totalPaid > 0 && (
                          <div className="flex items-center justify-between rounded-xl border border-gray-800/90 bg-[#0b111d] px-3 py-2">
                            <span className="text-gray-500">Paid</span>
                            <span className="text-emerald-400">-{formatCurrency(totalPaid)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between rounded-xl border border-gray-800/90 bg-[#0b111d] px-3 py-2">
                          <span className="text-gray-500">Total</span>
                          <span>{formatCurrency(shoot?.total_quote || 0)}</span>
                        </div>
                      </div>

                      {mobileServiceCount > 0 && (
                        <details className="mt-4 rounded-xl border border-gray-800/90 bg-[#0b111d] px-3 py-3">
                          <summary className="cursor-pointer text-sm font-medium text-white">
                            Services ({mobileServiceCount})
                          </summary>
                          <ul className="mt-3 space-y-2 text-sm text-gray-300">
                            {shoot?.services?.map((service, idx) => (
                              <li key={idx} className="break-words">
                                {service.name}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>

                    <div className="rounded-2xl border border-gray-800 bg-[#0b111d] p-1.5 sm:p-3 lg:p-4">
                      <div className="mx-auto min-w-0 w-full rounded-[18px] border border-gray-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:rounded-[22px] xl:max-h-[calc(100vh-14rem)] xl:overflow-y-auto">
                        {embeddedCheckoutLoading && (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                          </div>
                        )}
                        <div
                          ref={checkoutMountRef}
                          className="w-full min-w-0"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
