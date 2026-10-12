import { useBookingUnits } from '@/features/shoot-units/useMultiUnitBooking';
import { BookingUnitsSummary } from '@/features/shoot-units/BookingUnitControls';
import React from 'react';
import { DollarSign, MapPin, User, Check, Send } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth/AuthProvider';
import { getServiceScheduleLabel } from '@/utils/serviceScheduleLabel';
import type { PricingBreakdown } from '@/utils/pricing';
import { normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import { resolveServicePhotographerId, serviceRequiresPhotographer } from '@/utils/photographerAssignment';
import type { PropertyDetailsData } from '@/pages/bookShootModel';

interface BookingSummaryProps {
  summaryInfo: {
    client: string;
    clientRep?: string; // Sales/Rep name
    packageLabel?: string;
    services?: Array<{ id: string; name: string; description: string; price: number }>;
    packagePrice: number;
    pricing?: PricingBreakdown;
    address: string;
    bedrooms: number;
    bathrooms: number;
    sqft: number;
    date: string;
    time: string;
  };
  selectedServices: Array<{ id: string; name: string; description: string; price: number; quantity?: number; total_price?: number; photographer_required?: boolean | null }>;
  serviceSchedules?: Record<string, { date?: string; time?: string }>;
  onSubmit?: () => void;
  isLastStep?: boolean;
  canSubmit?: boolean;
  isSubmitting?: boolean;
  canAdjustAmount?: boolean;
  adjustedTotalInput?: string;
  setAdjustedTotalInput?: (value: string) => void;
  originalTotalQuote?: number;
  showRepName?: boolean; // Whether to show rep name (admin, superadmin, photographer only)
  weather?: {
    temperature?: number | null;
    condition?: string | null;
  };
  isMobile?: boolean;
  isComplimentaryReshoot?: boolean;
  propertyDetails?: PropertyDetailsData | null;
  notes?: string;
  photographer?: string;
  servicePhotographers?: Record<string, string>;
  photographers?: Array<{ id: string; name: string }>;
  footerContent?: React.ReactNode;
  onEdit?: (section: 'property' | 'services' | 'schedule') => void;
  submissionError?: string;
  timezoneLabel?: string;
}

export function BookingSummary({
  summaryInfo,
  selectedServices,
  serviceSchedules = {},
  onSubmit,
  isLastStep = false,
  canSubmit = true,
  isSubmitting = false,
  canAdjustAmount = false,
  adjustedTotalInput = '',
  setAdjustedTotalInput,
  originalTotalQuote,
  showRepName = false,
  isMobile = false,
  isComplimentaryReshoot = false,
  propertyDetails, notes, photographer, servicePhotographers, photographers = [], footerContent, onEdit, submissionError, timezoneLabel,
}: BookingSummaryProps) {
  const units = useBookingUnits();
  const { user } = useAuth();
  const hasSelectedServices = selectedServices.length > 0;
  const isAmountAdjusted = canAdjustAmount && adjustedTotalInput.trim() !== '';
  const amountPlaceholder = (originalTotalQuote ?? summaryInfo.pricing?.totalQuote ?? summaryInfo.packagePrice).toFixed(2);
  const serviceScheduleLabelFor = (serviceId: string) =>
    units?.enabled ? 'Unit visit times in breakdown' : getServiceScheduleLabel(serviceId, serviceSchedules, summaryInfo.date, summaryInfo.time);
  
  // Clients submit requests, admin/rep book directly
  const isClientRole = user?.role === 'client';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={
        // light by default, dark when `dark:` is present in page
        isMobile
          ? "bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 rounded-lg border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col"
          : "bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 rounded-lg border border-gray-200 dark:border-slate-800 shadow-sm sticky top-20 max-h-[calc(100vh-6rem)] overflow-hidden flex flex-col"
      }
    >
      <div className={isMobile ? "p-4 pr-3" : "flex-1 overflow-y-auto p-6 pr-4"}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Booking Summary</h2>
          {isComplimentaryReshoot && <Badge variant="outline" className="border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-200">Client $0</Badge>}
        </div>
        <p className="text-sm mb-4 text-slate-500 dark:text-slate-300">{isLastStep ? 'Check each service and its appointment before booking.' : 'Your selected property and services.'}</p>
        {isLastStep && timezoneLabel && <p className="mb-3 text-xs text-muted-foreground">Times shown in {timezoneLabel}.</p>}

        <div className="space-y-6 pb-4">
        {(!isClientRole || isLastStep) && (
          <div className="space-y-1.5">
            <div className="text-sm text-blue-600 dark:text-blue-400">Client</div>
            {summaryInfo.client ? (
              <div className="flex flex-col gap-1 text-slate-900 dark:text-white">
                {showRepName && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
                    <span className="text-xs font-medium">Rep:</span>
                    <span>{summaryInfo.clientRep || 'Not assigned'}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  <span>{summaryInfo.client}</span>
                </div>
              </div>
            ) : (
              <Skeleton className="h-6 w-2/3" />
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex justify-between items-center gap-2"><span className="text-sm text-blue-600 dark:text-blue-400">Property</span>{isLastStep && onEdit && <Button type="button" variant="ghost" size="sm" onClick={() => onEdit('property')}>Edit property</Button>}</div>
          {summaryInfo.address ? (
            <div className="flex items-start gap-2 text-slate-900 dark:text-white">
              <MapPin className="h-4 w-4 text-blue-500 mt-0.5" />
              <span>{summaryInfo.address}</span>
            </div>
          ) : (
            <Skeleton className="h-6 w-full" />
          )}
        </div>

        {isLastStep && propertyDetails && <section aria-label="Property access" className="space-y-1.5">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm text-blue-600 dark:text-blue-400">Access & notes</h3>{onEdit && <Button type="button" variant="ghost" size="sm" onClick={() => onEdit('services')}>Edit access</Button>}</div>
          <p className="text-xs text-muted-foreground">{propertyDetails.bedrooms ?? propertyDetails.bedRooms ?? 0} beds · {propertyDetails.bathrooms ?? propertyDetails.bathRooms ?? 0} baths · {propertyDetails.sqft ?? propertyDetails.livingArea ?? summaryInfo.sqft} sq ft</p>
          <p className="text-sm break-words">{propertyDetails.presenceOption === 'lockbox' ? 'Lockbox' : propertyDetails.presenceOption === 'other' ? 'Another contact' : 'Self / client'}</p>
          {propertyDetails.presenceOption === 'other' && <p className="text-sm break-words">{propertyDetails.accessContactName} {propertyDetails.accessContactPhone}</p>}
          {propertyDetails.presenceOption === 'lockbox' && <p className="text-sm break-words">{propertyDetails.lockboxLocation}{propertyDetails.lockboxCode ? ` · Code: ${propertyDetails.lockboxCode}` : ''}</p>}
          {notes && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{notes}</p>}
        </section>}
        <BookingUnitsSummary review={isLastStep} photographers={photographers} />
        {hasSelectedServices && (
          <div className="pt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">Selected Services</h3>
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <DollarSign className="h-4 w-4" />
                <span className="font-bold">{(summaryInfo.pricing?.totalQuote ?? summaryInfo.packagePrice).toFixed(2)}</span>
              </div>
            </div>
            {isLastStep && onEdit && <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => onEdit('services')}>Edit services</Button><Button type="button" variant="outline" size="sm" onClick={() => onEdit('schedule')}>Edit schedule</Button></div>}
            <div className="space-y-1.5">
              {selectedServices.map(service => (
                <div
                  key={service.id}
                  className="flex min-w-0 items-start justify-between gap-3 rounded-md border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5"
                >
                  <div className="min-w-0 break-words">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{service.name}{normalizeBookingQuantity(service.quantity) > 1 ? ` × ${normalizeBookingQuantity(service.quantity)}` : ''}</p>
                    {serviceScheduleLabelFor(service.id) && (
                      <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">{serviceScheduleLabelFor(service.id)}</p>
                    )}
                    {isLastStep && !units?.enabled && <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">{serviceRequiresPhotographer(service)
                      ? photographers.find(person => String(person.id) === String(resolveServicePhotographerId(service, servicePhotographers, photographer)))?.name || 'Photographer not selected'
                      : 'No photographer needed'}</p>}
                    {service.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {isComplimentaryReshoot ? '$0.00' : `$${(service.total_price ?? Number(service.price ?? 0) * normalizeBookingQuantity(service.quantity)).toFixed(2)}`}
                  </span>
                </div>
              ))}
            </div>
            {summaryInfo.pricing && (
              <div className="rounded-md border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 space-y-1.5">
                {canAdjustAmount && isLastStep && (
                  <div className="mb-2 rounded-md border border-blue-100 bg-blue-50/80 p-2 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <Label htmlFor="summary-booking-amount" className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      Booking amount
                    </Label>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                        <Input
                          id="summary-booking-amount"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={adjustedTotalInput}
                          onChange={(event) => setAdjustedTotalInput?.(event.target.value)}
                          placeholder={amountPlaceholder}
                          className="h-8 pl-6 text-right text-sm"
                        />
                      </div>
                      {isAmountAdjusted && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAdjustedTotalInput?.('')}
                          className="h-8 px-2 text-xs"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-900 dark:text-white">${summaryInfo.pricing.serviceSubtotal.toFixed(2)}</span>
                </div>
                {summaryInfo.pricing.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span>- ${summaryInfo.pricing.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>Tax</span>
                  <span className="font-medium text-slate-900 dark:text-white">${summaryInfo.pricing.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-1.5 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
                  <span>Total</span>
                  <span>${summaryInfo.pricing.totalQuote.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        </div>
      </div>

      {isLastStep && (
        <div className={isMobile
          ? "border-t border-gray-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
          : "border-t border-gray-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-6 py-4"
        }>
          {submissionError && <p role="alert" className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{submissionError} Your booking details have been kept. Review them and try again.</p>}
          {footerContent && <div className="mb-3">{footerContent}</div>}
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || !canSubmit}
            className="min-h-12 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition-colors disabled:opacity-100 disabled:bg-slate-300 disabled:text-slate-600 disabled:hover:bg-slate-300"
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> {isClientRole ? 'Requesting…' : 'Booking…'}
              </>
            ) : isClientRole ? (
              <>
                <Send className="mr-2 h-4 w-4" /> Request Shoot
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" /> {isComplimentaryReshoot ? 'Book Comp Reshoot' : 'Book Shoot'}
              </>
            )}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
