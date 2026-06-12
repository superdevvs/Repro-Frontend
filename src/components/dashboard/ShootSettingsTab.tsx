import React, { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoiceData } from '@/utils/invoiceUtils';
import { useAuth } from "@/components/auth";
import { MultiSelectChecklist } from "@/components/ui/multi-select-checklist";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast as sonnerToast } from "@/lib/sonner-toast";
import { DollarSignIcon as DSIcon } from "lucide-react";
import { ShootData, ShootGhostUser } from "@/types/shoots";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { DollarSignIcon, ExternalLink, Sparkles, X } from "lucide-react";
import { API_BASE_URL } from '@/config/env';

import { PaymentDialog, type InvoicePaymentCompletePayload } from "@/components/invoices/PaymentDialog";
import { formatPaymentMethod } from '@/utils/paymentUtils';

interface ShootSettingsTabProps {
  shoot: ShootData;
  isAdmin?: boolean;
  isClient?: boolean;
  canManageGhostUsers?: boolean;
  onUpdate?: (updated: Partial<ShootData>) => void; // optimistic update callback
  onDelete?: () => void;
  onProcessPayment?: (invoice: InvoiceData) => void;
  currentInvoice?: InvoiceData | null;
}

type DownloadableMode = "automatic" | "unlocked" | "locked";

type GhostClientOption = {
  id: string;
  name: string;
  email?: string;
  company?: string;
};

type FeaturedHomepageImageDraft = {
  shoot_file_id: number;
  sort: number;
  alt: string;
  focal: string;
};

const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL?.trim() || 'https://reprophotos.com';

const resolveFeaturedState = (shoot: ShootData): boolean => {
  const candidates = [
    (shoot as any)?.is_featured,
    (shoot as any)?.isFeatured,
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return Boolean(candidate);
    }
  }

  return false;
};

const resolveDownloadableMode = (shoot: ShootData): DownloadableMode => {
  const meta = (shoot as any)?.meta;
  const candidates = [
    meta?.downloadable_mode,
    meta?.downloadableMode,
    (shoot as any)?.downloadable_mode,
    (shoot as any)?.downloadableMode,
    meta?.downloadable,
    (shoot as any)?.downloadable,
  ];

  for (const candidate of candidates) {
    if (candidate === "automatic" || candidate === "unlocked" || candidate === "locked") {
      return candidate;
    }
    if (candidate === true) {
      return "unlocked";
    }
    if (candidate === false) {
      return "locked";
    }
  }

  return "automatic";
};

const resolveMlsImageWidth = (shoot: ShootData): string => {
  const value = (shoot as any)?.mls_image_width ?? (shoot as any)?.mlsImageWidth ?? '';
  return value === null || value === undefined ? '' : String(value);
};

const resolveFeaturedField = (shoot: ShootData, snake: string, camel: string): string => {
  const value = (shoot as any)?.[snake] ?? (shoot as any)?.[camel] ?? '';
  return value === null || value === undefined ? '' : String(value);
};

const resolveFilePreview = (file: any): string => (
  file?.thumbnail_url
  || file?.thumb_url
  || file?.thumb
  || file?.web_url
  || file?.medium_url
  || file?.medium
  || file?.url
  || ''
);

