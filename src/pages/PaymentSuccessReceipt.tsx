import { ArrowLeft, ArrowRight, Calendar, Camera, CheckCircle, MapPin, Printer } from 'lucide-react';

import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import {
  formatPaymentCurrency as formatCurrency,
  formatPaymentPaidAt as formatPaidAt,
  type ShootDetails,
} from './paymentPageModel';

type PaymentSuccessReceiptProps = {
  shoot: ShootDetails | null;
  fullAddress: string;
  scheduledAtLabel: string;
  amountDue: number;
  lastPaymentAmount: number | null;
  fallbackPaymentAmount: number;
  subtotalAmount: number;
  invoiceAdjustmentsTotal: number;
  autoReturnCancelled: boolean;
  isPopup: boolean;
  countdownSeconds: number | null;
  autoActionSeconds: number;
  canReturn: boolean;
  onPrintReceipt: () => void;
  onReturn: () => void;
  onStayHere: () => void;
  onPayRemainingBalance: () => void;
};

export function PaymentSuccessReceipt({
  shoot,
  fullAddress,
  scheduledAtLabel,
  amountDue,
  lastPaymentAmount,
  fallbackPaymentAmount,
  subtotalAmount,
  invoiceAdjustmentsTotal,
  autoReturnCancelled,
  isPopup,
  countdownSeconds,
  autoActionSeconds,
  canReturn,
  onPrintReceipt,
  onReturn,
  onStayHere,
  onPayRemainingBalance,
}: PaymentSuccessReceiptProps) {
  const receipt = shoot?.receipt ?? null;
  const amountPaid = lastPaymentAmount ?? receipt?.amount ?? fallbackPaymentAmount;
  const receiptCurrency = receipt?.currency || 'USD';
  const hasRemainingBalance = amountDue > 0.009;
  const receiptStatusLabel =
    receipt?.status === 'refunded' || receipt?.refund_status === 'refunded'
      ? 'Refunded'
      : receipt?.refund_status === 'pending'
        ? 'Refund pending'
        : receipt?.status === 'completed'
          ? 'Paid'
          : 'Pending';
  const receiptStatusClass =
    receiptStatusLabel === 'Refunded'
      ? 'text-amber-300'
      : receiptStatusLabel === 'Refund pending'
        ? 'text-amber-200'
        : receiptStatusLabel === 'Paid'
          ? 'text-emerald-300'
          : 'text-slate-300';

  return (
    <div className="h-screen overflow-x-hidden overflow-y-auto bg-[#080913] text-white print:h-auto print:min-h-0 print:bg-white print:text-slate-950">
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
                        <p className={`mt-1 text-base font-semibold ${receiptStatusClass}`}>{receiptStatusLabel}</p>
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

                  {invoiceAdjustmentsTotal > 0.005 && (
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Invoice adjustments</span>
                      <span className="font-medium text-slate-900">{formatCurrency(invoiceAdjustmentsTotal, receiptCurrency)}</span>
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
                    onClick={onPrintReceipt}
                    className="h-11 rounded-full border border-slate-300 bg-white px-5 text-slate-900 hover:bg-slate-100"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print receipt
                  </Button>

                  {!isPopup && canReturn && (
                    <Button
                      type="button"
                      onClick={onReturn}
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
                      onClick={onStayHere}
                      className="h-11 rounded-full border border-slate-300 bg-[#efe4d5] px-5 text-slate-900 hover:bg-[#e8d9c6]"
                    >
                      Stay here
                    </Button>
                  )}

                  {hasRemainingBalance && (
                    <Button
                      type="button"
                      onClick={onPayRemainingBalance}
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
