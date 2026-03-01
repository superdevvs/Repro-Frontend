import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, MapPin, Calendar, Camera, CreditCard, Lock } from 'lucide-react';
import { HorizontalLoader } from '@/components/ui/horizontal-loader';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';

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
  tax_amount: number;
  services: Array<{ name: string; pivot?: { price: number; quantity: number } }>;
  client?: { name: string; email: string };
  payments?: Array<{ amount: number; status: string }>;
}

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
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

  useEffect(() => {
    const fetchShootDetails = async () => {
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
    };

    if (id) {
      fetchShootDetails();
    }
  }, [id]);

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
  };

  const handleStripeCheckout = async () => {
    if (!id) return;
    setStripeLoading(true);
    setStripeError(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/shoots/${id}/create-stripe-checkout`,
        { amount: effectivePaymentAmount },
      );

      if (response.data?.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to create checkout session.';
      setStripeError(message);
    } finally {
      setStripeLoading(false);
    }
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
    <div className="min-h-screen bg-[#060a0e] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo variant="light" className="h-8 w-auto" />
          <p className="text-sm text-gray-400">Secure payment powered by Stripe</p>
        </div>

        <Card className="bg-[#0a0f1a] border-gray-800 shadow-xl">
          <CardContent className="p-0">
            <div className="grid gap-8 md:grid-cols-[1fr_auto_1fr]">
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
                    <span>${(shoot?.base_quote || 0).toFixed(2)}</span>
                  </div>
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
              </div>

              <div className="hidden md:block w-px bg-gray-800" />

              <div className="p-6 md:p-8 space-y-6">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Payment Details</p>
                  <h2 className="text-xl font-semibold text-white">Pay securely with Stripe</h2>
                  <p className="text-sm text-gray-400">You'll be redirected to Stripe's secure checkout page.</p>
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
                        Redirecting to Stripe...
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
                    <p className="text-xs">256-bit SSL encrypted. Powered by Stripe.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
