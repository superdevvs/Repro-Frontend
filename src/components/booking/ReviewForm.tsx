import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { getStateFullName } from '@/utils/stateUtils';
import { useAuth } from '@/components/auth/AuthProvider';

interface ReviewFormProps {
  client: string; // Client ID
  clientName?: string; // Client name to display
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  area: number; // New prop to combine bedrooms, bathrooms, sqft
  date: Date | undefined;
  time: string;
  photographer: string;
  setPhotographer: (id: string) => void;
  selectedServices: Array<{ id: string; name: string; description?: string; price: number }>;
  additionalNotes: string; // Renamed from notes to additionalNotes
  setAdditionalNotes: (value: string) => void; // Renamed from setNotes
  bypassPayment: boolean;
  setBypassPayment: (value: boolean) => void;
  sendNotification: boolean;
  setSendNotification: (value: boolean) => void;
  packagePrice: number; // Changed from getPackagePrice function to packagePrice value
  photographerRate: number;
  // tax: number;
  // total: number;
  photographers: Array<{ id: string; name: string; avatar: string; rate: number; availability: boolean }>;
  onConfirm: () => void; // Renamed from handleSubmit
  onBack: () => void;
  onSubmit?: () => void;
  isLastStep?: boolean;
}

export function ReviewForm({
  client,
  clientName,
  address,
  city,
  state,
  zip,
  bedrooms,
  bathrooms,
  sqft,
  area,
  date,
  time,
  photographer,
  setPhotographer,
  selectedServices,
  additionalNotes,
  setAdditionalNotes,
  bypassPayment,
  setBypassPayment,
  sendNotification,
  setSendNotification,
  packagePrice,
  photographerRate,
  photographers,
  onSubmit,
  onConfirm,
  onBack,
  isLastStep = false
}: ReviewFormProps) {
  const { user } = useAuth();
  const isClientRole = user?.role === 'client';

  /* ---------------- TAX LOGIC ---------------- */
  const TAXABLE_STATES = ['MD', 'DC', 'VA'];

  const subtotal = packagePrice; // Only package price, photographer fee is internal
  const isTaxableState = TAXABLE_STATES.includes(state);
  const taxRate = isTaxableState ? 0.06 : 0;

  const tax = Number((subtotal * taxRate).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        {/* <Label>Select Photographer</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
          {photographers.length > 0 ? (
            photographers.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all ${
                  photographer === p.id 
                    ? 'border-primary/50 bg-primary/5' 
                    : p.availability 
                      ? 'hover:border-primary/30 hover:bg-primary/5' 
                      : 'opacity-60 cursor-not-allowed'
                }`}
                onClick={() => p.availability && setPhotographer(p.id)}
              >
                <div className="p-4 flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    {photographer === p.id && (
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircleIcon className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    {/* <p className="text-xs text-muted-foreground">${p.rate}/shoot</p>
                    {!p.availability && (
                      <span className="text-[10px] text-muted-foreground">Unavailable</span>
                    )} 
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-3 p-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">No photographers available</h4>
                  <p className="text-sm text-muted-foreground">A photographer will be assigned to you after booking confirmation.</p>
                </div>
              </div>
            </div>
          )} 
        </div> */}
      </div>

      {/* Booking Summary */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-lg space-y-4 border border-gray-100 dark:border-slate-800">
        <h3 className="font-medium text-slate-900 dark:text-slate-100">Booking Summary</h3>

        <div className="space-y-2">
          {!isClientRole && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Client:</span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{clientName || client || "No client selected"}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">Property:</span>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{address || "No address provided"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">Date & Time:</span>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {date ? `${format(date, 'PPP')} at ${time || "No time selected"}` : "No date selected"}
            </span>
          </div>

          <div>
            <span className="text-sm text-slate-500 dark:text-slate-400">Services:</span>
            {selectedServices.length ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-900 dark:text-slate-100">
                {selectedServices.map(service => (
                  <li key={service.id} className="flex items-center justify-between">
                    <span>{service.name}</span>
                    <span className="font-medium">${Number(service.price ?? 0).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No services selected</p>
            )}
          </div>

          <div className="flex justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">Photographer:</span>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {photographers.find(p => p.id === photographer)?.name || (photographers.length === 0 ? "To be assigned" : "No photographer selected")}
            </span>
          </div>

          {additionalNotes && (
            <div className="pt-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Notes:</span>
              <p className="text-sm mt-1 bg-gray-50 dark:bg-slate-800 p-2 rounded text-slate-900 dark:text-slate-100">{additionalNotes}</p>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-sm text-slate-700 dark:text-slate-200">Package:</span>
            <span className="text-sm text-slate-900 dark:text-slate-100">${packagePrice.toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-sm text-slate-700 dark:text-slate-200">
              Tax {isTaxableState ? "(6%)" : "(0%)"}:
            </span>
            <span className="text-sm text-slate-900 dark:text-slate-100">
              ${tax.toFixed(2)}
            </span>
          </div>

          <Separator className="my-2" />

          <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="bypass-payment" className="text-slate-900 dark:text-slate-100">Bypass Payment</Label>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Client will be invoiced later
            </div>
          </div>
          <Switch
            id="bypass-payment"
            checked={bypassPayment}
            onCheckedChange={setBypassPayment}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="send-notification" className="text-slate-900 dark:text-slate-100">Send Notification</Label>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Notify client and photographer
            </div>
          </div>
          <Switch
            id="send-notification"
            checked={sendNotification}
            onCheckedChange={setSendNotification}
          />
        </div>
      </div>

      <div className="pt-2 pb-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          Back
        </Button>
      </div>

      {/* Actions (optional; keep for context) */}
      {/* 
      <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800">
        <Button 
          onClick={onSubmit} 
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition-colors"
        >
          <Check className="mr-2 h-4 w-4" /> Book Shoot
        </Button>
      </div> 
      */}
    </motion.div>
  );
}