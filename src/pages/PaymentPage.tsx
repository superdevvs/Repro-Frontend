import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, MapPin, Calendar, Camera, CreditCard, Lock, XCircle } from 'lucide-react';
import { HorizontalLoader } from '@/components/ui/horizontal-loader';
import axios from 'axios';
import { API_BASE_URL, STRIPE_PUBLISHABLE_KEY } from '@/config/env';
import { loadStripe } from '@stripe/stripe-js';

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
}

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialSessionId = searchParams.get('session_id');
  const [shoot, setShoot] = useState<ShootDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(searchParams.get('success') === 'true');
  const [isPartialOpen, setIsPartialOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentAmountInput, setPaymentAmountInput] = useState('0.00');
  const [lastPaymentAmount, setLastPaymentAmount] = useState<number | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [embeddedCheckoutLoading, setEmbeddedCheckoutLoading] = useState(false);
  const embeddedCheckoutRef = useRef<any>(null);
  const checkoutMountRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkoutSessionIdRef = useRef<string | null>(initialSessionId);

  const fetchShootDetails = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/shoots/${id}/payment-details`);
      setShoot(response.data.data || response.data);
    } catch (err: any) {
      console.error('Failed to fetch shoot details:', err);
      setError(err.response?.data?.message || 'Failed to load shoot details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const confirmStripeSession = useCallback(async (sessionId: string) => {
    if (!id || !sessionId) return;

    try {
      await axios.post(`${API_BASE_URL}/api/shoots/${id}/confirm-stripe-session`, {
        session_id: sessionId,
      });
    } catch {
      // Ignore confirmation errors and let polling/webhooks continue
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchShootDetails();
    }
  }, [id, fetchShootDetails]);

  useEffect(() => {
    if (searchParams.get('success') === 'true' && initialSessionId) {
      void confirmStripeSession(initialSessionId).then(() => fetchShootDetails());
    }
  }, [confirmStripeSession, fetchShootDetails, initialSessionId, searchParams]);

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

  const handlePaymentSuccess = () => {
    setLastPaymentAmount(effectivePaymentAmount);
    setPaymentSuccess(true);
    void fetchShootDetails();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (embeddedCheckoutRef.current) {
        try { embeddedCheckoutRef.current.destroy(); } catch {}
      }
    };
  }, []);

  const handleStripeCheckout = async () => {
    if (!id) return;
    setStripeLoading(true);
    setStripeError(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/shoots/${id}/create-stripe-embedded-checkout`,
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
        if (activeSessionId) {
          await confirmStripeSession(activeSessionId);
        }

        const statusRes = await axios.get(`${API_BASE_URL}/api/shoots/${id}/payment-details`);
        const shootData = statusRes.data?.data || statusRes.data;
        const paidSoFar = shootData?.payments
          ?.filter((p: any) => p.status === 'completed')
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
        const currentDue = (shootData?.total_quote || 0) - paidSoFar;

        if (currentDue < amountDue) {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          if (embeddedCheckoutRef.current) {
            try { embeddedCheckoutRef.current.destroy(); } catch {}
            embeddedCheckoutRef.current = null;
          }
          setShowEmbeddedCheckout(false);
          setStripeLoading(false);
          checkoutSessionIdRef.current = null;
          handlePaymentSuccess();
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);
  };

  const handleCancelCheckout = () => {
    setShowEmbeddedCheckout(false);
    setStripeLoading(false);
    if (embeddedCheckoutRef.current) {
      try { embeddedCheckoutRef.current.destroy(); } catch {}
      embeddedCheckoutRef.current = null;
    }
    // Keep polling for 10s in case webhook is processing
    setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }, 10000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060a0e] flex items-center justify-center">
        <div className="w-full max-w-md">
          <HorizontalLoader message="Loading payment details..." />
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
    const isPopup = !!window.opener;

    // Auto-close popup after 3 seconds
    if (isPopup) {
      setTimeout(() => {
        try { window.close(); } catch {}
      }, 3000);
    }

    return (
      <div className="min-h-screen bg-[#060a0e] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#0a0f1a] border-green-500/30">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-2">Payment Successful!</h2>
            <p className="text-gray-400 mb-4">
              Your payment of ${(lastPaymentAmount ?? effectivePaymentAmount).toFixed(2)} has been processed successfully.
            </p>
            <p className="text-sm text-gray-500">
              You will receive a confirmation email shortly.
            </p>
            {isPopup && (
              <p className="text-xs text-gray-600 mt-4">
                This window will close automatically...
              </p>
            )}
          </CardContent>
        </Card>
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
    <div className="min-h-screen bg-[#060a0e] text-white overflow-y-auto">
      <div className={`mx-auto w-full px-4 py-6 sm:py-10 ${showEmbeddedCheckout ? 'max-w-6xl' : 'max-w-5xl'} transition-all duration-300`}>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo variant="light" className="h-8 w-auto" />
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Secure payment powered by</span>
            <svg className="h-5" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 10.2c0-.7.6-1 1.5-1 1.4 0 3 .4 4.4 1.2V6.3c-1.5-.6-3-.8-4.4-.8C3.3 5.5.8 7.4.8 10.4c0 4.7 6.4 3.9 6.4 5.9 0 .8-.7 1.1-1.7 1.1-1.5 0-3.4-.6-4.9-1.4v4.2c1.7.7 3.3 1 4.9 1 3.3 0 5.6-1.6 5.6-4.7C11.1 11.6 5 12.5 5 10.2z" fill="#635BFF"/>
              <path d="M19.5 3.5l-4 .9V8h-1.7v3.7h1.7v4.7c0 3.2 1.5 4.3 4 4.3 1.2 0 2-.3 2-.3v-3.6s-.7.3-1.3.3c-.7 0-1.2-.3-1.2-1.2v-4.2h2.5V8h-2.5V3.5h.5z" fill="#635BFF"/>
              <path d="M27.2 5.5c-1.4 0-2.3.7-2.8 1.1l-.2-.9h-3.7v14.9l4.2-.9V17c.5.4 1.3.9 2.5.9 2.5 0 4.8-2 4.8-6.5-.1-4.1-2.4-5.9-4.8-5.9zm-.8 9.3c-.8 0-1.3-.3-1.7-.7v-5.3c.4-.4.9-.7 1.7-.7 1.3 0 2.2 1.4 2.2 3.4 0 2-.9 3.3-2.2 3.3z" fill="#635BFF"/>
              <path d="M35.7 5.5c-2.8 0-4.5 2.7-4.5 6.4 0 4.2 2 6.3 5.4 6.3 1.6 0 2.8-.4 3.7-.9v-3.3c-.9.5-1.9.7-3.2.7-1.3 0-2.4-.5-2.5-2h6.1c0-.2 0-.9 0-.9.1-3.9-1.8-6.3-5-6.3zm-1.2 5.2c0-1.5.9-2.1 1.7-2.1.8 0 1.6.6 1.6 2.1h-3.3z" fill="#635BFF"/>
            </svg>
          </div>
        </div>

        <Card className="bg-[#0a0f1a] border-gray-800 shadow-xl">
          <CardContent className="p-0">
            <div className={`grid gap-6 md:gap-8 ${showEmbeddedCheckout ? 'md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.5fr)]' : 'md:grid-cols-[1fr_auto_1fr]'} transition-all duration-300`}>
              <div className="p-6 md:p-8 space-y-6">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Shoot Details</p>
                  <h1 className="text-2xl font-semibold text-white">Review & pay</h1>
                  <p className="text-sm text-gray-400">Confirm shoot details and settle the balance.</p>
                </div>

                <div className="space-y-4">
                  {fullAddress && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Location</p>
                        <p className="text-white">{fullAddress}</p>
                      </div>
                    </div>
                  )}

                  {shoot?.scheduled_date && (
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Scheduled</p>
                        <p className="text-white">
                          {new Date(shoot.scheduled_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                          {shoot.time && ` at ${shoot.time}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {shoot?.services && shoot.services.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Camera className="h-5 w-5 text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Services</p>
                        <ul className="text-white space-y-1">
                          {shoot.services.map((service, idx) => (
                            <li key={idx}>{service.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-800 bg-[#0f1524] p-4 space-y-3">
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

              <div className="hidden md:block w-px bg-gray-800" />

              <div className="p-6 md:p-8 space-y-6">
                {!showEmbeddedCheckout ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Payment Details</p>
                      <h2 className="text-xl font-semibold text-white">Pay securely with Stripe</h2>
                      <p className="text-sm text-gray-400">Complete your payment securely below.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl border border-gray-800 bg-[#0f1524] p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Payment Amount</span>
                          <span className="text-2xl font-bold text-white">${effectivePaymentAmount.toFixed(2)}</span>
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
                        <div className="rounded-xl border border-dashed border-blue-500/40 bg-[#0f1524] p-4">
                          <p className="text-xs uppercase tracking-wide text-gray-500">Partial payment</p>
                          <div className="mt-3 flex items-center gap-3">
                            <span className="text-2xl font-semibold text-white">$</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={paymentAmountInput}
                              onChange={(e) => handlePartialAmountChange(e.target.value)}
                              onBlur={handlePartialAmountBlur}
                              className="h-12 w-40 bg-[#0a0f1a] border-gray-700 text-white text-xl font-semibold"
                            />
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
                        className="w-full h-12 bg-[#635BFF] hover:bg-[#5851DB] text-white font-semibold text-base rounded-lg transition-colors"
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

                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <Lock className="h-3 w-3" />
                        <span className="text-xs">256-bit SSL encrypted</span>
                        <span className="text-xs">·</span>
                        <span className="text-xs">Powered by</span>
                        <svg className="h-3" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 10.2c0-.7.6-1 1.5-1 1.4 0 3 .4 4.4 1.2V6.3c-1.5-.6-3-.8-4.4-.8C3.3 5.5.8 7.4.8 10.4c0 4.7 6.4 3.9 6.4 5.9 0 .8-.7 1.1-1.7 1.1-1.5 0-3.4-.6-4.9-1.4v4.2c1.7.7 3.3 1 4.9 1 3.3 0 5.6-1.6 5.6-4.7C11.1 11.6 5 12.5 5 10.2z" fill="#635BFF"/>
                          <path d="M19.5 3.5l-4 .9V8h-1.7v3.7h1.7v4.7c0 3.2 1.5 4.3 4 4.3 1.2 0 2-.3 2-.3v-3.6s-.7.3-1.3.3c-.7 0-1.2-.3-1.2-1.2v-4.2h2.5V8h-2.5V3.5h.5z" fill="#635BFF"/>
                          <path d="M27.2 5.5c-1.4 0-2.3.7-2.8 1.1l-.2-.9h-3.7v14.9l4.2-.9V17c.5.4 1.3.9 2.5.9 2.5 0 4.8-2 4.8-6.5-.1-4.1-2.4-5.9-4.8-5.9zm-.8 9.3c-.8 0-1.3-.3-1.7-.7v-5.3c.4-.4.9-.7 1.7-.7 1.3 0 2.2 1.4 2.2 3.4 0 2-.9 3.3-2.2 3.3z" fill="#635BFF"/>
                          <path d="M35.7 5.5c-2.8 0-4.5 2.7-4.5 6.4 0 4.2 2 6.3 5.4 6.3 1.6 0 2.8-.4 3.7-.9v-3.3c-.9.5-1.9.7-3.2.7-1.3 0-2.4-.5-2.5-2h6.1c0-.2 0-.9 0-.9.1-3.9-1.8-6.3-5-6.3zm-1.2 5.2c0-1.5.9-2.1 1.7-2.1.8 0 1.6.6 1.6 2.1h-3.3z" fill="#635BFF"/>
                        </svg>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Checkout</p>
                        <h2 className="text-xl font-semibold text-white">Complete Payment</h2>
                      </div>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                        onClick={handleCancelCheckout}
                      >
                        <XCircle className="h-4 w-4" /> Cancel
                      </button>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-white overflow-hidden min-h-[400px]">
                      {embeddedCheckoutLoading && (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                      )}
                      <div ref={checkoutMountRef} className="w-full" />
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
