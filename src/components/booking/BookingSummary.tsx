import React from 'react';
import { DollarSign, Calendar as CalendarIcon, Clock, MapPin, User, CloudSun, Check, Send, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useAuth } from '@/components/auth/AuthProvider';

interface BookingSummaryProps {
  summaryInfo: {
    client: string;
    clientRep?: string; // Sales/Rep name
    packageLabel?: string;
    services?: Array<{ id: string; name: string; description: string; price: number }>;
    packagePrice: number;
    address: string;
    bedrooms: number;
    bathrooms: number;
    sqft: number;
    date: string;
    time: string;
  };
  selectedServices: Array<{ id: string; name: string; description: string; price: number }>;
  onSubmit?: () => void;
  isLastStep?: boolean;
  isSubmitting?: boolean;
  showRepName?: boolean; // Whether to show rep name (admin, superadmin, photographer only)
  weather?: {
    temperature?: number | null;
    condition?: string | null;
  };
}

export function BookingSummary({
  summaryInfo,
  selectedServices,
  onSubmit,
  isLastStep = false,
  isSubmitting = false,
  showRepName = false,
  weather,
}: BookingSummaryProps) {
  const { formatTemperature } = useUserPreferences();
  const { user } = useAuth();
  const hasSelectedServices = selectedServices.length > 0;
  const hasWeather = weather && (weather.temperature !== undefined || weather.condition);
  
  // Clients submit requests, admin/rep book directly
  const isClientRole = user?.role === 'client';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={
        // light by default, dark when `dark:` is present in page
        "bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 rounded-lg border border-gray-200 dark:border-slate-800 shadow-sm sticky top-20 max-h-[calc(100vh-6rem)] overflow-hidden flex flex-col"
      }
    >
      <div className="flex-1 overflow-y-auto p-6 pr-4">
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
                <span className="font-bold">${summaryInfo.packagePrice.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-2">
              {selectedServices.map(service => (
                <div
                  key={service.id}
                  className="flex items-center justify-between rounded-md border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{service.name}</p>
                    {service.description && (
                      <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    ${Number(service.price ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-6 py-4">
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition-colors disabled:opacity-70"
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
    </motion.div>
  );
}
