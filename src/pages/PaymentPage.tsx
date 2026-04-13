import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, MapPin, Calendar, Camera, CreditCard, Lock, XCircle, ArrowLeft, Printer, ArrowRight } from 'lucide-react';
import { HorizontalLoader } from '@/components/ui/horizontal-loader';
import axios from 'axios';
import { API_BASE_URL, STRIPE_PUBLISHABLE_KEY } from '@/config/env';
import { loadStripe } from '@stripe/stripe-js';
import { canUseSafeHistoryFallback, sanitizeRelativeReturnTo } from '@/utils/paymentReturn';

type ReceiptDetails = {
  number: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  provider: string;
  status: string;
};

interface ShootDetails {
  id: number;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  scheduled_date?: string;
  time?: string;
  total_quote: number;
  base_quote: number;
  service_subtotal?: number;
  discount_type?: 'fixed' | 'percent' | 'percentage' | null;
  discount_value?: number | null;
  discount_amount?: number;
  discounted_subtotal?: number;
  tax_amount: number;
  services: Array<{ name: string; pivot?: { price: number; quantity: number } }>;
  client?: { name: string; email: string };
  payments?: Array<{ amount: number; status: string }>;
  amount_due?: number;
  receipt?: ReceiptDetails | null;
}

type PaymentConfirmationResult = {
  last_payment_amount?: number | string | null;
  return_to?: string | null;
  receipt?: ReceiptDetails | null;
};

