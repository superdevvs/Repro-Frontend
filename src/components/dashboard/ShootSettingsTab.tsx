import React, { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvoiceData } from '@/utils/invoiceUtils';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast as sonnerToast } from "sonner";
import { DollarSignIcon as DSIcon } from "lucide-react";
import { ShootData } from "@/types/shoots";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { DollarSignIcon, Sparkles } from "lucide-react";
import { API_BASE_URL } from '@/config/env';

import { PaymentDialog } from "@/components/invoices/PaymentDialog";

interface ShootSettingsTabProps {
  shoot: ShootData;
  isAdmin?: boolean;
  isClient?: boolean;
  onUpdate?: (updated: Partial<ShootData>) => void; // optimistic update callback
  onDelete?: () => void;
  onProcessPayment?: (invoice: InvoiceData) => void;
  currentInvoice?: InvoiceData | null;
}

export function ShootSettingsTab({
  shoot,
  isAdmin = false,
  isClient = false,
  onUpdate,
  onDelete,
  onProcessPayment,
  currentInvoice = null,
}: ShootSettingsTabProps) {
  // ---------- local state ----------
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // toggles (use shoot meta if available; safe cast to avoid TS errors)
  const [isFinalized, setIsFinalized] = useState<boolean>(() => !!(shoot as any)?.meta?.finalized);
  const [isDownloadable, setIsDownloadable] = useState<boolean>(() => !!(shoot as any)?.meta?.downloadable);
  const [isMarkedPaid, setIsMarkedPaid] = useState<boolean>(() => !!(shoot as any)?.payment?.totalPaid);
  const [isSortLocked, setIsSortLocked] = useState<boolean>(() => !!(shoot as any)?.meta?.sortLocked);
  const [autoEditEnabled, setAutoEditEnabled] = useState<boolean>(() => !!(shoot as any)?.auto_edit_enabled);
  const [autoEditStyle, setAutoEditStyle] = useState<string>(() => (shoot as any)?.auto_edit_preferences?.style || 'signature');
  const [autoEditType, setAutoEditType] = useState<string>(() => (shoot as any)?.auto_edit_preferences?.editing_type || 'enhance');

  const [savingToggleKey, setSavingToggleKey] = useState<string | null>(null); // to show loading state per toggle

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false); // kept if needed elsewhere

  // Local invoice state (sync with prop if provided)
  const [localInvoice, setLocalInvoice] = useState<InvoiceData | null>(currentInvoice ?? null);

  // initialize from prop
  useEffect(() => {
    // refresh toggles from fresh shoot prop
    setIsFinalized(!!(shoot as any)?.meta?.finalized);
    setIsDownloadable(!!(shoot as any)?.meta?.downloadable);
    setIsMarkedPaid(!!(shoot as any)?.payment?.totalPaid);
    setIsSortLocked(!!(shoot as any)?.meta?.sortLocked);
    setAutoEditEnabled(!!(shoot as any)?.auto_edit_enabled);
    setAutoEditStyle((shoot as any)?.auto_edit_preferences?.style || 'signature');
    setAutoEditType((shoot as any)?.auto_edit_preferences?.editing_type || 'enhance');
  }, [shoot]);

  // keep localInvoice in sync with prop changes
  useEffect(() => {
    setLocalInvoice(currentInvoice ?? null);
  }, [currentInvoice]);

  // ---------- helpers ----------
  const formatMoney = (v: number) => `$${v.toFixed(2)}`;
  const computedTaxAmount = () => ((shoot as any)?.payment?.baseQuote ?? 0) * ((shoot as any)?.payment?.taxRate ?? 0) / 100;
  const computedTotalQuote = () => (shoot as any)?.payment?.baseQuote ?? 0 + computedTaxAmount();

  // ---------- generic toggle persistence ----------
  const toggleSetting = async (key: string, value: boolean | string | number) => {
    setSavingToggleKey(key);
    try {
      const base = API_BASE_URL;
      const token = (typeof window !== 'undefined') ? (localStorage.getItem('authToken') || localStorage.getItem('token')) : null;

      if (key === 'finalized') {
        if (value === true) {
          // Finalize the shoot on backend
          const res = await fetch(`${base}/api/shoots/${shoot.id}/finalize`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ final_status: 'admin_verified' })
          });
          if (!res.ok) throw new Error(`Finalize failed: ${res.status}`);
          sonnerToast.success('Shoot finalized');
          // Optimistic update
          onUpdate?.({ meta: { ...((shoot as any).meta || {}), finalized: true } } as any);
        } else {
          // Disabling finalized toggle does not undo backend finalization
          sonnerToast.success('Finalization disabled (UI only)');
          onUpdate?.({ meta: { ...((shoot as any).meta || {}), finalized: false } } as any);
        }
      } else {
        // Update shoot settings via PATCH endpoint
        const res = await fetch(`${base}/api/shoots/${shoot.id}`, {
          method: 'PATCH',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ [key]: value })
        });
        if (!res.ok) throw new Error(`Server ${res.status}`);
        onUpdate?.({ meta: { ...((shoot as any).meta || {}), [key]: value } } as any);
        sonnerToast.success('Setting updated');
      }
    } catch (err) {
      console.error('Toggle update failed', err);
      sonnerToast.error('Failed to update');
    } finally {
      setSavingToggleKey(null);
    }
  };

  // ---------- Payment helpers: fetch/create invoice ----------
  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' };
  };

  const fetchInvoiceForShoot = async (): Promise<InvoiceData | null> => {
    try {
      // Try a shoot-scoped endpoint first
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/invoice`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const invoice: InvoiceData = json.data ?? json;
        console.log("Fetched invoice via /shoots/:id/invoice", invoice);
        return invoice;
      }

      // fallback to search invoices by shootId
      const res2 = await fetch(`${API_BASE_URL}/api/invoices?shootId=${shoot.id}`, {
        headers: getAuthHeaders(),
      });
      if (res2.ok) {
        const json2 = await res2.json();
        const items = json2.data ?? json2;
        if (Array.isArray(items) && items.length > 0) {
          console.log("Fetched invoice list and picked first", items[0]);
          return items[0] as InvoiceData;
        }
      }

      return null;
    } catch (err) {
      console.error("fetchInvoiceForShoot error", err);
      return null;
    }
  };

  const createInvoiceForShoot = async (): Promise<InvoiceData | null> => {
    try {
      // Minimal payload; adjust according to backend requirements
      const payload = {
        shootId: shoot.id,
        amount: (shoot as any)?.payment?.totalQuote ?? (shoot as any)?.payment?.baseQuote ?? 0,
        description: `Invoice for shoot ${shoot.id}`,
      };

      const res = await fetch(`${API_BASE_URL}/api/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getAuthHeaders() as any) },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("createInvoiceForShoot failed status", res.status);
        throw new Error(`Server ${res.status}`);
      }

      const json = await res.json();
      const created: InvoiceData = json.data ?? json;
      console.log("Created invoice", created);
      return created;
    } catch (err) {
      console.error("createInvoiceForShoot error", err);
      return null;
    }
  };

  // ---------- openPaymentDialog resilient flow ----------
  const openPaymentDialog = async () => {
    console.log("openPaymentDialog invoked", { isAdmin, isClient, localInvoice, currentInvoice });

    if (!(isAdmin || isClient)) {
      sonnerToast.error("You don't have permission to process payments");
      return;
    }

    if (localInvoice) {
      setPaymentDialogOpen(true);
      return;
    }

    sonnerToast.info("Searching for invoice...");
    // try fetch
    const fetched = await fetchInvoiceForShoot();
    if (fetched) {
      setLocalInvoice(fetched);
      // optionally inform parent
      if (onProcessPayment) {
        try { onProcessPayment(fetched); } catch (e) { /* ignore */ }
      }
      setPaymentDialogOpen(true);
      return;
    }

    // ask user to create invoice
    const create = window.confirm("No invoice found for this shoot. Would you like to create one now?");
    if (!create) {
      sonnerToast.error("No invoice available to process for this shoot");
      return;
    }

    sonnerToast("Creating invoice...");
    const created = await createInvoiceForShoot();
    if (created) {
      setLocalInvoice(created);
      if (onProcessPayment) {
        try { onProcessPayment(created); } catch (e) { /* ignore */ }
      }
      sonnerToast.success("Invoice created. You can now process payment.");
      setPaymentDialogOpen(true);
      return;
    }

    sonnerToast.error("Failed to create invoice");
    return;
  };

  const handlePaymentComplete = (invoiceId: string, paymentMethod: string) => {
    // Close dialog
    setPaymentDialogOpen(false);

    // Optionally update local invoice/payment flags
    if (localInvoice && String(localInvoice.id) === String(invoiceId)) {
      setLocalInvoice({ ...localInvoice, status: "paid" as any, paymentMethod });
    }

    // notify parent
    if (onProcessPayment && localInvoice) {
      try { onProcessPayment(localInvoice); } catch (e) { /* ignore */ }
    }

    sonnerToast.success(`Payment processed (${paymentMethod}) for invoice ${invoiceId}`);
  };

  // ---------- render ----------
  return (
    <div className="space-y-0">
      {/* Settings */}
      {isAdmin && (
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Settings</h3>
            
            {/* Downloadable Toggle */}
            <div className="border rounded-lg p-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Downloadable</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Allow clients to download media files
                  </div>
                </div>
                <Switch
                  checked={isDownloadable}
                  onCheckedChange={(checked: boolean) => {
                    setIsDownloadable(checked);
                    toggleSetting("downloadable", checked);
                  }}
                  disabled={savingToggleKey === "downloadable"}
                  className="flex-shrink-0"
                />
              </div>
            </div>

            {/* Property Details */}
            <div className="border rounded-lg p-3.5 space-y-3">
              <div className="text-sm font-medium">Property Details</div>
              <div className="space-y-2">
                <Label htmlFor="mls_image_width" className="text-xs">MLS Image Width (px)</Label>
                <Input
                  id="mls_image_width"
                  type="number"
                  placeholder="1920"
                  defaultValue={(shoot as any)?.mls_image_width || ''}
                  className="h-8 text-xs"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) {
                      toggleSetting("mls_image_width", parseInt(value));
                    }
                  }}
                />
              </div>
            </div>

            {/* Google Calendar */}
            <div className="border rounded-lg p-3.5 space-y-3">
              <div className="text-sm font-medium">Google Calendar</div>
              <div className="space-y-2">
                <Label htmlFor="google_calendar_id" className="text-xs">Calendar ID</Label>
                <Input
                  id="google_calendar_id"
                  type="text"
                  placeholder="Enter Google Calendar ID"
                  defaultValue={(shoot as any)?.google_calendar_id || ''}
                  className="h-8 text-xs"
                  onChange={(e) => {
                    toggleSetting("google_calendar_id", e.target.value);
                  }}
                />
              </div>
            </div>

            {/* Timezone */}
            <div className="border rounded-lg p-3.5 space-y-3">
              <div className="text-sm font-medium">Timezone</div>
              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-xs">Timezone</Label>
                <Select
                  defaultValue={(shoot as any)?.timezone || 'America/New_York'}
                  onValueChange={(value) => toggleSetting("timezone", value)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* VS Naming */}
            <div className="border rounded-lg p-3.5 space-y-3">
              <div className="text-sm font-medium">VS Naming</div>
              <div className="space-y-2">
                <Label htmlFor="vs_naming" className="text-xs">Naming Convention</Label>
                <Input
                  id="vs_naming"
                  type="text"
                  placeholder="e.g., {address}_{date}_{sequence}"
                  defaultValue={(shoot as any)?.vs_naming || ''}
                  className="h-8 text-xs"
                  onChange={(e) => {
                    toggleSetting("vs_naming", e.target.value);
                  }}
                />
              </div>
            </div>

            {/* Custom Filename */}
            <div className="border rounded-lg p-3.5 space-y-3">
              <div className="text-sm font-medium">Custom Filename</div>
              <div className="space-y-2">
                <Label htmlFor="custom_filename" className="text-xs">Filename Pattern</Label>
                <Input
                  id="custom_filename"
                  type="text"
                  placeholder="e.g., {property}_{type}_{number}"
                  defaultValue={(shoot as any)?.custom_filename || ''}
                  className="h-8 text-xs"
                  onChange={(e) => {
                    toggleSetting("custom_filename", e.target.value);
                  }}
                />
              </div>
            </div>

            {/* Ghost User */}
            <div className="border rounded-lg p-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Ghost User</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Hide user from public listings
                  </div>
                </div>
                <Switch
                  checked={(shoot as any)?.ghost_user || false}
                  onCheckedChange={(checked: boolean) => {
                    toggleSetting("ghost_user", checked);
                  }}
                  className="flex-shrink-0"
                />
              </div>
            </div>

            {/* Hide Proof */}
            <div className="border rounded-lg p-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Hide Proof</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Hide proof images from client view
                  </div>
                </div>
                <Switch
                  checked={(shoot as any)?.hide_proof || false}
                  onCheckedChange={(checked: boolean) => {
                    toggleSetting("hide_proof", checked);
                  }}
                  className="flex-shrink-0"
                />
              </div>
            </div>

            {/* Auto-Edit Option */}
            <div className="border rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Auto-Edit
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Automatically edit photos when uploaded using preset preferences
                  </div>
                </div>
                <Switch
                  checked={autoEditEnabled}
                  onCheckedChange={async (checked: boolean) => {
                    setAutoEditEnabled(checked);
                    try {
                      const base = API_BASE_URL;
                      const token = (typeof window !== 'undefined') ? (localStorage.getItem('authToken') || localStorage.getItem('token')) : null;
                      
                      const res = await fetch(`${base}/api/shoots/${shoot.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Accept': 'application/json',
                          'Content-Type': 'application/json',
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ 
                          auto_edit_enabled: checked,
                          auto_edit_preferences: checked ? {
                            editing_type: autoEditType,
                            style: autoEditStyle,
                            auto_perspective: true,
                            sky_replacement: true,
                          } : null,
                        }),
                      });
                      
                      if (!res.ok) throw new Error(`Server ${res.status}`);
                      onUpdate?.({ auto_edit_enabled: checked } as any);
                      sonnerToast.success(checked ? 'Auto-edit enabled' : 'Auto-edit disabled');
                    } catch (err) {
                      console.error('Auto-edit toggle failed', err);
                      sonnerToast.error('Failed to update auto-edit setting');
                      setAutoEditEnabled(!checked); // Revert on error
                    }
                  }}
                  className="flex-shrink-0"
                />
              </div>
              
              {autoEditEnabled && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="space-y-2">
                    <Label className="text-xs">Editing Type</Label>
                    <Select
                      value={autoEditType}
                      onValueChange={async (value) => {
                        setAutoEditType(value);
                        try {
                          const base = API_BASE_URL;
                          const token = (typeof window !== 'undefined') ? (localStorage.getItem('authToken') || localStorage.getItem('token')) : null;
                          
                          const res = await fetch(`${base}/api/shoots/${shoot.id}`, {
                            method: 'PATCH',
                            headers: {
                              'Accept': 'application/json',
                              'Content-Type': 'application/json',
                              ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            body: JSON.stringify({ 
                              auto_edit_preferences: {
                                editing_type: value,
                                style: autoEditStyle,
                                auto_perspective: true,
                                sky_replacement: true,
                              },
                            }),
                          });
                          
                          if (!res.ok) throw new Error(`Server ${res.status}`);
                          onUpdate?.({ auto_edit_preferences: { editing_type: value, style: autoEditStyle } } as any);
                        } catch (err) {
                          console.error('Failed to update auto-edit type', err);
                          sonnerToast.error('Failed to update editing type');
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enhance">Enhance</SelectItem>
                        <SelectItem value="sky_replace">Sky Replace</SelectItem>
                        <SelectItem value="remove_object">Remove Object</SelectItem>
                        <SelectItem value="color_correct">Color Correct</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs">Enhancement Style</Label>
                    <Select
                      value={autoEditStyle}
                      onValueChange={async (value) => {
                        setAutoEditStyle(value);
                        try {
                          const base = API_BASE_URL;
                          const token = (typeof window !== 'undefined') ? (localStorage.getItem('authToken') || localStorage.getItem('token')) : null;
                          
                          const res = await fetch(`${base}/api/shoots/${shoot.id}`, {
                            method: 'PATCH',
                            headers: {
                              'Accept': 'application/json',
                              'Content-Type': 'application/json',
                              ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            body: JSON.stringify({ 
                              auto_edit_preferences: {
                                editing_type: autoEditType,
                                style: value,
                                auto_perspective: true,
                                sky_replacement: true,
                              },
                            }),
                          });
                          
                          if (!res.ok) throw new Error(`Server ${res.status}`);
                          onUpdate?.({ auto_edit_preferences: { editing_type: autoEditType, style: value } } as any);
                        } catch (err) {
                          console.error('Failed to update auto-edit style', err);
                          sonnerToast.error('Failed to update enhancement style');
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="signature">Signature</SelectItem>
                        <SelectItem value="natural">Natural</SelectItem>
                        <SelectItem value="twilight">Twilight</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PaymentDialog (reused shared component). */}
      <PaymentDialog
        invoice={localInvoice}
        isOpen={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  );
}

export default ShootSettingsTab;
