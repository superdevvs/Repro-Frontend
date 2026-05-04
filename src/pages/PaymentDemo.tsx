import React, { useState } from 'react';
import { Logo } from '@/components/layout/Logo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Camera, CreditCard, Lock, XCircle, ArrowRight } from 'lucide-react';

// Demo-only route: renders the same PaymentPage layout with fake data so we can
// visually verify the "Complete Payment" Stripe embed area (width + scroll).
// Access via: /payment-demo?checkout=1  to jump straight into the embed view.
export default function PaymentDemo() {
  const params = new URLSearchParams(window.location.search);
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(
    params.get('checkout') === '1',
  );

  const shoot = {
    address: '6275 Kerrydale Drive',
    city: 'Springfield',
    state: 'VA',
    zip: '22152',
    scheduled_date: 'Friday, May 1, 2026',
    time: '11:30:00',
    services: [{ name: 'HDR Photos' }],
    subtotal: 199.0,
    tax: 10.55,
    total: 209.55,
  };

  const fullAddress = `${shoot.address}, ${shoot.city}, ${shoot.state}, ${shoot.zip}`;
  const pageMaxWidthClass = showEmbeddedCheckout ? 'max-w-[1480px]' : 'max-w-[1180px]';
  const paymentLayoutClass = showEmbeddedCheckout
    ? 'xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]'
    : 'xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]';

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
              {/* Left summary */}
              <div className={`order-2 space-y-6 border-t border-gray-800 bg-[#0b111d] p-5 sm:p-6 xl:order-1 xl:border-r xl:border-t-0 xl:p-8 ${showEmbeddedCheckout ? 'hidden xl:block' : ''}`}>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Shoot Details</p>
                  <h1 className="text-2xl font-semibold text-white">Review &amp; pay</h1>
                  <p className="max-w-sm text-sm text-gray-400">Confirm the shoot summary, then continue to the secure payment section.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Location</p>
                      <p className="break-words text-white">{fullAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Scheduled</p>
                      <p className="text-white">{shoot.scheduled_date} at {shoot.time}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Camera className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Services</p>
                      {shoot.services.map((s) => (
                        <p key={s.name} className="text-white">{s.name}</p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-800 bg-[#0f1524] p-4 text-sm">
                  <div className="flex justify-between py-1 text-gray-300"><span>Subtotal</span><span>${shoot.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between py-1 text-gray-300"><span>Tax</span><span>${shoot.tax.toFixed(2)}</span></div>
                  <div className="flex justify-between py-1 text-gray-300"><span>Total</span><span>${shoot.total.toFixed(2)}</span></div>
                  <div className="mt-2 flex justify-between border-t border-gray-800 pt-2 text-base font-semibold text-white">
                    <span>Amount Due</span><span>${shoot.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Right payment column */}
              <div className="order-1 min-w-0 space-y-6 p-5 sm:p-6 xl:order-2 xl:p-8">
                {!showEmbeddedCheckout ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Payment Details</p>
                      <h2 className="text-2xl font-semibold text-white">Pay securely with Stripe</h2>
                      <p className="text-sm text-gray-400">Choose full or partial payment, then continue to the secure Stripe checkout.</p>
                    </div>

                    <div className="rounded-2xl border border-gray-800 bg-[#0f1524] p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm uppercase tracking-wide text-gray-500">Payment Amount</p>
                        <p className="text-3xl font-semibold text-white">${shoot.total.toFixed(2)}</p>
                      </div>
                    </div>

                    <Button
                      onClick={() => setShowEmbeddedCheckout(true)}
                      className="h-12 w-full rounded-xl bg-[#635BFF] text-base font-semibold text-white transition-colors hover:bg-[#5851DB] sm:h-13"
                    >
                      <CreditCard className="mr-2 h-5 w-5" />
                      Pay ${shoot.total.toFixed(2)}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
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
                        onClick={() => setShowEmbeddedCheckout(false)}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-700 px-4 py-2 text-xs text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </div>

                    <div className="rounded-2xl border border-gray-800 bg-[#0b111d] p-1.5 sm:p-3 lg:p-4">
                      <div className="mx-auto min-w-0 w-full rounded-[18px] border border-gray-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:rounded-[22px] xl:max-h-[calc(100vh-14rem)] xl:overflow-y-auto">
                        {/* Mock Stripe iframe: a tall fake form so width + page scroll can be verified */}
                        <div className="w-full min-w-0 p-6 sm:p-8 text-slate-900">
                          <div className="mx-auto max-w-xl space-y-4">
                            <div className="text-center">
                              <p className="text-sm text-slate-500">{fullAddress}</p>
                              <p className="mt-2 text-3xl font-semibold">${shoot.total.toFixed(2)}</p>
                            </div>
                            <button className="flex w-full items-center justify-center rounded-md bg-emerald-500 py-3 font-semibold text-white">Pay with link</button>
                            <div className="flex items-center gap-3 text-xs text-slate-400"><div className="h-px flex-1 bg-slate-200" />OR<div className="h-px flex-1 bg-slate-200" /></div>
                            <div>
                              <label className="text-xs text-slate-500">Email</label>
                              <input className="mt-1 w-full rounded-md border border-slate-200 p-2.5" defaultValue="demo@example.com" />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Card information</label>
                              <input className="mt-1 w-full rounded-md border border-slate-200 p-2.5" placeholder="1234 1234 1234 1234" />
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <input className="rounded-md border border-slate-200 p-2.5" placeholder="MM / YY" />
                                <input className="rounded-md border border-slate-200 p-2.5" placeholder="CVC" />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Cardholder name</label>
                              <input className="mt-1 w-full rounded-md border border-slate-200 p-2.5" placeholder="Full name on card" />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Country or region</label>
                              <select className="mt-1 w-full rounded-md border border-slate-200 p-2.5">
                                <option>United States</option>
                              </select>
                              <input className="mt-2 w-full rounded-md border border-slate-200 p-2.5" placeholder="ZIP" />
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                              This is a demo of the embedded Stripe form layout. The real Stripe iframe will render here and auto-resize.
                            </div>
                            <button className="flex w-full items-center justify-center rounded-md bg-indigo-600 py-3 font-semibold text-white">Pay ${shoot.total.toFixed(2)}</button>
                            <p className="pt-4 text-center text-xs text-slate-400">Powered by Stripe · Terms · Privacy</p>
                          </div>
                        </div>
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