const isDashboardImageFile = (file: any): boolean => {
  const mime = String(file?.mime_type || file?.file_type || file?.fileType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const filename = String(file?.filename || file?.stored_filename || file?.path || file?.url || '').toLowerCase();
  return /\.(jpe?g|png|webp)$/i.test(filename);
};

const isEditedDashboardImageFile = (file: any): boolean => {
  const stage = String(file?.workflow_stage || file?.workflowStage || '').toLowerCase();
  return ['completed', 'verified'].includes(stage) && isDashboardImageFile(file);
};

const normalizeFeaturedHomepageImages = (shoot: ShootData): FeaturedHomepageImageDraft[] => {
  const rawImages = ((shoot as any)?.featured_homepage_images || (shoot as any)?.featuredHomepageImages || []) as any[];

  return rawImages
    .map((image, index) => ({
      shoot_file_id: Number(image.shoot_file_id ?? image.shootFileId),
      sort: Number(image.sort ?? image.sort_order ?? index + 1),
      alt: String(image.alt ?? image.alt_text ?? ''),
      focal: String(image.focal ?? image.focal_point ?? '50% 50%'),
    }))
    .filter((image) => Number.isFinite(image.shoot_file_id) && image.shoot_file_id > 0)
    .sort((a, b) => a.sort - b.sort);
};

const hasDownloadableModeValue = (shootLike: unknown): boolean => {
  if (!shootLike || typeof shootLike !== "object") {
    return false;
  }

  const source = shootLike as any;
  const meta = source?.meta;
  const candidates = [
    meta?.downloadable_mode,
    meta?.downloadableMode,
    source?.downloadable_mode,
    source?.downloadableMode,
    meta?.downloadable,
    source?.downloadable,
  ];

  return candidates.some((candidate) => candidate !== undefined && candidate !== null);
};

const normalizeGhostUsers = (shoot: ShootData): ShootGhostUser[] => {
  return Array.isArray(shoot.ghostUsers)
    ? shoot.ghostUsers.filter((ghostUser): ghostUser is ShootGhostUser => Boolean(ghostUser?.id))
    : [];
};

const normalizeGhostUserIds = (shoot: ShootData): string[] => {
  if (Array.isArray(shoot.ghostUserIds) && shoot.ghostUserIds.length > 0) {
    return shoot.ghostUserIds.map((id) => String(id));
  }

  return normalizeGhostUsers(shoot).map((ghostUser) => String(ghostUser.id));
};

export function ShootSettingsTab({
  shoot,
  isAdmin = false,
  isClient = false,
  canManageGhostUsers = false,
  onUpdate,
  onDelete,
  onProcessPayment,
  currentInvoice = null,
}: ShootSettingsTabProps) {
  // ---------- local state ----------
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // toggles (use shoot meta if available; safe cast to avoid TS errors)
  const [isFinalized, setIsFinalized] = useState<boolean>(() => !!(shoot as any)?.meta?.finalized);
  const [downloadableMode, setDownloadableMode] = useState<DownloadableMode>(() => resolveDownloadableMode(shoot));
  const [isMarkedPaid, setIsMarkedPaid] = useState<boolean>(() => !!(shoot as any)?.payment?.totalPaid);
  const [autoEditEnabled, setAutoEditEnabled] = useState<boolean>(() => !!(shoot as any)?.auto_edit_enabled);
  const [autoEditStyle, setAutoEditStyle] = useState<string>(() => (shoot as any)?.auto_edit_preferences?.style || 'signature');
  const [autoEditType, setAutoEditType] = useState<string>(() => (shoot as any)?.auto_edit_preferences?.editing_type || 'enhance');
  const [isPrivateExclusive, setIsPrivateExclusive] = useState<boolean>(() => !!((shoot as any)?.is_private_listing || (shoot as any)?.isPrivateListing));
  const [isFeaturedShoot, setIsFeaturedShoot] = useState<boolean>(() => resolveFeaturedState(shoot));
  const [featuredTitle, setFeaturedTitle] = useState<string>(() => resolveFeaturedField(shoot, 'featured_homepage_title', 'featuredHomepageTitle'));
  const [featuredLocation, setFeaturedLocation] = useState<string>(() => resolveFeaturedField(shoot, 'featured_homepage_location', 'featuredHomepageLocation'));
  const [featuredSubtitle, setFeaturedSubtitle] = useState<string>(() => resolveFeaturedField(shoot, 'featured_homepage_subtitle', 'featuredHomepageSubtitle'));
  const [featuredCtaLabel, setFeaturedCtaLabel] = useState<string>(() => resolveFeaturedField(shoot, 'featured_homepage_cta_label', 'featuredHomepageCtaLabel') || 'See the shoot');
  const [featuredCtaHref, setFeaturedCtaHref] = useState<string>(() => resolveFeaturedField(shoot, 'featured_homepage_cta_href', 'featuredHomepageCtaHref'));
  const [featuredImages, setFeaturedImages] = useState<FeaturedHomepageImageDraft[]>(() => normalizeFeaturedHomepageImages(shoot));
  const [isSavingFeaturedHero, setIsSavingFeaturedHero] = useState(false);
  const [timezone, setTimezone] = useState<string>(() => (shoot as any)?.timezone || 'America/New_York');
  const [mlsImageWidth, setMlsImageWidth] = useState<string>(() => resolveMlsImageWidth(shoot));

  const auth = useAuth();
  const role = auth?.user?.role || 'client';
  const isSalesRep = role === 'salesRep';
  const isEditingManager = role === 'editing_manager';

  const [savingToggleKey, setSavingToggleKey] = useState<string | null>(null); // to show loading state per toggle

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false); // kept if needed elsewhere

  // Local invoice state (sync with prop if provided)
  const [localInvoice, setLocalInvoice] = useState<InvoiceData | null>(currentInvoice ?? null);
  const [ghostClientOptions, setGhostClientOptions] = useState<GhostClientOption[]>([]);
  const [selectedGhostUserIds, setSelectedGhostUserIds] = useState<string[]>(() => normalizeGhostUserIds(shoot));
  const [ghostUserPickerOpen, setGhostUserPickerOpen] = useState(false);

  // initialize from prop
  useEffect(() => {
    // refresh toggles from fresh shoot prop
    setIsFinalized(!!(shoot as any)?.meta?.finalized);
    setDownloadableMode(resolveDownloadableMode(shoot));
    setIsMarkedPaid(!!(shoot as any)?.payment?.totalPaid);
    setAutoEditEnabled(!!(shoot as any)?.auto_edit_enabled);
    setAutoEditStyle((shoot as any)?.auto_edit_preferences?.style || 'signature');
    setAutoEditType((shoot as any)?.auto_edit_preferences?.editing_type || 'enhance');
    setIsPrivateExclusive(!!((shoot as any)?.is_private_listing || (shoot as any)?.isPrivateListing));
    setIsFeaturedShoot(resolveFeaturedState(shoot));
    setFeaturedTitle(resolveFeaturedField(shoot, 'featured_homepage_title', 'featuredHomepageTitle'));
    setFeaturedLocation(resolveFeaturedField(shoot, 'featured_homepage_location', 'featuredHomepageLocation'));
    setFeaturedSubtitle(resolveFeaturedField(shoot, 'featured_homepage_subtitle', 'featuredHomepageSubtitle'));
    setFeaturedCtaLabel(resolveFeaturedField(shoot, 'featured_homepage_cta_label', 'featuredHomepageCtaLabel') || 'See the shoot');
    setFeaturedCtaHref(resolveFeaturedField(shoot, 'featured_homepage_cta_href', 'featuredHomepageCtaHref'));
    setFeaturedImages(normalizeFeaturedHomepageImages(shoot));
    setTimezone((shoot as any)?.timezone || 'America/New_York');
    setMlsImageWidth(resolveMlsImageWidth(shoot));
    setSelectedGhostUserIds(normalizeGhostUserIds(shoot));
  }, [shoot]);

  const canManagePrivateExclusive = isAdmin || isClient || isSalesRep;
  const canManageFeaturedShoot = isAdmin || isSalesRep || isEditingManager;
  const canManageGhostUsersResolved = canManageGhostUsers || isAdmin || isSalesRep;

  const normalizedStatus = String((shoot as any)?.workflowStatus || (shoot as any)?.workflow_status || (shoot as any)?.status || '').toLowerCase();
  const eligibleForPrivateExclusive = ['delivered', 'ready_for_client', 'admin_verified', 'ready', 'completed'].includes(normalizedStatus);

  // keep localInvoice in sync with prop changes
  useEffect(() => {
    setLocalInvoice(currentInvoice ?? null);
  }, [currentInvoice]);

  useEffect(() => {
    if (!canManageGhostUsersResolved) return;

    let active = true;

    const fetchClients = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/admin/clients`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (!response.ok) return;

        const json = await response.json();
        const clients = (json.data || json.users || json || []).map((client: any) => ({
          id: String(client.id),
          name: client.name || 'Client',
          email: client.email || '',
          company: client.company_name || client.company || '',
        }));
        const existingGhostUsers = normalizeGhostUsers(shoot).map((ghostUser) => ({
          id: String(ghostUser.id),
          name: ghostUser.name,
          email: ghostUser.email || '',
          company: ghostUser.company || '',
        }));

        const combined = Array.from(
          new Map([...existingGhostUsers, ...clients].map((client) => [client.id, client])).values(),
        );

        if (active) {
          setGhostClientOptions(combined);
        }
      } catch (error) {
        console.error('Error fetching ghost clients:', error);
      }
    };

    void fetchClients();

    return () => {
      active = false;
    };
  }, [canManageGhostUsersResolved, shoot]);

  // ---------- helpers ----------
  const formatMoney = (v: number) => `$${v.toFixed(2)}`;
  const computedTaxAmount = () => ((shoot as any)?.payment?.baseQuote ?? 0) * ((shoot as any)?.payment?.taxRate ?? 0) / 100;
  const computedTotalQuote = () => (shoot as any)?.payment?.baseQuote ?? 0 + computedTaxAmount();

  // ---------- generic toggle persistence ----------
  const toggleSetting = async (key: string, value: boolean | string | number | null) => {
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
        if (!res.ok) {
          const errorJson = await res.json().catch(() => null);
          const message =
            errorJson?.message
            || errorJson?.error
            || (errorJson?.errors ? Object.values(errorJson.errors).flat().join(' ') : null)
            || `Server ${res.status}`;
          throw new Error(message);
        }

        const successJson = await res.json().catch(() => null);
        const returned = successJson?.data || successJson;
        if (key === 'is_private_listing') {
          const persisted =
            returned?.is_private_listing !== undefined
              ? Boolean(returned.is_private_listing)
              : (returned?.isPrivateListing !== undefined ? Boolean(returned.isPrivateListing) : Boolean(value));
          setIsPrivateExclusive(persisted);
          onUpdate?.({ isPrivateListing: persisted } as any);

          // Verify persistence by re-fetching the shoot
          try {
            const verifyRes = await fetch(`${base}/api/shoots/${shoot.id}`, {
              headers: {
                'Accept': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });

            if (verifyRes.ok) {
              const verifyJson = await verifyRes.json().catch(() => null);
              const verifyData = verifyJson?.data || verifyJson;
              const verified =
                verifyData?.is_private_listing !== undefined
                  ? Boolean(verifyData.is_private_listing)
                  : (verifyData?.isPrivateListing !== undefined ? Boolean(verifyData.isPrivateListing) : persisted);

              setIsPrivateExclusive(verified);
              onUpdate?.({ isPrivateListing: verified } as any);

              if (verified !== persisted) {
                sonnerToast.error('Private Exclusive did not persist after refresh. Please restart backend and try again.');
              }
            }
          } catch {
            // ignore verification errors
          }
        } else if (key === 'timezone') {
          const persisted = returned?.timezone ?? value ?? 'America/New_York';
          setTimezone(String(persisted));
          onUpdate?.({ timezone: String(persisted) } as any);
        } else if (key === 'mls_image_width') {
          const persisted = returned?.mls_image_width ?? returned?.mlsImageWidth ?? value;
          setMlsImageWidth(persisted === null || persisted === undefined ? '' : String(persisted));
          onUpdate?.({
            mls_image_width: persisted,
            mlsImageWidth: persisted,
          } as any);
        } else {
          onUpdate?.({ meta: { ...((shoot as any).meta || {}), [key]: value } } as any);
        }
        sonnerToast.success('Setting updated');
      }
    } catch (err) {
      console.error('Toggle update failed', err);
      const message = err instanceof Error ? err.message : 'Failed to update';
      sonnerToast.error(message);
      throw err;
    } finally {
      setSavingToggleKey(null);
    }
  };

  const updateDownloadableSetting = async (mode: DownloadableMode) => {
    const previousMode = downloadableMode;
    const downloadable = mode === "unlocked";

    setDownloadableMode(mode);
    setSavingToggleKey("downloadable");

    try {
      const base = API_BASE_URL;
      const token = (typeof window !== 'undefined')
        ? (localStorage.getItem('authToken') || localStorage.getItem('token'))
        : null;

      const res = await fetch(`${base}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          downloadable,
          downloadable_mode: mode,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        const message =
          errorJson?.message
          || errorJson?.error
          || (errorJson?.errors ? Object.values(errorJson.errors).flat().join(' ') : null)
          || `Server ${res.status}`;
        throw new Error(message);
      }

      const successJson = await res.json().catch(() => null);
      const returned = successJson?.data || successJson;
      const persistedMode = hasDownloadableModeValue(returned)
        ? resolveDownloadableMode(returned as ShootData)
        : mode;

      setDownloadableMode(persistedMode);
      onUpdate?.({
        downloadable,
        downloadable_mode: persistedMode,
        downloadableMode: persistedMode,
        meta: {
          ...((shoot as any).meta || {}),
          downloadable,
          downloadable_mode: persistedMode,
          downloadableMode: persistedMode,
        },
      } as any);
      sonnerToast.success('Setting updated');
    } catch (err) {
      console.error('Downloadable update failed', err);
      setDownloadableMode(previousMode);
      const message = err instanceof Error ? err.message : 'Failed to update';
      sonnerToast.error(message);
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

  const handlePaymentComplete = (payload: InvoicePaymentCompletePayload) => {
    const { invoiceId, paymentMethod, paymentDetails, paymentDate } = payload;
    // Close dialog
    setPaymentDialogOpen(false);

    let updatedInvoice = localInvoice;
    if (localInvoice && String(localInvoice.id) === String(invoiceId)) {
      updatedInvoice = {
        ...localInvoice,
        status: 'paid' as InvoiceData['status'],
        paymentMethod,
        paymentDetails: paymentDetails ?? localInvoice.paymentDetails,
        paidAt: paymentDate ?? localInvoice.paidAt,
      };
      setLocalInvoice(updatedInvoice);
    }

    // notify parent
    if (onProcessPayment && updatedInvoice) {
      try { onProcessPayment(updatedInvoice); } catch (e) { /* ignore */ }
    }

    const methodLabel = formatPaymentMethod(paymentMethod, paymentDetails);
    sonnerToast.success(`Payment processed (${methodLabel}) for invoice ${invoiceId}`);
  };

  const updateGhostUsers = async (nextIds: string[]) => {
    setSavingToggleKey("ghost_user_ids");
    try {
      const token = (typeof window !== 'undefined')
        ? (localStorage.getItem('authToken') || localStorage.getItem('token'))
        : null;
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ghost_user_ids: nextIds.map((id) => Number(id)) }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        const message =
          errorJson?.message
          || errorJson?.error
          || (errorJson?.errors ? Object.values(errorJson.errors).flat().join(' ') : null)
          || `Server ${response.status}`;
        throw new Error(message);
      }

      const json = await response.json().catch(() => null);
      const returned = json?.data || json;
      const persistedGhostUsers = Array.isArray(returned?.ghost_users)
        ? returned.ghost_users.map((ghostUser: any) => ({
            id: String(ghostUser.id),
            name: ghostUser.name || 'Client',
            email: ghostUser.email || undefined,
            company: ghostUser.company || ghostUser.company_name || undefined,
          }))
        : ghostClientOptions
            .filter((client) => nextIds.includes(client.id))
            .map((client) => ({
              id: client.id,
              name: client.name,
              email: client.email || undefined,
              company: client.company || undefined,
            }));
      const persistedGhostUserIds = Array.isArray(returned?.ghost_user_ids)
        ? returned.ghost_user_ids.map((id: string | number) => String(id))
        : persistedGhostUsers.map((ghostUser) => ghostUser.id);

      setSelectedGhostUserIds(persistedGhostUserIds);
      onUpdate?.({
        ghostUsers: persistedGhostUsers,
        ghostUserIds: persistedGhostUserIds,
        isGhostVisibleForUser: Boolean(returned?.is_ghost_visible_for_user ?? returned?.isGhostVisibleForUser),
      } as Partial<ShootData>);
      sonnerToast.success('Ghost users updated');
    } catch (error) {
      console.error('Failed to update ghost users', error);
      const message = error instanceof Error ? error.message : 'Failed to update ghost users';
      sonnerToast.error(message);
      throw error;
    } finally {
      setSavingToggleKey(null);
    }
  };

  const updateFeaturedSetting = async (nextValue: boolean) => {
    setSavingToggleKey('is_featured');
    try {
      const token = (typeof window !== 'undefined')
        ? (localStorage.getItem('authToken') || localStorage.getItem('token'))
        : null;
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_featured: nextValue }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        const message =
          errorJson?.message
          || errorJson?.error
          || (errorJson?.errors ? Object.values(errorJson.errors).flat().join(' ') : null)
          || `Server ${response.status}`;
        throw new Error(message);
      }

      const json = await response.json().catch(() => null);
      const returned = json?.data || json;
      const persisted = resolveFeaturedState((returned || shoot) as ShootData);

      setIsFeaturedShoot(persisted);
      onUpdate?.({
        is_featured: persisted,
        isFeatured: persisted,
      } as Partial<ShootData>);
      sonnerToast.success(persisted ? 'Featured Shoot enabled' : 'Featured Shoot removed');
    } catch (error) {
      console.error('Failed to update Featured Shoot', error);
      const message = error instanceof Error ? error.message : 'Failed to update Featured Shoot';
      sonnerToast.error(message);
      throw error;
    } finally {
      setSavingToggleKey(null);
    }
  };

  const availableHomepageImages = (Array.isArray((shoot as any).files) ? (shoot as any).files : [])
    .filter((file: any) => !file?.is_hidden && isEditedDashboardImageFile(file) && resolveFilePreview(file))
    .map((file: any) => ({
      id: Number(file.id),
      filename: file.filename || file.stored_filename || `Image ${file.id}`,
      preview: resolveFilePreview(file),
    }))
    .filter((file: { id: number }) => Number.isFinite(file.id));

  const selectedFeaturedImageIds = new Set(featuredImages.map((image) => image.shoot_file_id));

  const toggleFeaturedImage = (fileId: number, checked: boolean) => {
    setFeaturedImages((current) => {
      if (!checked) {
        return current.filter((image) => image.shoot_file_id !== fileId);
      }

      if (current.some((image) => image.shoot_file_id === fileId)) {
        return current;
      }

      return [
        ...current,
        {
          shoot_file_id: fileId,
          sort: current.length + 1,
          alt: '',
          focal: '50% 50%',
        },
      ];
    });
  };

  const updateFeaturedImage = (fileId: number, updates: Partial<FeaturedHomepageImageDraft>) => {
    setFeaturedImages((current) =>
      current.map((image) =>
        image.shoot_file_id === fileId ? { ...image, ...updates } : image,
      ),
    );
  };

  const saveFeaturedHeroSettings = async () => {
    if (featuredImages.length > 0 && (featuredImages.length < 3 || featuredImages.length > 6)) {
      sonnerToast.error('Choose 3 to 6 homepage hero images, or clear the list before saving.');
      return;
    }

    const invalidFocal = featuredImages.find((image) => !/^\d{1,3}%\s+\d{1,3}%$/.test(image.focal.trim()));
    if (invalidFocal) {
      sonnerToast.error('Focal points must look like 50% 35%.');
      return;
    }

    setIsSavingFeaturedHero(true);
    try {
      const token = (typeof window !== 'undefined')
        ? (localStorage.getItem('authToken') || localStorage.getItem('token'))
        : null;
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          featured_homepage_title: featuredTitle.trim() || null,
          featured_homepage_location: featuredLocation.trim() || null,
          featured_homepage_subtitle: featuredSubtitle.trim() || null,
          featured_homepage_cta_label: featuredCtaLabel.trim() || null,
          featured_homepage_cta_href: featuredCtaHref.trim() || null,
          featured_homepage_images: featuredImages
            .slice()
            .sort((a, b) => a.sort - b.sort)
            .map((image, index) => ({
              shoot_file_id: image.shoot_file_id,
              sort: index + 1,
              alt: image.alt.trim() || null,
              focal: image.focal.trim() || '50% 50%',
            })),
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        const message =
          errorJson?.message
          || errorJson?.error
          || (errorJson?.errors ? Object.values(errorJson.errors).flat().join(' ') : null)
          || `Server ${response.status}`;
        throw new Error(message);
      }

      const json = await response.json().catch(() => null);
      const returned = json?.data || json || {};
      const persistedImages = normalizeFeaturedHomepageImages(returned as ShootData);
      setFeaturedImages(persistedImages);
      onUpdate?.({
        featured_homepage_title: featuredTitle.trim() || null,
        featured_homepage_location: featuredLocation.trim() || null,
        featured_homepage_subtitle: featuredSubtitle.trim() || null,
        featured_homepage_cta_label: featuredCtaLabel.trim() || null,
        featured_homepage_cta_href: featuredCtaHref.trim() || null,
        featured_homepage_images: persistedImages,
      } as Partial<ShootData>);
      sonnerToast.success('Homepage hero settings saved');
    } catch (error) {
      console.error('Failed to save homepage hero settings', error);
      sonnerToast.error(error instanceof Error ? error.message : 'Failed to save homepage hero settings');
    } finally {
      setIsSavingFeaturedHero(false);
    }
  };

  const selectedGhostClients = Array.from(
    new Map(
      [
        ...normalizeGhostUsers(shoot).map((ghostUser) => ({
          id: String(ghostUser.id),
          name: ghostUser.name,
          email: ghostUser.email || '',
          company: ghostUser.company || '',
        })),
        ...ghostClientOptions,
      ].map((client) => [client.id, client]),
    ).values(),
  ).filter((client) => selectedGhostUserIds.includes(client.id));

  const ghostClientChecklistOptions = ghostClientOptions.map((client) => ({
    id: client.id,
    label: client.name,
    description: client.email || 'No email available',
    meta: client.company || undefined,
  }));

  const handleGhostUsersChange = (nextIds: string[]) => {
    const previousIds = selectedGhostUserIds;
    setSelectedGhostUserIds(nextIds);
    void updateGhostUsers(nextIds).catch(() => {
      setSelectedGhostUserIds(previousIds);
    });
  };

  const saveMlsImageWidth = () => {
    const trimmedValue = mlsImageWidth.trim();
    if (trimmedValue === '') {
      void toggleSetting("mls_image_width", null);
      return;
    }

    const numericValue = Number(trimmedValue);
    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 10000) {
      sonnerToast.error('Enter an MLS image width between 1 and 10000 pixels.');
      setMlsImageWidth(resolveMlsImageWidth(shoot));
      return;
    }

    void toggleSetting("mls_image_width", numericValue).catch(() => {
      setMlsImageWidth(resolveMlsImageWidth(shoot));
    });
  };

  // ---------- render ----------
  return (
    <div className="space-y-6 w-full">
      {canManageFeaturedShoot && (() => {
        const featuredAvailable = ['ready', 'delivered'].includes(normalizedStatus);
        const featuredDisabled = !featuredAvailable || savingToggleKey === 'is_featured';

        return (
          <div className="border rounded-lg p-3.5">
            <div className={`flex items-center justify-between gap-4 ${!featuredAvailable ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Featured Shoot</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {featuredAvailable
                    ? 'Use this shoot as the public featured hero source.'
                    : 'Available once the shoot reaches Ready or Delivered status.'}
                </div>
              </div>
              <Switch
                checked={isFeaturedShoot}
                onCheckedChange={(checked: boolean) => {
                  if (!featuredAvailable) return;
                  const previousValue = isFeaturedShoot;
                  setIsFeaturedShoot(checked);
                  void updateFeaturedSetting(checked).catch(() => {
                    setIsFeaturedShoot(previousValue);
                  });
                }}
                disabled={featuredDisabled}
                className="flex-shrink-0"
              />
            </div>
          </div>
        );
      })()}

      {canManageFeaturedShoot && (
        <div className="border rounded-lg p-3.5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Homepage Hero</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Configure the text and ordered image set the public site reads from this featured shoot.
              </div>
            </div>
            {PUBLIC_SITE_URL ? (
              <Button variant="outline" size="sm" asChild className="h-8 flex-shrink-0">
                <a href={PUBLIC_SITE_URL} target="_blank" rel="noreferrer">
                  Preview on site <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="featured-homepage-title" className="text-xs">Title</Label>
              <Input
                id="featured-homepage-title"
                value={featuredTitle}
                onChange={(event) => setFeaturedTitle(event.target.value)}
                placeholder={(shoot as any)?.location?.address || (shoot as any)?.address || 'Modern Arlington Townhouse'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="featured-homepage-location" className="text-xs">Location</Label>
              <Input
                id="featured-homepage-location"
                value={featuredLocation}
                onChange={(event) => setFeaturedLocation(event.target.value)}
                placeholder={[(shoot as any)?.location?.city || (shoot as any)?.city, (shoot as any)?.location?.state || (shoot as any)?.state].filter(Boolean).join(', ') || 'Arlington, VA'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="featured-homepage-subtitle" className="text-xs">Subtitle</Label>
              <Input
                id="featured-homepage-subtitle"
                value={featuredSubtitle}
                onChange={(event) => setFeaturedSubtitle(event.target.value)}
                placeholder="Twilight + Drone"
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="featured-homepage-cta-label" className="text-xs">CTA Label</Label>
                <Input
                  id="featured-homepage-cta-label"
                  value={featuredCtaLabel}
                  onChange={(event) => setFeaturedCtaLabel(event.target.value)}
                  placeholder="See the shoot"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="featured-homepage-cta-href" className="text-xs">CTA Href</Label>
                <Input
                  id="featured-homepage-cta-href"
                  value={featuredCtaHref}
                  onChange={(event) => setFeaturedCtaHref(event.target.value)}
                  placeholder="/projects/modern-arlington"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs">Hero Images</Label>
              <span className="text-[11px] text-muted-foreground">{featuredImages.length}/6 selected</span>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {availableHomepageImages.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  Upload edited image media to this shoot before selecting homepage hero images.
                </div>
              ) : availableHomepageImages.map((file) => {
                const selected = selectedFeaturedImageIds.has(file.id);
                const draft = featuredImages.find((image) => image.shoot_file_id === file.id);

                return (
                  <div key={file.id} className="rounded-md border p-2">
                    <div className="flex gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => toggleFeaturedImage(file.id, event.target.checked)}
                        className="mt-8 h-4 w-4 flex-shrink-0 accent-primary"
                        aria-label={`Select ${file.filename} for homepage hero`}
                      />
                      <img
                        src={file.preview}
                        alt={file.filename}
                        className="h-20 w-28 flex-shrink-0 rounded object-cover"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="truncate text-xs font-medium">{file.filename}</div>
                        {selected && draft ? (
                          <div className="grid gap-2 sm:grid-cols-[72px_minmax(0,1fr)_112px]">
                            <Input
                              type="number"
                              min={1}
                              max={6}
                              value={draft.sort}
                              onChange={(event) => updateFeaturedImage(file.id, { sort: Number(event.target.value) || 1 })}
                              aria-label="Hero image sort order"
                              className="h-8 text-xs"
                            />
                            <Input
                              value={draft.alt}
                              onChange={(event) => updateFeaturedImage(file.id, { alt: event.target.value })}
                              placeholder="Alt text"
                              className="h-8 text-xs"
                            />
                            <Input
                              value={draft.focal}
                              onChange={(event) => updateFeaturedImage(file.id, { focal: event.target.value })}
                              placeholder="50% 35%"
                              className="h-8 text-xs"
                            />
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">Select to set order, alt text, and focal point.</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={saveFeaturedHeroSettings}
              disabled={isSavingFeaturedHero}
            >
              {isSavingFeaturedHero ? 'Saving...' : 'Save Homepage Hero'}
            </Button>
          </div>
        </div>
      )}

      {/* Private Exclusive Toggle */}
      {canManagePrivateExclusive && (
        <div className="border rounded-lg p-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Private Exclusive</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Share this Private Exclusive listing with R/E Pro Photos clients
              </div>
              {!eligibleForPrivateExclusive && (
                <div className="text-xs text-muted-foreground mt-2">
                  Available only for delivered/completed shoots.
                </div>
              )}
            </div>
            <Switch
              checked={isPrivateExclusive}
              onCheckedChange={(checked: boolean) => {
                if (!eligibleForPrivateExclusive) return;
                const prev = isPrivateExclusive;
                setIsPrivateExclusive(checked);
                toggleSetting('is_private_listing', checked).catch(() => {
                  setIsPrivateExclusive(prev);
                });
              }}
              disabled={!eligibleForPrivateExclusive || savingToggleKey === 'is_private_listing'}
              className="flex-shrink-0"
            />
          </div>
        </div>
      )}

      {(isAdmin || isClient) && (
        <div className="border rounded-lg p-3.5 space-y-3">
          <div className="text-sm font-medium">Timezone</div>
          <div className="space-y-2">
            <Label htmlFor="timezone" className="text-xs">Timezone</Label>
            <Select
              value={timezone}
              onValueChange={(value) => {
                const previousTimezone = timezone;
                setTimezone(value);
                void toggleSetting("timezone", value).catch(() => {
                  setTimezone(previousTimezone);
                });
              }}
              disabled={savingToggleKey === 'timezone'}
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
      )}

      {canManageGhostUsersResolved && (
        <div className="border rounded-lg p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">Ghost User(s)</div>
                <Badge variant="outline" className="px-1.5 text-[10px]">
                  {selectedGhostClients.length}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Grant delivered-view access for this shoot and its tours to selected clients.
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => setGhostUserPickerOpen(true)}
              disabled={savingToggleKey === 'ghost_user_ids'}
            >
              Add new ghost user
            </Button>
          </div>

          {selectedGhostClients.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedGhostClients.map((client) => (
                <Badge key={client.id} variant="secondary" className="gap-1 pr-1">
                  <span>{client.name}</span>
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-black/10"
                    onClick={() => handleGhostUsersChange(selectedGhostUserIds.filter((id) => id !== client.id))}
                    disabled={savingToggleKey === 'ghost_user_ids'}
                    aria-label={`Remove ${client.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-xs text-muted-foreground">
              No ghost users selected.
            </div>
          )}

          <Dialog open={ghostUserPickerOpen} onOpenChange={setGhostUserPickerOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Choose client</DialogTitle>
                <DialogDescription>
                  Search and select clients for delivered-view access. Changes save automatically.
                </DialogDescription>
              </DialogHeader>
              <MultiSelectChecklist
                options={ghostClientChecklistOptions}
                value={selectedGhostUserIds}
                onChange={handleGhostUsersChange}
                placeholder="No ghost users selected."
                searchPlaceholder="Search clients..."
                emptyMessage="No client accounts available."
                disabled={savingToggleKey === 'ghost_user_ids'}
                maxHeightClassName="max-h-[55vh]"
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Settings */}
      {isAdmin && (
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Settings</h3>
            
            {/* Downloadable Access */}
            <div className="border rounded-lg p-3.5">
              <div className="space-y-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Downloadable</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Allow clients to download media files
                  </div>
                </div>
                <ToggleGroup
                  type="single"
                  value={downloadableMode}
                  onValueChange={(value) => {
                    if (!value || value === downloadableMode) {
                      return;
                    }
                    void updateDownloadableSetting(value as DownloadableMode);
                  }}
                  disabled={savingToggleKey === "downloadable"}
                  className="grid w-full grid-cols-3 gap-0 overflow-hidden rounded-md border bg-muted/30 p-1"
                >
                  <ToggleGroupItem
                    value="automatic"
                    aria-label="Automatic downloadable access"
                    className="h-9 rounded-sm border-0 text-xs font-medium text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                  >
                    Automatic
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="unlocked"
                    aria-label="Unlocked downloadable access"
                    className="h-9 rounded-sm border-0 text-xs font-medium text-muted-foreground data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:shadow-sm"
                  >
                    Unlocked
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="locked"
                    aria-label="Locked downloadable access"
                    className="h-9 rounded-sm border-0 text-xs font-medium text-muted-foreground data-[state=on]:bg-rose-600 data-[state=on]:text-white data-[state=on]:shadow-sm"
                  >
                    Locked
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {/* Property Details */}
            <div className="border rounded-lg p-3.5 space-y-3">
              <div className="text-sm font-medium">MLS Image Settings</div>
              <div className="space-y-2">
                <Label htmlFor="mls_image_width" className="text-xs">MLS Image Width (px)</Label>
                <Input
                  id="mls_image_width"
                  type="number"
                  placeholder="1920"
                  value={mlsImageWidth}
                  className="h-8 text-xs"
                  min={1}
                  max={10000}
                  onChange={(e) => {
                    setMlsImageWidth(e.target.value);
                  }}
                  onBlur={saveMlsImageWidth}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                  disabled={savingToggleKey === 'mls_image_width'}
                />
              </div>
            </div>

            {/* RE Naming */}
            <div className="border rounded-lg p-3.5 space-y-3">
              <div className="text-sm font-medium">RE Naming</div>
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
        shootAddress={shoot?.location?.fullAddress || shoot?.location?.address}
        shootServices={Array.isArray(shoot?.services) ? shoot.services.map((s: any) => typeof s === 'string' ? s : s?.name || s?.label || String(s)).filter(Boolean) : []}
        clientName={shoot?.client?.name}
        clientEmail={shoot?.client?.email}
      />
    </div>
  );
}

export default ShootSettingsTab;