const AUTO_RETURN_DELAY_SECONDS = 8;
const POPUP_CLOSE_DELAY_SECONDS = 5;

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatPaidAt(value?: string | null) {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatScheduledAt(dateValue?: string, timeValue?: string) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return timeValue ? `${dateValue} at ${timeValue}` : dateValue;
  }

  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return timeValue ? `${formattedDate} at ${timeValue}` : formattedDate;
}

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
  const embeddedCheckoutRef = useRef<any>(null);
  const checkoutMountRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkoutSessionIdRef = useRef<string | null>(initialSessionId);

  const fetchShootDetails = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/public/payments/${token}`);
      setShoot(response.data.data || response.data);
    } catch (err: any) {
      console.error('Failed to fetch shoot details:', err);
      setError(err.response?.data?.message || 'Failed to load shoot details. Please try again.');
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
    if (token) {
      fetchShootDetails();
    }
  }, [token, fetchShootDetails]);

  useEffect(() => {
    if (!isSuccessRedirect || !initialSessionId) {
      setConfirmingPayment(false);
      return;
    }

    let cancelled = false;

    const confirmPayment = async () => {
      setConfirmingPayment(true);
      const confirmation = await confirmStripeSession(initialSessionId);
      await fetchShootDetails();

      if (cancelled) {
        return;
      }

      const confirmedAmount = Number(confirmation?.last_payment_amount ?? Number.NaN);
      if (Number.isFinite(confirmedAmount) && confirmedAmount > 0) {
        setLastPaymentAmount(confirmedAmount);
      }

      if (confirmation?.receipt) {
        setShoot((current) => current ? { ...current, receipt: confirmation.receipt ?? null } : current);
      }

      setResolvedReturnTo(
        sanitizeRelativeReturnTo(confirmation?.return_to ?? initialReturnTo),
      );
      setAutoReturnCancelled(false);
      setPaymentSuccess(Boolean(confirmation));
      setConfirmingPayment(false);
    };

    void confirmPayment();

    return () => {
      cancelled = true;
    };
  }, [confirmStripeSession, fetchShootDetails, initialReturnTo, initialSessionId, isSuccessRedirect]);

  const totalPaid = shoot?.payments
    ?.filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  const amountDue = (shoot?.total_quote || 0) - totalPaid;

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
  const receipt = shoot?.receipt ?? null;
  const amountPaid = lastPaymentAmount ?? receipt?.amount ?? effectivePaymentAmount;
  const receiptCurrency = receipt?.currency || 'USD';
  const hasRemainingBalance = amountDue > 0.009;
  const receiptStatusLabel = receipt?.status === 'completed' ? 'Paid' : 'Pending';
  const subtotalAmount = shoot?.service_subtotal ?? ((shoot?.base_quote || 0) + (shoot?.discount_amount || 0));
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
      const response = await axios.post(
        `${API_BASE_URL}/api/public/payments/${token}/checkout`,
        { amount: effectivePaymentAmount },
      );

      if (!response.data?.clientSecret) {
        throw new Error('No client secret returned');
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
        } catch (mountErr: any) {
          console.error('Stripe embedded checkout mount error:', mountErr);
          setEmbeddedCheckoutLoading(false);
          setStripeLoading(false);
        }
      });
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to create checkout session.';
      setStripeError(message);
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
        if (activeSessionId) {
          const confirmedAmount = Number(confirmation?.last_payment_amount ?? effectivePaymentAmount);
          const confirmedReturnTo = sanitizeRelativeReturnTo(confirmation?.return_to ?? null);
          setLastPaymentAmount(Number.isFinite(confirmedAmount) ? confirmedAmount : effectivePaymentAmount);
          setResolvedReturnTo(confirmedReturnTo);
        }

        const statusRes = await axios.get(`${API_BASE_URL}/api/public/payments/${token}`);
        const shootData = statusRes.data?.data || statusRes.data;
        setShoot(shootData);
        const paidSoFar = shootData?.payments
          ?.filter((p: any) => p.status === 'completed')
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
        const currentDue = (shootData?.total_quote || 0) - paidSoFar;

          if (currentDue < amountDue) {
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
          }
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
    return (
      <div className="min-h-screen bg-[#060a0e] flex items-center justify-center">
        <div className="w-full max-w-md">
          <HorizontalLoader message={confirmingPayment ? "Confirming payment..." : "Loading payment details..."} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#060a0e] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#0a0f1a] border-red-500/30">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Unable to Load Payment</h2>
            <p className="text-gray-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen overflow-hidden bg-[#080913] text-white print:min-h-0 print:bg-white print:text-slate-950">
        <div className="pointer-events-none absolute inset-0 overflow-hidden print:hidden">
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#2f6fed]/18 blur-3xl" />
          <div className="absolute right-[-8rem] top-24 h-96 w-96 rounded-full bg-[#7c4dff]/10 blur-3xl" />
          <div className="absolute bottom-[-8rem] left-1/3 h-80 w-80 rounded-full bg-[#14b8a6]/10 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 print:max-w-none print:px-0 print:py-0">
          <div className="mb-6 flex items-center justify-between print:hidden">
            <Logo variant="light" className="h-8 w-auto" />
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-right backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Receipt status</p>
              <p className="mt-1 text-sm font-medium text-slate-100">
                {autoReturnCancelled
                  ? 'Auto-return paused'
                  : isPopup
                    ? `Closing in ${countdownSeconds ?? autoActionSeconds}s`
                    : canReturn
                      ? `Returning in ${countdownSeconds ?? autoActionSeconds}s`
                      : 'Ready to keep'}
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-x-5 top-4 h-full rounded-[32px] bg-white/12 blur-2xl print:hidden" />
            <div className="absolute inset-x-0 top-2 h-full rotate-[1.2deg] rounded-[32px] bg-[#f4eadd]/20 print:hidden" />

            <div className="relative overflow-hidden rounded-[30px] border border-white/40 bg-[linear-gradient(180deg,#fcfaf6_0%,#f7f1e7_42%,#fffdf8_100%)] text-slate-900 shadow-[0_30px_90px_rgba(0,0,0,0.45)] print:rounded-none print:border-0 print:shadow-none">
              <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 md:px-10 print:px-0">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.34em] text-slate-500">Receipt from</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">R/E Pro Photos</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle className="h-4 w-4" />
                  Payment received
                </div>
              </div>

              <div className="grid lg:grid-cols-[minmax(0,1.45fr)_360px]">
                <div className="p-6 md:p-10">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Success receipt
                  </div>

                  <div className="mt-6 max-w-3xl">
                    <p className="text-xs uppercase tracking-[0.34em] text-slate-500">Amount paid</p>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <h1 className="text-5xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl">
                        {formatCurrency(amountPaid, receiptCurrency)}
                      </h1>
                      <div className={`rounded-full px-3 py-1 text-sm font-medium ${hasRemainingBalance ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {hasRemainingBalance ? 'Partial payment applied' : 'Balance settled'}
                      </div>
                    </div>
                    <h2 className="mt-6 max-w-2xl font-serif text-3xl leading-tight tracking-[-0.03em] text-slate-900 sm:text-5xl">
                      {fullAddress || `Shoot #${shoot?.id ?? ''}`}
                    </h2>
                    <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                      Payment received successfully. Your receipt is ready, and the shoot will keep moving through production without interruption.
                    </p>
                  </div>

                  <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <section className="border-t border-black/10 pt-6">
                      <p className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Shoot summary</p>
                      <div className="mt-5 space-y-5">
                        <div className="flex items-start gap-4">
                          <div className="mt-0.5 rounded-full bg-slate-900 p-2 text-white">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Property</p>
                            <p className="mt-1 text-base font-medium text-slate-900">{fullAddress || 'Shoot address'}</p>
                          </div>
                        </div>

                        {scheduledAtLabel && (
                          <div className="flex items-start gap-4">
                            <div className="mt-0.5 rounded-full bg-slate-900 p-2 text-white">
                              <Calendar className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Scheduled for</p>
                              <p className="mt-1 text-base font-medium text-slate-900">{scheduledAtLabel}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-4">
                          <div className="mt-0.5 rounded-full bg-slate-900 p-2 text-white">
                            <Camera className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Services</p>
                            {shoot?.services?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {shoot.services.map((service, idx) => (
                                  <span
                                    key={`${service.name}-${idx}`}
                                    className="rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-sm text-slate-700"
                                  >
                                    {service.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1 text-base font-medium text-slate-900">Photography services</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[24px] bg-[#11141d] p-5 text-white sm:p-6">
                      <p className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Receipt details</p>
                      <div className="mt-5 grid gap-4">
                        {receipt?.number && (
                          <div className="border-b border-white/10 pb-3">
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Receipt number</p>
                            <p className="mt-1 text-base font-semibold text-white">{receipt.number}</p>
                          </div>
                        )}

                        <div className="border-b border-white/10 pb-3">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Paid at</p>
                          <p className="mt-1 text-base font-semibold text-white">{formatPaidAt(receipt?.paid_at)}</p>
                        </div>

                        <div className="border-b border-white/10 pb-3">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Payment method</p>
                          <p className="mt-1 text-base font-semibold text-white">Card via Stripe</p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Payment status</p>
                          <p className="mt-1 text-base font-semibold text-emerald-300">{receiptStatusLabel}</p>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                <aside className="border-t border-black/10 bg-[linear-gradient(180deg,#f6eee2_0%,#efe4d5_100%)] p-6 lg:border-l lg:border-t-0 lg:p-8">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Financial summary</p>
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-medium text-slate-900">{formatCurrency(subtotalAmount, receiptCurrency)}</span>
                    </div>

                    {(shoot?.discount_amount || 0) > 0 && (
                      <div className="flex items-center justify-between text-sm text-emerald-700">
                        <span>Discount</span>
                        <span className="font-medium">-{formatCurrency(shoot?.discount_amount || 0, receiptCurrency)}</span>
                      </div>
                    )}

                    {(shoot?.tax_amount || 0) > 0 && (
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>Tax</span>
                        <span className="font-medium text-slate-900">{formatCurrency(shoot?.tax_amount || 0, receiptCurrency)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-black/10 pt-4 text-sm text-slate-600">
                      <span>This payment</span>
                      <span className="font-semibold text-slate-950">{formatCurrency(amountPaid, receiptCurrency)}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-4">
                      <span className="text-sm font-medium text-slate-600">Remaining balance</span>
                      <span className={`text-xl font-semibold ${hasRemainingBalance ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {formatCurrency(amountDue, receiptCurrency)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8 rounded-[24px] border border-black/10 bg-white/70 p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Next step</p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {hasRemainingBalance
                        ? 'This payment has been applied to the shoot. You can stay on this receipt or continue with another payment for the remaining balance.'
                        : 'Your payment is fully recorded. Keep this receipt for your records and watch for the confirmation email.'}
                    </p>
                  </div>
                </aside>
              </div>

              <div className="border-t border-dashed border-black/10 px-6 py-5 md:px-10 print:hidden">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {autoReturnCancelled
                        ? 'Auto-return paused. You can stay on this receipt as long as you need.'
                        : isPopup
                          ? `This window will close in ${countdownSeconds ?? autoActionSeconds} seconds.`
                          : canReturn
                            ? `You’ll be returned automatically in ${countdownSeconds ?? autoActionSeconds} seconds.`
                            : 'Receipt ready. Print it, save it, or keep this page open.'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Use the actions on the right if you want to print, stay on the receipt, or continue paying the remaining balance.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={handlePrintReceipt}
                      className="h-11 rounded-full border border-slate-300 bg-white px-5 text-slate-900 hover:bg-slate-100"
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print receipt
                    </Button>

                    {!isPopup && canReturn && (
                      <Button
                        type="button"
                        onClick={handleReturn}
                        className="h-11 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Return
                      </Button>
                    )}

                    {isPopup && (
                      <Button
                        type="button"
                        onClick={() => window.close()}
                        className="h-11 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
                      >
                        Close now
                      </Button>
                    )}

                    {(isPopup || canReturn) && !autoReturnCancelled && (
                      <Button
                        type="button"
                        onClick={handleStayHere}
                        className="h-11 rounded-full border border-slate-300 bg-[#efe4d5] px-5 text-slate-900 hover:bg-[#e8d9c6]"
                      >
                        Stay here
                      </Button>
                    )}

                    {hasRemainingBalance && (
                      <Button
                        type="button"
                        onClick={handlePayRemainingBalance}
                        className="h-11 rounded-full bg-[#2f6fed] px-5 text-white hover:bg-[#275fd1]"
                      >
                        Pay remaining balance
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (amountDue <= 0) {
    return (
      <div className="min-h-screen bg-[#060a0e] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#0a0f1a] border-green-500/30">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-2">Already Paid</h2>
            <p className="text-gray-400">
              This shoot has already been paid in full. Thank you!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#060a0e] text-white">
      <div className={`mx-auto w-full px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10 ${pageMaxWidthClass} transition-all duration-300`}>
        <div className="mb-6 flex flex-col gap-3 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
          <Logo variant="light" className="h-8 w-auto" />
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <span>Secure payment powered by</span>
            <svg className="h-5" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 10.2c0-.7.6-1 1.5-1 1.4 0 3 .4 4.4 1.2V6.3c-1.5-.6-3-.8-4.4-.8C3.3 5.5.8 7.4.8 10.4c0 4.7 6.4 3.9 6.4 5.9 0 .8-.7 1.1-1.7 1.1-1.5 0-3.4-.6-4.9-1.4v4.2c1.7.7 3.3 1 4.9 1 3.3 0 5.6-1.6 5.6-4.7C11.1 11.6 5 12.5 5 10.2z" fill="#635BFF"/>
              <path d="M19.5 3.5l-4 .9V8h-1.7v3.7h1.7v4.7c0 3.2 1.5 4.3 4 4.3 1.2 0 2-.3 2-.3v-3.6s-.7.3-1.3.3c-.7 0-1.2-.3-1.2-1.2v-4.2h2.5V8h-2.5V3.5h.5z" fill="#635BFF"/>
              <path d="M27.2 5.5c-1.4 0-2.3.7-2.8 1.1l-.2-.9h-3.7v14.9l4.2-.9V17c.5.4 1.3.9 2.5.9 2.5 0 4.8-2 4.8-6.5-.1-4.1-2.4-5.9-4.8-5.9zm-.8 9.3c-.8 0-1.3-.3-1.7-.7v-5.3c.4-.4.9-.7 1.7-.7 1.3 0 2.2 1.4 2.2 3.4 0 2-.9 3.3-2.2 3.3z" fill="#635BFF"/>
              <path d="M35.7 5.5c-2.8 0-4.5 2.7-4.5 6.4 0 4.2 2 6.3 5.4 6.3 1.6 0 2.8-.4 3.7-.9v-3.3c-.9.5-1.9.7-3.2.7-1.3 0-2.4-.5-2.5-2h6.1c0-.2 0-.9 0-.9.1-3.9-1.8-6.3-5-6.3zm-1.2 5.2c0-1.5.9-2.1 1.7-2.1.8 0 1.6.6 1.6 2.1h-3.3z" fill="#635BFF"/>
            </svg>
          </div>
        </div>

        <Card className="overflow-hidden border border-gray-800/90 bg-[#0a0f1a]/95 shadow-[0_28px_70px_rgba(0,0,0,0.35)]">
          <CardContent className="p-0">
            <div className={`grid ${paymentLayoutClass} transition-all duration-300`}>
              <div className="order-2 space-y-6 border-t border-gray-800 bg-[#0b111d] p-5 sm:p-6 xl:order-1 xl:border-r xl:border-t-0 xl:p-8">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Shoot Details</p>
                  <h1 className="text-2xl font-semibold text-white">Review & pay</h1>
                  <p className="max-w-sm text-sm text-gray-400">Confirm the shoot summary, then complete your payment on the right.</p>
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

                      <div className="rounded-2xl border border-gray-800 bg-[#0f1524] p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Checkout readiness</p>
                            <p className="text-sm text-gray-300">Stripe will open inline below, optimized for card and wallet payments.</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <Lock className="h-3 w-3" />
                            <span>256-bit SSL encrypted</span>
                            <span className="hidden sm:inline">·</span>
                            <span>Powered by Stripe</span>
                          </div>
                        </div>
                      </div>

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
                        <p className="max-w-2xl text-sm text-gray-400">Finish the payment securely below. The shoot summary stays available on the left on larger screens.</p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 self-start rounded-full border border-gray-700 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
                        onClick={handleCancelCheckout}
                      >
                        <XCircle className="h-4 w-4" /> Cancel
                      </button>
                    </div>

                    <div className="rounded-2xl border border-gray-800 bg-[#0b111d] p-2 sm:p-3 lg:p-4">
                      <div className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[22px] border border-gray-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
                        {embeddedCheckoutLoading && (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                          </div>
                        )}
                        <div
                          ref={checkoutMountRef}
                          className="w-full min-h-[68svh] sm:min-h-[760px]"
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
