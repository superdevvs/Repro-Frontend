import React from 'react';
import { DollarSign, Calendar as CalendarIcon, Clock, MapPin, User, CloudSun, Check, Send, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useAuth } from '@/components/auth/AuthProvider';
import type { PricingBreakdown } from '@/utils/pricing';

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
  selectedServices: Array<{ id: string; name: string; description: string; price: number }>;
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
  weather,
  isMobile = false,
}: BookingSummaryProps) {
  const { formatTemperature } = useUserPreferences();
  const { user } = useAuth();
  const hasSelectedServices = selectedServices.length > 0;
  const hasWeather = weather && (weather.temperature !== undefined || weather.condition);
  const isAmountAdjusted = canAdjustAmount && adjustedTotalInput.trim() !== '';
  const amountPlaceholder = (originalTotalQuote ?? summaryInfo.pricing?.totalQuote ?? summaryInfo.packagePrice).toFixed(2);
  const normalizeTimeLabel = (value?: string) => {
    if (!value) return '';
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return value;
    const hours = parseInt(match[1], 10);
    const minutes = match[2];
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes} ${meridiem}`;
  };
  const getServiceScheduleLabel = (serviceId: string) => {
    const serviceSchedule = serviceSchedules[serviceId];
    if (!serviceSchedule?.date && !serviceSchedule?.time) return '';
    return [serviceSchedule.date, normalizeTimeLabel(serviceSchedule.time)].filter(Boolean).join(' at ');
  };
  
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
        <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Booking Summary</h2>
        <p className="text-sm mb-6 text-slate-500 dark:text-slate-300">Complete all steps to schedule your shoot</p>

        <div className="space-y-6 pb-4">
        {!isClientRole && (
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
          <div className="text-sm text-blue-600 dark:text-blue-400">Property</div>
          {summaryInfo.address ? (
            <div className="flex items-start gap-2 text-slate-900 dark:text-white">
              <MapPin className="h-4 w-4 text-blue-500 mt-0.5" />
              <span>{summaryInfo.address}</span>
            </div>
          ) : (
            <Skeleton className="h-6 w-full" />
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-sm text-blue-600 dark:text-blue-400">Date & Time</div>
          {summaryInfo.date ? (
            <div className="flex flex-col gap-1 text-slate-900 dark:text-white">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-500" />
                <span>{summaryInfo.date}</span>
              </div>
              {summaryInfo.time && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>{summaryInfo.time}</span>
                </div>
              )}
              {hasWeather && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <CloudSun className="h-3.5 w-3.5 text-blue-400" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {weather?.temperature !== undefined && weather?.temperature !== null ? formatTemperature(weather.temperature) : '--°'}
                  </span>
                  {weather?.condition && <span className="truncate">{weather.condition}</span>}
                </div>
              )}
            </div>
          ) : (
            <Skeleton className="h-6 w-3/4" />
          )}
        </div>

        {hasSelectedServices && (
          <div className="pt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">Selected Services</h3>
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <DollarSign className="h-4 w-4" />
                <span className="font-bold">{(summaryInfo.pricing?.totalQuote ?? summaryInfo.packagePrice).toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {selectedServices.map(service => (
                <div
                  key={service.id}
                  className="flex items-center justify-between rounded-md border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{service.name}</p>
                    {getServiceScheduleLabel(service.id) && (
                      <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">{getServiceScheduleLabel(service.id)}</p>
                    )}
                    {service.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    ${Number(service.price ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            {summaryInfo.pricing && (
              <div className="rounded-md border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 space-y-1.5">
                {canAdjustAmount && isMobile && isLastStep && (
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
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || !canSubmit}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition-colors disabled:opacity-100 disabled:bg-slate-300 disabled:text-slate-600 disabled:hover:bg-slate-300"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requesting...
              </>
            ) : isClientRole ? (
              <>
                <Send className="mr-2 h-4 w-4" /> Request Shoot
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" /> Book Shoot
              </>
            )}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
