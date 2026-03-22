import React, { useState, useEffect, useMemo } from 'react';
import { ShootNotesTab } from '@/components/dashboard/ShootNotesTab';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  CalendarIcon, 
  ClockIcon, 
  MapPinIcon, 
  UserIcon, 
  PhoneIcon, 
  MailIcon,
  CameraIcon,
  Sun,
  CloudRain,
  Cloud,
  Snowflake,
  UserPlus,
  Search,
  ArrowUpDown,
  Loader2,
  MapPin,
  Save,
  XCircle,
  X,
  Key,
  UserCheck,
  Link2,
  BedDouble,
  ShowerHead,
  Ruler,
  Check,
} from 'lucide-react';
import { format, isValid, parse } from 'date-fns';
import axios from 'axios';
import { ShootData } from '@/types/shoots';
import { WeatherInfo } from '@/services/weatherService';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { calculateDistance, getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { cn } from '@/lib/utils';
import API_ROUTES from '@/lib/api';
import { getStateFullName } from '@/utils/stateUtils';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { getServicePricingForSqft } from '@/utils/servicePricing';
import {
  getShootPhotographerAssignmentGroups,
  normalizeShootServiceCategoryKey,
} from '@/utils/shootPhotographerAssignments';
import { to12Hour } from '@/utils/availabilityUtils';
import AddressLookupField from '@/components/AddressLookupField';

const serviceCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const FLEXIBLE_DATE_FORMATS = [
  'dd-MM-yyyy',
  'MM-dd-yyyy',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
  'yyyy/MM/dd',
  'yyyy.MM.dd',
  'dd.MM.yyyy',
];

const parseFlexibleDate = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  const timestamp = Date.parse(trimmed);
  if (!Number.isNaN(timestamp)) {
    const parsed = new Date(timestamp);
    if (isValid(parsed)) return parsed;
  }
  for (const fmt of FLEXIBLE_DATE_FORMATS) {
    try {
      const parsed = parse(trimmed, fmt, new Date());
      if (isValid(parsed)) return parsed;
    // eslint-disable-next-line no-empty
    } catch {}
  }
  return null;
};

type ServiceOption = {
  id: string;
  name: string;
  price?: number;
  pricing_type?: 'fixed' | 'variable';
  allow_multiple?: boolean;
  sqft_ranges?: Array<{ sqft_from: number; sqft_to: number; duration: number | null; price: number; photographer_pay: number | null }>;
  description?: string;
  category?: { id?: string; name?: string } | string | null;
  photographer_pay?: number | null;
  duration?: number | null;
  [key: string]: unknown;
};

type ServiceCategoryOption = {
  id: string;
  name: string;
  count: number;
};

type PhotographerPickerContext = {
  source: 'edit';
  categoryKey?: string;
  categoryName?: string;
} | null;

type AddressDetailsForLookup = {
  formatted_address?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  property_details?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
};

type PhotographerPickerOption = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  distance?: number;
  distanceFrom?: 'home' | 'previous_shoot';
  previousShootId?: number;
  originAddress?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  availabilitySlots?: Array<{ start_time: string; end_time: string }>;
  netAvailableSlots?: Array<{ start_time: string; end_time: string }>;
  hasAvailability?: boolean;
  shootsCountToday?: number;
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'uncategorized';

const normalizeCategoryName = (value?: string) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'photo' || normalized === 'photos') return 'photos';
  return normalized;
};

const deriveServiceCategoryId = (service: ServiceOption) => {
  const categoryName = typeof service.category === 'string'
    ? service.category
    : service.category?.name;
  const normalizedName = normalizeCategoryName(categoryName);
  if (normalizedName === 'photos') return 'photos';
  if (!service.category) return 'uncategorized';
  if (typeof service.category === 'string') return slugify(normalizedName || service.category);
  if (typeof service.category === 'object') {
    if (service.category.id) return String(service.category.id);
    if (service.category.name) return slugify(normalizedName || service.category.name);
  }
  return 'uncategorized';
};

const deriveServiceCategoryName = (service: ServiceOption) => {
  const categoryName = typeof service.category === 'string'
    ? service.category
    : service.category?.name;
  const normalizedName = normalizeCategoryName(categoryName);
  if (normalizedName === 'photos') return 'Photos';
  if (!service.category) return 'Uncategorized';
  if (typeof service.category === 'string') return service.category;
  return service.category.name || 'Uncategorized';
};

const mapPhotographerPickerOption = (photographer: any): PhotographerPickerOption => ({
  ...photographer,
  id: photographer.id?.toString() || '',
  name: photographer.name || 'Unknown',
  email: photographer.email || '',
  avatar: photographer.avatar || photographer.profile_image || photographer.profile_photo_url,
  address: photographer.address || photographer.metadata?.address || photographer.metadata?.homeAddress,
  city: photographer.city || photographer.metadata?.city,
  state: photographer.state || photographer.metadata?.state,
  zip: photographer.zip || photographer.zipcode || photographer.metadata?.zip || photographer.metadata?.zipcode,
});

const loadPhotographerPickerOptions = async (): Promise<PhotographerPickerOption[]> => {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await axios.get(API_ROUTES.people.adminPhotographers, { headers });
    const data = response.data?.data || response.data || [];
    const formatted = Array.isArray(data) ? data.map(mapPhotographerPickerOption) : [];
    if (formatted.length > 0) {
      return formatted;
    }
  } catch (error) {
    console.warn('[ShootDetailsOverviewTab] Admin photographers endpoint failed, falling back to public list:', error);
  }

  try {
    const response = await axios.get(API_ROUTES.people.photographers);
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data.map(mapPhotographerPickerOption) : [];
  } catch (error) {
    console.error('[ShootDetailsOverviewTab] Public photographers endpoint failed:', error);
    return [];
  }
};

interface ShareLink {
  id: number;
  share_url: string;
  download_count: number;
  created_at: string;
  expires_at: string | null;
  is_expired: boolean;
  is_revoked: boolean;
  is_active: boolean;
  created_by: { id: number; name: string } | null;
}

interface MediaLinksSectionProps {
  shoot: ShootData;
  isEditor: boolean;
  onShootUpdate: () => void;
}

function MediaLinksSection({ shoot, isEditor, onShootUpdate }: MediaLinksSectionProps) {
  const [shareLinks, setShareLinks] = React.useState<ShareLink[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [revoking, setRevoking] = React.useState<number | null>(null);
  const { toast } = useToast();

  // Fetch share links
  React.useEffect(() => {
    const fetchShareLinks = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/share-links`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setShareLinks(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch share links:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (isEditor) {
      fetchShareLinks();
    }
  }, [shoot.id, isEditor]);

  const handleRevokeLink = async (linkId: number) => {
    try {
      setRevoking(linkId);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/share-links/${linkId}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      
      if (res.ok) {
        setShareLinks(prev => prev.map(link => 
          link.id === linkId ? { ...link, is_revoked: true, is_active: false } : link
        ));
        toast({
          title: 'Link revoked',
          description: 'Share link has been revoked successfully.',
        });
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to revoke link');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke share link',
        variant: 'destructive',
      });
    } finally {
      setRevoking(null);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Copied!',
        description: 'Share link copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  const activeLinks = shareLinks.filter(link => link.is_active);
  const inactiveLinks = shareLinks.filter(link => !link.is_active);

  return (
    <div className="p-2.5 border rounded-lg bg-card">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Media Links</span>
      </div>
      <div className="space-y-2 text-xs">
        {/* Dropbox Links */}
        {(shoot as any).dropbox_raw_folder && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">RAW Photos:</span>
            <a 
              href={(shoot as any).dropbox_raw_folder} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              <span>Open Dropbox</span>
              <Link2 className="h-3 w-3" />
            </a>
          </div>
        )}
        
        {/* Generated Share Links */}
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : shareLinks.length > 0 ? (
          <div className="space-y-1.5 pt-1 border-t">
            <span className="text-muted-foreground block text-[10px] uppercase">Generated Share Links:</span>
            
            {/* Active Links */}
            {activeLinks.map((link) => (
              <div key={link.id} className="p-1.5 border rounded bg-muted/30 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <span className="text-green-600 text-[10px] font-medium">Active</span>
                    <span className="text-muted-foreground text-[10px]">•</span>
                    <span className="text-[10px] text-muted-foreground">{link.download_count} downloads</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => copyToClipboard(link.share_url)}
                      title="Copy link"
                    >
                      <Link2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-red-600 hover:text-red-700"
                      onClick={() => handleRevokeLink(link.id)}
                      disabled={revoking === link.id}
                      title="Revoke link"
                    >
                      {revoking === link.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {link.expires_at ? `Expires: ${formatDate(link.expires_at)}` : 'Lifetime link'}
                </div>
              </div>
            ))}
            
            {/* Inactive/Revoked Links */}
            {inactiveLinks.length > 0 && (
              <details className="text-[10px]">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                  {inactiveLinks.length} inactive link(s)
                </summary>
                <div className="space-y-1 mt-1">
                  {inactiveLinks.map((link) => (
                    <div key={link.id} className="p-1.5 border rounded bg-muted/20 opacity-60">
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-medium ${link.is_revoked ? 'text-red-600' : 'text-orange-600'}`}>
                          {link.is_revoked ? 'Revoked' : 'Expired'}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">{link.download_count} downloads</span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground text-[10px] pt-1 border-t">
            No share links generated yet. Use the "Share Link" button in the header to create one.
          </div>
        )}
      </div>
    </div>
  );
}

interface ShootDetailsOverviewTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  shouldHideClientDetails?: boolean;
  role: string;
  onShootUpdate: () => void;
  weather?: WeatherInfo | null;
  isEditMode?: boolean;
  onSave?: (updates: Partial<ShootData>) => void;
  onCancel?: () => void;
  onRegisterEditActions?: (actions: { save: () => void; cancel: () => void }) => void;
}

export function ShootDetailsOverviewTab({
  shoot,
  isAdmin,
  isPhotographer,
  isEditor,
  isClient,
  shouldHideClientDetails = false,
  role,
  onShootUpdate,
  weather,
  isEditMode = false,
  onSave,
  onCancel,
  onRegisterEditActions,
}: ShootDetailsOverviewTabProps) {
  const { toast } = useToast();
  const { formatTemperature, formatTime: formatTimePreference, formatDate: formatDatePreference } = useUserPreferences();
  
  // Edit mode state
  const [editedShoot, setEditedShoot] = useState<Partial<ShootData>>({});
  const [taxAmountDirty, setTaxAmountDirty] = useState(false);
  
  // For edit mode - clients and services
  const [clients, setClients] = useState<Array<{ id: string; name: string; email: string; company?: string }>>(() => {
    if (shoot.client) {
      return [{
        id: String(shoot.client.id),
        name: shoot.client.name || '',
        email: shoot.client.email || '',
        company: shoot.client.company || '',
      }];
    }
    return [];
  });
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    return shoot.client ? String(shoot.client.id) : '';
  });
  const [editPhotographers, setEditPhotographers] = useState<PhotographerPickerOption[]>([]);
  const [selectedPhotographerIdEdit, setSelectedPhotographerIdEdit] = useState<string>(() => {
    return shoot.photographer ? String(shoot.photographer.id) : '';
  });
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [photographerSearchOpen, setPhotographerSearchOpen] = useState(false);
  const [perCategoryPhotographers, setPerCategoryPhotographers] = useState<Record<string, string>>({});
  const [perCategoryPopoverOpen, setPerCategoryPopoverOpen] = useState<Record<string, boolean>>({});
  const [servicesList, setServicesList] = useState<ServiceOption[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [servicePrices, setServicePrices] = useState<Record<string, string>>({});
  const [servicePhotographerPays, setServicePhotographerPays] = useState<Record<string, string>>({});
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [servicePanelCategory, setServicePanelCategory] = useState<string>('all');
  const [serviceModalSearch, setServiceModalSearch] = useState('');
  const [presenceOption, setPresenceOption] = useState<'self' | 'other' | 'lockbox'>('self');
  const [lockboxCode, setLockboxCode] = useState('');
  const [lockboxLocation, setLockboxLocation] = useState('');
  const [accessContactName, setAccessContactName] = useState('');
  const [accessContactPhone, setAccessContactPhone] = useState('');
  const [propertyMetricsEdit, setPropertyMetricsEdit] = useState<{ beds: string; baths: string; sqft: string }>({
    beds: '',
    baths: '',
    sqft: '',
  });
  const [addressInput, setAddressInput] = useState('');
  const photographerAssignments = useMemo(
    () => getShootPhotographerAssignmentGroups(shoot),
    [shoot],
  );

  const toNumberOrUndefined = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : undefined;
  };

  const formatEditableValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(value);
    return Number.isNaN(num) ? String(value) : String(num);
  };

  const initializeMetricsFromShoot = () => {
    const pd = shoot.propertyDetails || (shoot as any).property_details || {};
    setPropertyMetricsEdit({
      beds: formatEditableValue(
        pd.beds ??
        pd.bedrooms ??
        pd.bed ??
        (shoot as any).beds ??
        (shoot as any).bedrooms ??
        '',
      ),
      baths: formatEditableValue(
        pd.baths ??
        pd.bathrooms ??
        pd.bath ??
        (shoot as any).baths ??
        (shoot as any).bathrooms ??
        '',
      ),
      sqft: formatEditableValue(
        pd.sqft ??
        pd.squareFeet ??
        pd.square_feet ??
        (shoot as any).sqft ??
        (shoot as any).squareFeet ??
        (shoot as any).square_feet ??
        (shoot as any).livingArea ??
        (shoot as any).living_area ??
        '',
      ),
    });
  };

  const deriveMetricsFromAddress = (details: AddressDetailsForLookup) => {
    const pd = details.property_details || {};
    const bedrooms =
      details.bedrooms ??
      pd.beds ??
      pd.bedrooms ??
      pd.bed;
    const bathrooms =
      details.bathrooms ??
      (details as any).baths ??
      pd.baths ??
      pd.bathrooms ??
      pd.bath;
    const sqftVal =
      details.sqft ??
      pd.sqft ??
      (pd as any).livingArea ??
      (pd as any).living_area ??
      pd.squareFeet ??
      pd.square_feet;
    return { bedrooms, bathrooms, sqft: sqftVal };
  };

  const handleAddressSelect = (details: AddressDetailsForLookup) => {
    const mergedAddress = details.address || details.formatted_address || '';
    setAddressInput(mergedAddress);
    updateField('location.address', mergedAddress);
    updateField('location.fullAddress', details.formatted_address || mergedAddress);
    if (details.city) updateField('location.city', details.city);
    if (details.state) updateField('location.state', details.state);
    if (details.zip) updateField('location.zip', details.zip);
    if (details.latitude) updateField('location.latitude', details.latitude);
    if (details.longitude) updateField('location.longitude', details.longitude);

    const derived = deriveMetricsFromAddress(details);
    setPropertyMetricsEdit({
      beds: formatEditableValue(derived.bedrooms),
      baths: formatEditableValue(derived.bathrooms),
      sqft: formatEditableValue(derived.sqft),
    });
  };
  
  // Search states
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  
  // Fetch clients and services when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      // Fetch clients
      const fetchClients = async () => {
        try {
          const token = localStorage.getItem('authToken') || localStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}/api/admin/clients`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          });
          if (res.ok) {
            const json = await res.json();
            const clientsList = (json.data || json || []).map((c: any) => ({
              id: String(c.id),
              name: c.name,
              email: c.email || '',
              company: c.company_name || c.company || '',
            }));
            const currentClient = shoot.client;
            if (currentClient && !clientsList.some((c) => c.id === String(currentClient.id))) {
              clientsList.unshift({
                id: String(currentClient.id),
                name: currentClient.name || 'Current client',
                email: currentClient.email || '',
                company: currentClient.company || '',
              });
            }
            setClients(clientsList);
          }
        } catch (error) {
          console.error('Error fetching clients:', error);
        }
      };

      // Fetch services
      const fetchServices = async () => {
        try {
          const token = localStorage.getItem('authToken') || localStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}/api/services`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          });
          if (res.ok) {
            const json = await res.json();
            const servicesData = (json.data || json || []).map((s: any) => ({
              id: String(s.id),
              name: s.name,
              price: Number(s.price) || 0,
              pricing_type: s.pricing_type || 'fixed',
              allow_multiple: s.allow_multiple ?? false,
              sqft_ranges: (s.sqft_ranges || s.sqftRanges || []).map((r: any) => ({
                ...r,
                sqft_from: Number(r.sqft_from) || 0,
                sqft_to: Number(r.sqft_to) || 0,
                price: Number(r.price) || 0,
                photographer_pay: r.photographer_pay != null ? Number(r.photographer_pay) : null,
                duration: r.duration != null ? Number(r.duration) : null,
              })),
              category: s.category || s.service_category || null,
              description: s.description || '',
              photographer_pay: s.photographer_pay != null ? Number(s.photographer_pay) : null,
              duration: s.duration != null ? Number(s.duration) : null,
            }));
            setServicesList(servicesData);
            
            // Initialize selected services from current shoot
            // Prefer serviceObjects (full data with prices) over services (name strings)
            const serviceSource: any[] = shoot.serviceObjects && shoot.serviceObjects.length > 0
              ? shoot.serviceObjects
              : (Array.isArray(shoot.services) ? shoot.services : []);
            if (serviceSource.length > 0 && servicesData.length > 0) {
              const currentServiceIds = serviceSource.map((s: any) => {
                if (typeof s === 'string') {
                  // If it's a string, try to find matching service by name
                  const found = servicesData.find((sv: any) => sv.name === s);
                  return found ? found.id : null;
                }
                // If it's an object, try to get id
                if (s && typeof s === 'object') {
                  return String(s.id || s.service_id || '');
                }
                return null;
              }).filter(Boolean) as string[];
              setSelectedServiceIds(currentServiceIds);
              
              // Initialize prices and photographer pays from current services
              const prices: Record<string, string> = {};
              const photographerPays: Record<string, string> = {};
              serviceSource.forEach((s: any) => {
                if (s && typeof s === 'object') {
                  const serviceId = String(s.id || s.service_id || '');
                  if (serviceId && currentServiceIds.includes(serviceId)) {
                    const serviceRecord = servicesData.find((service) => service.id === serviceId);
                    const basePrice = serviceRecord
                      ? resolveServicePrice(serviceRecord, effectiveSqft).basePrice
                      : Number(s.price ?? 0);
                    const normalizedBasePrice = Number.isFinite(basePrice) ? basePrice : 0;
                    const rawPrice = s.price;
                    const parsedPrice =
                      rawPrice === null || rawPrice === undefined || rawPrice === ''
                        ? NaN
                        : Number(rawPrice);
                    const shouldUsePrice =
                      Number.isFinite(parsedPrice)
                      && (
                        (normalizedBasePrice === 0 && parsedPrice > 0)
                        || (normalizedBasePrice > 0 && Math.abs(parsedPrice - normalizedBasePrice) > 0.01)
                      );
                    if (shouldUsePrice) {
                      prices[serviceId] = String(parsedPrice);
                    }
                    if (s.photographer_pay !== undefined && s.photographer_pay !== null) {
                      photographerPays[serviceId] = String(s.photographer_pay);
                    }
                  }
                }
              });
              setServicePrices(prices);
              setServicePhotographerPays(photographerPays);
            }
          }
        } catch (error) {
          console.error('Error fetching services:', error);
        }
      };

      // Fetch photographers for edit mode
      const fetchPhotographers = async () => {
        try {
          const photographersList = await loadPhotographerPickerOptions();
          const nextPhotographers = [...photographersList];
          const currentPhotographer = shoot.photographer;
          if (currentPhotographer && !nextPhotographers.some((p) => p.id === String(currentPhotographer.id))) {
            nextPhotographers.unshift(mapPhotographerPickerOption(currentPhotographer));
          }
          console.log('[ShootDetailsOverviewTab] Loaded photographers for edit mode:', nextPhotographers.length);
          setEditPhotographers(nextPhotographers);
        } catch (error) {
          console.error('Error fetching photographers:', error);
          setEditPhotographers([]);
        }
      };

      fetchClients();
      fetchServices();
      fetchPhotographers();
    }
  }, [isEditMode, shoot]);

  // Initialize edited shoot when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      setEditedShoot({
        scheduledDate: formatDateForInput(shoot.scheduledDate),
        time: shoot.time,
        location: {
          address: shoot.location?.address || '',
          city: shoot.location?.city || '',
          state: shoot.location?.state || '',
          zip: shoot.location?.zip || '',
          fullAddress: shoot.location?.fullAddress || '',
        },
        client: shoot.client ? {
          ...shoot.client,
        } : undefined,
        photographer: shoot.photographer ? {
          ...shoot.photographer,
        } : undefined,
        payment: shoot.payment ? {
          ...shoot.payment,
        } : undefined,
      });
      setAddressInput(
        shoot.location?.address ||
        shoot.location?.fullAddress ||
        (shoot as any).address ||
        ''
      );
      initializeMetricsFromShoot();
      // Initialize selected IDs
      if (shoot.client) {
        setSelectedClientId(String(shoot.client.id));
      }
      if (shoot.photographer) {
        setSelectedPhotographerIdEdit(String(shoot.photographer.id));
      }
      // Initialize per-category photographer assignments from services
      const catPhotogMap: Record<string, string> = {};
      for (const group of photographerAssignments.groups) {
        const photographerId = group.photographer?.id;
        if (photographerId != null && !catPhotogMap[group.key]) {
          catPhotogMap[group.key] = String(photographerId);
        }
      }
      setPerCategoryPhotographers(catPhotogMap);
      setTaxAmountDirty(false);
    }
  }, [isEditMode, photographerAssignments.groups, shoot]);
  
  // Update edited shoot field - with proper deep cloning
  const updateField = (field: string, value: unknown) => {
    setEditedShoot(prev => {
      const keys = field.split('.');
      // Deep clone the entire previous state to avoid mutation
      const newState = JSON.parse(JSON.stringify(prev));
      let current: any = newState;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        } else {
          // Deep clone nested objects to avoid mutation
          current[keys[i]] = { ...current[keys[i]] };
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newState;
    });
  };
  
  // Handle save
  const handleSave = () => {
    if (onSave) {
      const updates = { ...editedShoot };
      const basePropertyDetails = {
        ...(shoot.propertyDetails || (shoot as any).property_details || {}),
        ...(updates.propertyDetails || {}),
      };

      const bedsValue = toNumberOrUndefined(propertyMetricsEdit.beds);
      const bathsValue = toNumberOrUndefined(propertyMetricsEdit.baths);
      const sqftValue = toNumberOrUndefined(propertyMetricsEdit.sqft);

      if (bedsValue !== undefined) {
        basePropertyDetails.beds = bedsValue;
        basePropertyDetails.bedrooms = bedsValue;
      }
      if (bathsValue !== undefined) {
        basePropertyDetails.baths = bathsValue;
        basePropertyDetails.bathrooms = bathsValue;
      }
      if (sqftValue !== undefined) {
        basePropertyDetails.sqft = sqftValue;
        basePropertyDetails.squareFeet = sqftValue;
      }

      updates.propertyDetails = {
        ...basePropertyDetails,
        presenceOption,
        lockboxCode: presenceOption === 'lockbox' ? lockboxCode || undefined : undefined,
        lockboxLocation: presenceOption === 'lockbox' ? lockboxLocation || undefined : undefined,
        accessContactName: presenceOption === 'other' ? accessContactName || undefined : undefined,
        accessContactPhone: presenceOption === 'other' ? accessContactPhone || undefined : undefined,
      };
      
      // Ensure client and photographer IDs are numbers
      if (updates.client?.id !== undefined && updates.client.id !== null) {
        const clientId = typeof updates.client.id === 'string' 
          ? parseInt(updates.client.id, 10) 
          : Number(updates.client.id);
        if (!isNaN(clientId) && clientId > 0) {
          updates.client = {
            ...updates.client,
            id: clientId,
          };
        } else {
          console.warn('⚠️ Invalid client ID:', updates.client.id);
        }
      }
      if (updates.photographer?.id !== undefined && updates.photographer.id !== null) {
        const photographerId = typeof updates.photographer.id === 'string' 
          ? parseInt(updates.photographer.id, 10) 
          : Number(updates.photographer.id);
        if (!isNaN(photographerId) && photographerId > 0) {
          console.log('📸 Converting photographer ID to number:', { 
            original: updates.photographer.id, 
            converted: photographerId 
          });
          updates.photographer = {
            ...updates.photographer,
            id: photographerId,
          };
        } else {
          console.warn('⚠️ Invalid photographer ID:', updates.photographer.id);
          // Don't send invalid photographer ID
          delete updates.photographer;
        }
      }
      
      const sqftForPricing =
        sqftValue ??
        basePropertyDetails.sqft ??
        (basePropertyDetails as any).squareFeet ??
        (basePropertyDetails as any).square_feet ??
        (shoot as any).sqft ??
        (shoot as any).squareFeet ??
        (shoot as any).square_feet ??
        (shoot as any).livingArea ??
        (shoot as any).living_area ??
        null;
      
      // Include selected services with prices and photographer pays
      if (selectedServiceIds.length > 0) {
        updates.services = selectedServiceIds.map(id => {
          const service = servicesList.find(s => s.id === id);
          const resolvedPrice = service
            ? resolveServicePrice(service, sqftForPricing, servicePrices[id]).price
            : 0;
          const serviceData: any = {
            id: Number(id),
            price: resolvedPrice,
            quantity: 1,
          };
          if (servicePhotographerPays[id]) {
            serviceData.photographer_pay = parseFloat(servicePhotographerPays[id]);
          }
          return serviceData;
        });
      }

      // Build per-service photographer assignments from perCategoryPhotographers
      const normCatKey = (name: string) => name.trim().toLowerCase().replace(/s$/, '');
      const servicePhotographerAssignments: Array<{ service_id: number; photographer_id: number }> = [];
      if (Object.keys(perCategoryPhotographers).length > 0 && selectedServiceIds.length > 0) {
        for (const svcId of selectedServiceIds) {
          const service = servicesList.find(s => s.id === svcId);
          if (!service) continue;
          const catName = deriveServiceCategoryName(service);
          const catKey = normCatKey(catName);
          const photogId = perCategoryPhotographers[catKey];
          if (photogId) {
            servicePhotographerAssignments.push({
              service_id: Number(svcId),
              photographer_id: Number(photogId),
            });
          }
        }
      }
      if (servicePhotographerAssignments.length > 0) {
        (updates as any).service_photographers = servicePhotographerAssignments;
      }
      
      onSave(updates);
    }
  };

  // Register handlers with parent when edit mode
  useEffect(() => {
    if (isEditMode && onRegisterEditActions) {
      onRegisterEditActions({
        save: handleSave,
        cancel: onCancel || (() => {}),
      });
    }
  }, [isEditMode, onRegisterEditActions, handleSave, onCancel]);
  
  // Handle cancel
  const handleCancel = () => {
    setEditedShoot({});
    setClientSearchQuery('');
    setServiceSearchQuery('');
    if (onCancel) {
      onCancel();
    }
  };

  // Filtered lists for search
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery) return clients;
    const query = clientSearchQuery.toLowerCase();
    return clients.filter((client) => 
      client.name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      (client.company && client.company.toLowerCase().includes(query))
    );
  }, [clients, clientSearchQuery]);

  const filteredServices = useMemo(() => {
    if (!serviceSearchQuery) return servicesList;
    const query = serviceSearchQuery.toLowerCase();
    return servicesList.filter((service) =>
      service.name.toLowerCase().includes(query)
    );
  }, [servicesList, serviceSearchQuery]);

  // Derive service categories for modal
  const serviceCategoryOptions = useMemo<ServiceCategoryOption[]>(() => {
    if (!servicesList.length) return [];
    const map = new Map<string, ServiceCategoryOption>();
    servicesList.forEach((service) => {
      const id = deriveServiceCategoryId(service);
      const name = deriveServiceCategoryName(service);
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(id, { id, name, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [servicesList]);

  // Filter services by selected category
  const panelServices = useMemo(() => {
    if (!servicesList.length) return [];
    let filtered = servicesList;
    if (servicePanelCategory) {
      filtered = servicesList.filter((s) => deriveServiceCategoryId(s) === servicePanelCategory);
    }
    if (serviceModalSearch) {
      const query = serviceModalSearch.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(query));
    }
    return filtered;
  }, [servicesList, servicePanelCategory, serviceModalSearch]);
  
  useEffect(() => {
    if (!serviceCategoryOptions.length) return;
    const exists = serviceCategoryOptions.some((category) => category.id === servicePanelCategory);
    if (!exists) {
      setServicePanelCategory(serviceCategoryOptions[0].id);
    }
  }, [serviceCategoryOptions, servicePanelCategory]);

  // Get sqft for variable pricing
  const effectiveSqft = useMemo(() => {
    const rawSqft = isEditMode
      ? propertyMetricsEdit.sqft
      : (shoot as any).propertyDetails?.sqft ??
        (shoot as any).property_details?.sqft ??
        (shoot as any).sqft ??
        (shoot as any).squareFeet ??
        (shoot as any).square_feet ??
        (shoot as any).livingArea ??
        (shoot as any).living_area ??
        null;
    if (rawSqft === '' || rawSqft === null || rawSqft === undefined) return null;
    const parsed = Number(rawSqft);
    return Number.isFinite(parsed) ? parsed : null;
  }, [isEditMode, propertyMetricsEdit.sqft, shoot]);

  const resolveServicePrice = (
    service: ServiceOption,
    sqft: number | null,
    overrideValue?: string,
  ) => {
    const serviceWithPrice = { ...service, price: service.price ?? 0 };
    const pricingInfo = sqft && service.pricing_type === 'variable' && service.sqft_ranges?.length
      ? getServicePricingForSqft(serviceWithPrice, sqft)
      : null;
    const rawBasePrice = Number(pricingInfo?.price ?? service.price ?? 0);
    const basePrice = Number.isFinite(rawBasePrice) ? rawBasePrice : 0;
    const parsedOverride = overrideValue !== undefined && overrideValue !== '' ? Number(overrideValue) : NaN;
    const hasOverride = Number.isFinite(parsedOverride)
      && ((basePrice === 0 && parsedOverride > 0) || (basePrice > 0 && Math.abs(parsedOverride - basePrice) > 0.01));

    return {
      price: hasOverride ? parsedOverride : basePrice,
      basePrice,
      hasOverride,
    };
  };

  const [assignPhotographerOpen, setAssignPhotographerOpen] = useState(false);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<string>('');
  const [photographerPickerContext, setPhotographerPickerContext] =
    useState<PhotographerPickerContext>(null);
  const [photographers, setPhotographers] = useState<PhotographerPickerOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  
  // Check if user is admin or rep
  const isAdminOrRep = isAdmin || role === 'rep' || role === 'representative';

  // Get shoot location for distance calculation
  const getShootLocation = () => {
    const editedLocation = isEditMode ? editedShoot.location : undefined;
    const address =
      (typeof editedLocation?.address === 'string' ? editedLocation.address : undefined)
      || shoot.location?.address
      || (shoot as any).address
      || '';
    const city =
      (typeof editedLocation?.city === 'string' ? editedLocation.city : undefined)
      || shoot.location?.city
      || (shoot as any).city
      || '';
    const state =
      (typeof editedLocation?.state === 'string' ? editedLocation.state : undefined)
      || shoot.location?.state
      || (shoot as any).state
      || '';
    const zip =
      (typeof editedLocation?.zip === 'string' ? editedLocation.zip : undefined)
      || shoot.location?.zip
      || (shoot as any).zip
      || '';
    return { address, city, state, zip };
  };

  const formatLocationLabel = (location?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  }) => {
    if (!location) return '';
    const parts = [location.address, location.city, location.state, location.zip]
      .filter((part) => part && String(part).trim().length > 0);
    return parts.join(', ');
  };

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    if (!Number.isFinite(hours)) return 0;
    return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
  };

  const buildAvailabilitySegments = (
    slots: Array<{ start_time: string; end_time: string }> = [],
  ) => {
    const startHour = 8;
    const endHour = 20;
    const segments: boolean[] = [];
    for (let hour = startHour; hour < endHour; hour += 1) {
      const segmentStart = hour * 60;
      const segmentEnd = (hour + 1) * 60;
      const hasSlot = slots.some((slot) => {
        const slotStart = timeToMinutes(slot.start_time);
        const slotEnd = timeToMinutes(slot.end_time);
        return slotStart < segmentEnd && slotEnd > segmentStart;
      });
      segments.push(hasSlot);
    }
    return segments;
  };

  const formatAvailabilitySummary = (
    slots: Array<{ start_time: string; end_time: string }> = [],
  ) => slots
    .slice(0, 3)
    .map((slot) => `${to12Hour(slot.start_time)}–${to12Hour(slot.end_time)}`)
    .join(', ');

  const fallbackAssignedPhotographers = useMemo(() => {
    const fallback = new Map<string, PhotographerPickerOption>();
    const addPhotographer = (photographer?: any | null) => {
      if (!photographer?.id) return;
      const mapped = mapPhotographerPickerOption(photographer);
      fallback.set(String(mapped.id), mapped);
    };

    addPhotographer(shoot.photographer);
    photographerAssignments.groups.forEach((group) => addPhotographer(group.photographer));

    return Array.from(fallback.values());
  }, [photographerAssignments.groups, shoot.photographer]);

  const photographerPickerOptions = useMemo(() => {
    if (photographers.length > 0) return photographers;
    if (editPhotographers.length > 0) {
      return editPhotographers.map((photographer) => ({
        ...photographer,
      }));
    }
    return fallbackAssignedPhotographers;
  }, [editPhotographers, fallbackAssignedPhotographers, photographers]);

  // Fetch photographers for assignment
  useEffect(() => {
    if (!assignPhotographerOpen) return;

    if (editPhotographers.length > 0) {
      setPhotographers((prev) => (prev.length > 0 ? prev : editPhotographers.map((photographer) => ({
        ...photographer,
      }))));
    }

    if (!isAdminOrRep && !isEditMode) return;
    
    const fetchPhotographers = async () => {
      try {
        const photographersList = await loadPhotographerPickerOptions();
        if (photographersList.length > 0) {
          setPhotographers(photographersList);
          setEditPhotographers((prev) => (prev.length > 0 ? prev : photographersList));
        }
      } catch (error) {
        console.error('Error fetching photographers:', error);
      }
    };
    
    fetchPhotographers();
  }, [assignPhotographerOpen, editPhotographers, isAdminOrRep, isEditMode]);

  // Calculate distances when dialog opens and shoot location/photographers are available
  useEffect(() => {
    const calculateDistances = async () => {
      if (!assignPhotographerOpen || photographers.length === 0) return;
      
      const shootLocation = getShootLocation();
      if (!shootLocation.address || !shootLocation.city || !shootLocation.state) {
        return; // Can't calculate without location
      }

      setIsCalculatingDistances(true);
      try {
        // Get coordinates for shoot location
        const shootCoords = await getCoordinatesFromAddress(
          shootLocation.address,
          shootLocation.city,
          shootLocation.state,
          shootLocation.zip
        );
        
        if (!shootCoords) {
          setIsCalculatingDistances(false);
          return;
        }

        // Calculate distance for each photographer
        const photographersWithDist = await Promise.all(
          photographers.map(async (photographer) => {
            if (photographer.distance !== undefined && photographer.originAddress) {
              return photographer;
            }

            const sourceAddress = photographer.originAddress?.address || photographer.address;
            const sourceCity = photographer.originAddress?.city || photographer.city;
            const sourceState = photographer.originAddress?.state || photographer.state;
            const sourceZip = photographer.originAddress?.zip || photographer.zip;

            if (!sourceAddress || !sourceCity || !sourceState) {
              return { ...photographer, distance: undefined };
            }

            const photographerCoords = await getCoordinatesFromAddress(
              sourceAddress,
              sourceCity,
              sourceState,
              sourceZip
            );

            if (!photographerCoords) {
              return { ...photographer, distance: undefined };
            }

            const dist = calculateDistance(
              shootCoords.lat,
              shootCoords.lon,
              photographerCoords.lat,
              photographerCoords.lon
            );

            return {
              ...photographer,
              distance: Math.round(dist * 10) / 10, // Round to 1 decimal
            };
          })
        );

        setPhotographers(photographersWithDist);
      } catch (error) {
        console.error('Error calculating distances:', error);
      } finally {
        setIsCalculatingDistances(false);
      }
    };

    calculateDistances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignPhotographerOpen, photographers.length]);

  useEffect(() => {
    if (!assignPhotographerOpen || !isAdminOrRep || photographers.length === 0) return;
    const shootLocation = getShootLocation();
    if (!shootLocation.address || !shootLocation.city || !shootLocation.state) return;

    let isCancelled = false;
    const controller = new AbortController();

    const fetchAvailability = async () => {
      setIsLoadingAvailability(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const now = new Date();
        const res = await fetch(`${API_BASE_URL}/api/photographer/availability/for-booking`, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            date: format(now, 'yyyy-MM-dd'),
            time: format(now, 'h:mm a'),
            shoot_address: shootLocation.address,
            shoot_city: shootLocation.city,
            shoot_state: shootLocation.state,
            shoot_zip: shootLocation.zip || '',
            photographer_ids: photographers.map((p) => Number(p.id)),
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to load availability');
        }

        const json = await res.json();
        if (isCancelled) return;
        const availabilityList = Array.isArray(json.data) ? json.data : [];

        setPhotographers((prev) => prev.map((photographer) => {
          const match = availabilityList.find((item: any) => String(item.id) === String(photographer.id));
          if (!match) return photographer;
          const parsedDistance = typeof match.distance === 'number'
            ? match.distance
            : match.distance
            ? Number(match.distance)
            : photographer.distance;
          return {
            ...photographer,
            distance: Number.isFinite(parsedDistance) ? parsedDistance : photographer.distance,
            distanceFrom: match.distance_from ?? photographer.distanceFrom,
            previousShootId: match.previous_shoot_id ?? photographer.previousShootId,
            originAddress: match.origin_address ?? photographer.originAddress,
            availabilitySlots: match.availability_slots ?? photographer.availabilitySlots,
            netAvailableSlots: match.net_available_slots ?? photographer.netAvailableSlots,
            hasAvailability: match.has_availability ?? photographer.hasAvailability,
            shootsCountToday: match.shoots_count_today ?? photographer.shootsCountToday,
          };
        }));
      } catch (error) {
        console.error('Error fetching photographer availability:', error);
      } finally {
        if (!isCancelled) {
          setIsLoadingAvailability(false);
        }
      }
    };

    fetchAvailability();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [
    assignPhotographerOpen,
    isAdminOrRep,
    photographers.length,
    isEditMode,
    editedShoot.location?.address,
    editedShoot.location?.city,
    editedShoot.location?.state,
    editedShoot.location?.zip,
    shoot.location?.address,
    shoot.location?.city,
    shoot.location?.state,
    shoot.location?.zip,
  ]);

  // Filter and sort photographers
  const filteredAndSortedPhotographers = useMemo(() => {
    let filtered = [...photographerPickerOptions];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query) ||
        p.city?.toLowerCase().includes(query) ||
        p.state?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'distance') {
        // Sort by distance (undefined distances go to end)
        if (a.distance === undefined && b.distance === undefined) return 0;
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      } else {
        // Sort by name
        return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [photographerPickerOptions, searchQuery, sortBy]);

  const resolvePhotographerDetails = (photographerId?: string | null) => {
    if (!photographerId) return null;
    const normalizedId = String(photographerId);

    return (
      photographerPickerOptions.find((photographer) => String(photographer.id) === normalizedId)
      || editPhotographers.find((photographer) => String(photographer.id) === normalizedId)
      || (shoot.photographer && String(shoot.photographer.id) === normalizedId
        ? shoot.photographer
        : null)
    );
  };

  const closePhotographerPicker = () => {
    setAssignPhotographerOpen(false);
    setSearchQuery('');
    setSelectedPhotographerId('');
    setPhotographerPickerContext(null);
  };

  const openEditPhotographerPicker = (
    context: Exclude<PhotographerPickerContext, null>,
  ) => {
    const initialSelection = context.categoryKey
      ? perCategoryPhotographers[context.categoryKey] || selectedPhotographerIdEdit || ''
      : selectedPhotographerIdEdit || '';

    setPhotographerPickerContext(context);
    setSelectedPhotographerId(initialSelection);
    setSearchQuery('');
    setAssignPhotographerOpen(true);
  };

  const editModePhotographerRows = useMemo(() => {
    const groupedRows = photographerAssignments.groups.map((group) => {
      const selectedId =
        perCategoryPhotographers[group.key]
        || group.photographer?.id
        || selectedPhotographerIdEdit
        || '';

      return {
        key: group.key,
        name: group.name,
        photographer: resolvePhotographerDetails(selectedId) || group.photographer || null,
      };
    });

    const fallbackRows =
      groupedRows.length > 0
        ? groupedRows
        : [
            {
              key: 'photographer',
              name: 'Photographer',
              photographer:
                resolvePhotographerDetails(selectedPhotographerIdEdit || shoot.photographer?.id || '')
                || shoot.photographer
                || null,
            },
          ];

    if (!isEditMode || selectedServiceIds.length === 0 || servicesList.length === 0) {
      return fallbackRows;
    }

    const rows = new Map<
      string,
      {
        key: string;
        name: string;
        photographer: ReturnType<typeof resolvePhotographerDetails>;
      }
    >();

    selectedServiceIds.forEach((serviceId) => {
      const service = servicesList.find((item) => item.id === serviceId);
      if (!service) return;

      const categoryName = deriveServiceCategoryName(service);
      const categoryKey = normalizeShootServiceCategoryKey(categoryName);
      const existingGroup = photographerAssignments.groups.find(
        (group) => group.key === categoryKey,
      );
      const selectedId =
        perCategoryPhotographers[categoryKey]
        || existingGroup?.photographer?.id
        || selectedPhotographerIdEdit
        || '';

      rows.set(categoryKey, {
        key: categoryKey,
        name: categoryName,
        photographer:
          resolvePhotographerDetails(selectedId) || existingGroup?.photographer || null,
      });
    });

    return rows.size > 0 ? Array.from(rows.values()) : fallbackRows;
  }, [
    editPhotographers,
    isEditMode,
    perCategoryPhotographers,
    photographerAssignments.groups,
    photographers,
    selectedPhotographerIdEdit,
    selectedServiceIds,
    servicesList,
    shoot.photographer,
  ]);

  // Assign photographer
  const handleAssignPhotographer = async () => {
    if (!selectedPhotographerId) return;
    const selectedPhotographer = resolvePhotographerDetails(selectedPhotographerId);

    if (isEditMode) {
      const nextPhotographer = {
        id: selectedPhotographerId,
        name: selectedPhotographer?.name || 'Selected photographer',
        email: selectedPhotographer?.email || '',
      };

      if (photographerPickerContext?.categoryKey) {
        const { categoryKey, categoryName } = photographerPickerContext;
        setPerCategoryPhotographers((prev) => ({
          ...prev,
          [categoryKey]: selectedPhotographerId,
        }));
        updateField(`perCategoryPhotographers.${categoryKey}`, selectedPhotographerId);

        if (editModePhotographerRows.length === 1) {
          setSelectedPhotographerIdEdit(selectedPhotographerId);
          updateField('photographer', nextPhotographer);
        }

        toast({
          title: 'Photographer updated',
          description: categoryName
            ? `${nextPhotographer.name} is selected for ${categoryName}.`
            : 'Photographer selection updated.',
        });
      } else {
        setSelectedPhotographerIdEdit(selectedPhotographerId);
        updateField('photographer', nextPhotographer);

        toast({
          title: 'Photographer updated',
          description: `${nextPhotographer.name} is selected for this shoot.`,
        });
      }

      closePhotographerPicker();
      return;
    }

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ photographer_id: selectedPhotographerId }),
      });
      
      if (!res.ok) throw new Error('Failed to assign photographer');
      
      toast({
        title: 'Success',
        description: 'Photographer assigned successfully',
      });
      closePhotographerPicker();
      onShootUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign photographer',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Not set';
      return formatDatePreference(date);
    } catch {
      return 'Not set';
    }
  };

  // Helper to format date for HTML date input (YYYY-MM-DD)
  const formatDateForInput = (dateString?: string | null) => {
    if (!dateString) {
      return format(new Date(), 'yyyy-MM-dd');
    }
    try {
      const parsed = parseFlexibleDate(dateString);
      if (!parsed) return format(new Date(), 'yyyy-MM-dd');
      return format(parsed, 'yyyy-MM-dd');
    } catch {
      return format(new Date(), 'yyyy-MM-dd');
    }
  };

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return 'Not set';
    // Use the user preference formatter
    return formatTimePreference(timeString);
  };

  const parsedScheduleDate = useMemo(
    () => parseFlexibleDate(shoot.scheduledDate || (shoot as any).scheduled_date),
    [shoot]
  );
  const scheduleDateDisplay = parsedScheduleDate ? formatDatePreference(parsedScheduleDate) : 'Not scheduled';
  const scheduleTimeDisplay = shoot.time ? formatTime(shoot.time) : null;

  const weatherSource = weather || shoot.weather || (shoot as any).weather || null;
  const rawTemperature = weather?.temperature ?? weatherSource?.temperature ?? (shoot as any).temperature ?? null;
  const weatherDescription = weather?.description ?? weatherSource?.description ?? (shoot as any).weather_description ?? null;
  const weatherIcon = (weather?.icon ?? weatherSource?.icon ?? (shoot as any).weather_icon) as WeatherInfo['icon'] | undefined;
  const formattedTemperature = useMemo(() => {
    // Prefer explicit C/F pair from WeatherInfo
    if (weather && typeof weather.temperatureC === 'number') {
      return formatTemperature(weather.temperatureC, weather.temperatureF);
    }
    if (rawTemperature === null || rawTemperature === undefined) return null;
    const num = typeof rawTemperature === 'number' ? rawTemperature : parseInt(String(rawTemperature).match(/-?\d+/)?.[0] ?? '', 10);
    if (Number.isFinite(num)) return formatTemperature(num);
    return `${rawTemperature}`;
  }, [weather, rawTemperature, formatTemperature]);
  const hasWeatherDetails = Boolean(formattedTemperature || weatherDescription);

  // Get location address - return only street address, not full address with city/state/zip
  const getLocationAddress = () => {
    let address = shoot.location?.address || (shoot as any).address || '';
    
    // If we have city/state/zip, try to strip them from the address to get just street address
    const city = shoot.location?.city || (shoot as any).city || '';
    const state = shoot.location?.state || (shoot as any).state || '';
    const zip = shoot.location?.zip || (shoot as any).zip || '';
    
    if (address && (city || state || zip)) {
      // Remove city, state, zip from the end of address if present
      let streetAddress = address;
      if (city) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${city}\\s*,?`, 'i'), '');
      if (state) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${state}\\s*,?`, 'i'), '');
      if (zip) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${zip}\\s*`, 'i'), '');
      // Clean up any trailing commas or spaces
      streetAddress = streetAddress.replace(/[,\s]+$/, '').trim();
      if (streetAddress) return streetAddress;
    }
    
    if (address) return address;
    if (shoot.location?.fullAddress) return shoot.location.fullAddress;
    return 'Not set';
  };

  // Get location city/state/zip
  const getLocationDetails = () => {
    const city = shoot.location?.city || (shoot as any).city || '';
    const state = shoot.location?.state || (shoot as any).state || '';
    const zip = shoot.location?.zip || (shoot as any).zip || '';
    return { city, state, zip };
  };

  // Get services - handle different data structures
  const getServices = () => {
    if (Array.isArray(shoot.services) && shoot.services.length > 0) {
      return shoot.services;
    }
    // Check if service is a single object
    if ((shoot as any).service) {
      const service = (shoot as any).service;
      if (typeof service === 'string') return [service];
      if (service.name) return [service.name];
      if (Array.isArray(service)) return service;
    }
    // Check if services is a string
    if (typeof shoot.services === 'string' && shoot.services) {
      return [shoot.services];
    }
    return [];
  };

  const getServiceQuantity = (service: any) => {
    if (!service || typeof service === 'string') return 1;
    const categoryName = String(
      service.category?.name ??
      service.category_name ??
      service.category ??
      '',
    ).toLowerCase();
    const isPhotoCategory = categoryName === 'photo' || categoryName === 'photos';
    const serviceWithPricing = { ...service, price: service.price ?? 0 };
    const pricingInfo =
      baseSqft && service.pricing_type === 'variable' && service.sqft_ranges?.length
        ? getServicePricingForSqft(serviceWithPricing, baseSqft)
        : null;
    const rawQuantity =
      (isPhotoCategory
        ? pricingInfo?.matchedRange?.photo_count ??
          service.photo_count ??
          service.photoCount ??
          service.pivot?.photo_count
        : undefined) ??
      service.quantity ??
      service.pivot?.quantity ??
      service.qty ??
      service.count;
    const parsedQuantity = Number(rawQuantity);
    return Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
  };

  const formatServiceLabel = (service: any) => {
    const baseName = typeof service === 'string'
      ? service
      : service?.name || service?.label || String(service);
    const quantity = getServiceQuantity(service);
    return quantity > 1 ? `${baseName} x${quantity}` : baseName;
  };

  const getServiceCountBadge = (service: any) => {
    const quantity = getServiceQuantity(service);
    return quantity > 1 ? `x${quantity}` : null;
  };

  const services = getServices();
  const locationDetails = getLocationDetails();
  
  // Get property details - handle both camelCase and snake_case
  const propertyDetails = shoot.propertyDetails || (shoot as any).property_details || {};
  const baseBeds =
    propertyDetails?.beds ??
    propertyDetails?.bedrooms ??
    propertyDetails?.bed ??
    (shoot as any).beds ??
    (shoot as any).bedrooms;
  const baseBaths =
    propertyDetails?.baths ??
    propertyDetails?.bathrooms ??
    propertyDetails?.bath ??
    (shoot as any).baths ??
    (shoot as any).bathrooms;
  const baseSqft =
    propertyDetails?.sqft ??
    propertyDetails?.squareFeet ??
    propertyDetails?.square_feet ??
    (shoot as any).sqft ??
    (shoot as any).squareFeet ??
    (shoot as any).square_feet ??
    (shoot as any).livingArea ??
    (shoot as any).living_area;
  const iguideTourUrl =
    shoot.iguideTourUrl ||
    shoot.tourLinks?.iGuide ||
    shoot.tourLinks?.iguide_branded ||
    shoot.tourLinks?.iguide_mls ||
    (shoot as any).iguide_tour_url ||
    '';
  const iguideFloorplans =
    shoot.iguideFloorplans || (shoot as any).iguide_floorplans || [];
  const iguideLastSyncedAt =
    shoot.iguideLastSyncedAt || (shoot as any).iguide_last_synced_at;
  const iguidePropertyId =
    shoot.iguidePropertyId || (shoot as any).iguide_property_id;

  const metricDisplayValues = {
    beds: isEditMode ? propertyMetricsEdit.beds : baseBeds,
    baths: isEditMode ? propertyMetricsEdit.baths : baseBaths,
    sqft: isEditMode ? propertyMetricsEdit.sqft : baseSqft,
  };

  const formatMetricValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return numeric.toLocaleString();
    }
    return String(value);
  };


  const propertyMetrics = [
    {
      label: 'Beds',
      icon: BedDouble,
      value: formatMetricValue(metricDisplayValues.beds),
    },
    {
      label: 'Baths',
      icon: ShowerHead,
      value: formatMetricValue(metricDisplayValues.baths),
    },
    {
      label: 'Sqft',
      icon: Ruler,
      value: formatMetricValue(metricDisplayValues.sqft),
    },
  ];

  // Toggle service selection
  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds((prev) => {
      if (prev.includes(serviceId)) {
        // Remove service
        const updated = prev.filter((id) => id !== serviceId);
        const newPrices = { ...servicePrices };
        const newPays = { ...servicePhotographerPays };
        delete newPrices[serviceId];
        delete newPays[serviceId];
        setServicePrices(newPrices);
        setServicePhotographerPays(newPays);
        return updated;
      }
      // Add service
      return [...prev, serviceId];
    });
  };
  
  useEffect(() => {
    // Calculate total from selected services
    const sqft = effectiveSqft;
    const total = selectedServiceIds.reduce((sum, id) => {
      const service = servicesList.find((s) => s.id === id);
      if (!service) return sum;
      const resolvedPrice = resolveServicePrice(service, sqft, servicePrices[id]).price;
      return sum + (Number.isNaN(resolvedPrice) ? 0 : resolvedPrice);
    }, 0);
    const rawTaxRate = Number(editedShoot.payment?.taxRate ?? shoot.payment?.taxRate ?? 0);
    const normalizedTaxRate = rawTaxRate > 1 ? rawTaxRate / 100 : rawTaxRate;
    const autoTax = Number((total * normalizedTaxRate).toFixed(2));
    const manualTax = Number(editedShoot.payment?.taxAmount ?? shoot.payment?.taxAmount ?? 0);
    const resolvedManualTax = Number.isFinite(manualTax) ? manualTax : 0;
    const finalTax = taxAmountDirty ? resolvedManualTax : autoTax;
    updateField('payment.baseQuote', total);
    updateField('payment.taxAmount', finalTax);
    updateField('payment.totalQuote', total + finalTax);
  }, [
    selectedServiceIds,
    servicePrices,
    servicesList,
    effectiveSqft,
    editedShoot.payment?.taxRate,
    shoot.payment?.taxRate,
    editedShoot.payment?.taxAmount,
    shoot.payment?.taxAmount,
    taxAmountDirty,
  ]);

  const renderWeatherIcon = (icon?: string) => {
    switch (icon) {
      case 'sunny':
        return <Sun size={14} className="text-muted-foreground" />;
      case 'rainy':
        return <CloudRain size={14} className="text-muted-foreground" />;
      case 'snowy':
        return <Snowflake size={14} className="text-muted-foreground" />;
      default:
        return <Cloud size={14} className="text-muted-foreground" />;
    }
  };


  return (
    <div className="space-y-2">
      {/* Date, Time, Weather - Three Separate Cards */}
      <div className="grid grid-cols-[1fr_0.7fr_1.3fr] gap-2">
        {/* Date Card */}
        <div className="p-2.5 border rounded-lg bg-card">
          {isEditMode ? (
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <Input
                type="date"
                value={editedShoot.scheduledDate || formatDateForInput(shoot.scheduledDate)}
                onChange={(e) => updateField('scheduledDate', e.target.value)}
                className="h-7 text-xs [&::-webkit-calendar-picker-indicator]:opacity-100"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium text-foreground">{scheduleDateDisplay}</span>
            </div>
          )}
        </div>

        {/* Time Card */}
        <div className="p-2.5 border rounded-lg bg-card">
          {isEditMode ? (
            <div className="flex items-center gap-1.5">
              <ClockIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <Input
                type="time"
                value={editedShoot.time ?? shoot.time ?? ''}
                onChange={(e) => updateField('time', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <ClockIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium text-foreground">{scheduleTimeDisplay || 'Not set'}</span>
            </div>
          )}
        </div>

        {/* Weather Card */}
        <div className="p-2.5 border rounded-lg bg-card">
          <div className="flex items-center gap-2">
            {renderWeatherIcon(weatherIcon)}
            {hasWeatherDetails ? (
              <div className="flex items-center gap-1.5">
                {formattedTemperature && (
                  <span className="text-sm font-medium text-foreground">{formattedTemperature}</span>
                )}
                {weatherDescription && (
                  <span className="text-sm text-muted-foreground capitalize">{weatherDescription}</span>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No data</span>
            )}
          </div>
        </div>
      </div>

      {/* Property Metrics */}
      <div className="p-2.5 border rounded-lg bg-card">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">
          Property details
        </div>
        {isEditMode ? (
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'beds', label: 'Beds', icon: BedDouble, placeholder: '0' },
              { key: 'baths', label: 'Baths', icon: ShowerHead, placeholder: '0' },
              { key: 'sqft', label: 'Sqft', icon: Ruler, placeholder: '0' },
            ].map(({ key, label, icon: Icon, placeholder }) => (
              <div key={key} className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="text-[11px] uppercase text-muted-foreground font-semibold">{label}</div>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={(propertyMetricsEdit as any)[key]}
                    onChange={(e) =>
                      setPropertyMetricsEdit((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    placeholder={placeholder}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {propertyMetrics.map(({ label, icon: Icon, value }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground font-semibold">{label}</div>
                  <div className="text-xs font-medium">{value}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Location Card - Full width where weather was */}
      <div className="p-2.5 border rounded-lg bg-card">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Location</span>
        </div>
        {isEditMode ? (
          <div className="space-y-1.5 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Address:</span>
              <AddressLookupField
                value={addressInput}
                onChange={(value) => {
                  setAddressInput(value);
                  updateField('location.address', value);
                }}
                onAddressSelect={handleAddressSelect as any}
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">City:</span>
                <Input
                  type="text"
                  value={editedShoot.location?.city || shoot.location?.city || ''}
                  onChange={(e) => updateField('location.city', e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">State:</span>
                <Input
                  type="text"
                  maxLength={2}
                  value={editedShoot.location?.state || shoot.location?.state || ''}
                  onChange={(e) => updateField('location.state', e.target.value.toUpperCase())}
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">ZIP:</span>
              <Input
                type="text"
                value={editedShoot.location?.zip || shoot.location?.zip || ''}
                onChange={(e) => updateField('location.zip', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </div>
        ) : (
          <div className="text-xs">
            <div className="font-medium truncate">{getLocationAddress()}</div>
            <div className="text-muted-foreground mt-0.5 truncate">
              {[locationDetails.city, locationDetails.state, locationDetails.zip].filter(Boolean).join(', ') || 'Not set'}
            </div>
          </div>
        )}
      </div>

      {/* Services Card */}
      <div className="p-2.5 border rounded-lg bg-card">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Services</span>
        {isEditMode ? (
          <div className="space-y-2">
            {/* Selected services summary and edit button */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">
                {selectedServiceIds.length ? `${selectedServiceIds.length} service${selectedServiceIds.length > 1 ? 's' : ''} selected` : 'None selected'}
              </p>
              <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    {selectedServiceIds.length ? 'Edit services' : 'Select services'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-4xl w-[96vw] max-h-[85vh] p-0 overflow-hidden">
                  <DialogHeader className="px-4 py-3 border-b">
                    <DialogTitle className="text-base">Select services</DialogTitle>
                    <DialogDescription className="text-xs">
                      Pick services for this shoot. Categories on left, services on right.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col sm:flex-row h-full sm:h-[60vh]">
                    {/* Category sidebar */}
                    <aside className="border-b sm:border-b-0 sm:border-r p-3 sm:w-48 flex-shrink-0 sm:overflow-y-auto sm:max-h-[60vh]">
                      <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-col sm:overflow-visible sm:pb-0 sm:space-y-1">
                        {serviceCategoryOptions.map((category) => {
                          const isActive = category.id === servicePanelCategory;
                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => setServicePanelCategory(category.id)}
                              className={cn(
                                'rounded-lg border px-3 py-2 text-left transition-colors flex-shrink-0 text-xs',
                                isActive
                                  ? 'border-primary/60 bg-primary/5 text-primary'
                                  : 'border-transparent hover:bg-muted/40 text-muted-foreground'
                              )}
                            >
                              <p className="font-medium">{category.name}</p>
                              <p className="text-[10px] text-muted-foreground">{category.count} items</p>
                            </button>
                          );
                        })}
                      </div>
                    </aside>
                    {/* Services list */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh] sm:max-h-none">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search services..."
                          value={serviceModalSearch}
                          onChange={(e) => setServiceModalSearch(e.target.value)}
                          className="h-8 text-xs pl-8"
                        />
                      </div>
                      {panelServices.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-6">
                          No services in this category.
                        </div>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {panelServices.map((service) => {
                            const isSelected = selectedServiceIds.includes(service.id);
                            const serviceWithPrice = { ...service, price: service.price ?? 0 };
                            const pricingInfo = effectiveSqft && service.pricing_type === 'variable' && service.sqft_ranges?.length
                              ? getServicePricingForSqft(serviceWithPrice, effectiveSqft)
                              : null;
                            const displayPrice = pricingInfo
                              ? serviceCurrencyFormatter.format(pricingInfo.price)
                              : serviceCurrencyFormatter.format(Number(service.price ?? 0));
                            return (
                              <div
                                key={service.id}
                                className={cn(
                                  'rounded-lg border p-3 cursor-pointer transition-all text-xs',
                                  isSelected
                                    ? 'border-primary/60 bg-primary/5'
                                    : 'border-border hover:border-primary/40'
                                )}
                                onClick={() => toggleServiceSelection(service.id)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="font-medium">{service.name}</p>
                                    {service.pricing_type === 'variable' && (
                                      <p className="text-[10px] text-muted-foreground uppercase">Variable pricing</p>
                                    )}
                                  </div>
                                  <Checkbox checked={isSelected} onCheckedChange={() => toggleServiceSelection(service.id)} />
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="font-semibold">{displayPrice}</span>
                                  {deriveServiceCategoryName(service) !== 'Uncategorized' && (
                                    <Badge variant="outline" className="text-[9px] uppercase">{deriveServiceCategoryName(service)}</Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="px-4 py-3 border-t gap-2">
                    <DialogClose asChild>
                      <Button size="sm" className="w-full sm:w-auto">Done</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {/* Selected services with price display */}
            {selectedServiceIds.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {selectedServiceIds.map((id) => {
                  const service = servicesList.find((s) => s.id === id);
                  if (!service) return null;
                  const serviceWithPrice = { ...service, price: service.price ?? 0 };
                  const pricingInfo = effectiveSqft && service.pricing_type === 'variable' && service.sqft_ranges?.length
                    ? getServicePricingForSqft(serviceWithPrice, effectiveSqft)
                    : null;
                  const displayPrice = pricingInfo
                    ? serviceCurrencyFormatter.format(pricingInfo.price)
                    : serviceCurrencyFormatter.format(Number(service.price ?? 0));
                  return (
                    <div key={id} className="border rounded-md p-2 bg-primary/5 border-primary/30 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-xs truncate block">{service.name}</span>
                        {service.pricing_type === 'variable' && effectiveSqft && (
                          <span className="text-[10px] text-muted-foreground">Variable • {effectiveSqft.toLocaleString()} sqft</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{displayPrice}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 flex-shrink-0"
                          onClick={() => toggleServiceSelection(id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : shoot.serviceObjects && shoot.serviceObjects.length > 0 ? (
          <div className="space-y-1">
            {shoot.serviceObjects.map((svc) => (
              <div key={svc.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate">{svc.name}</span>
                  {getServiceCountBadge(svc) && (
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                      {getServiceCountBadge(svc)}
                    </span>
                  )}
                </div>
                <span className="font-medium text-muted-foreground whitespace-nowrap">${Number(svc.price).toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {services.length > 0 ? (
              services.map((service, index) => (
                <Badge key={index} variant="outline" className="text-[10px] px-1.5 py-0.5">
                  {formatServiceLabel(service)}
                </Badge>
              ))
            ) : (
              <div className="text-xs text-muted-foreground">No services</div>
            )}
          </div>
        )}
      </div>

      {/* Client Card - with Sales Rep info right-aligned for admins */}
      {/* Hidden from photographers and editors */}
      {(shoot.client || isEditMode) && !isPhotographer && !isEditor && !shouldHideClientDetails && (
        <div className="p-2.5 border rounded-lg bg-card">
          <div className="flex items-center gap-1.5 mb-1.5">
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Client</span>
          </div>
          {isEditMode ? (
            <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen} modal={false}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientSearchOpen}
                  className="w-full justify-between h-8 text-xs font-normal"
                >
                  {selectedClientId
                    ? clients.find((c) => c.id === selectedClientId)?.name || 'Select client...'
                    : 'Select client...'}
                  <ArrowUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-[var(--radix-popover-trigger-width)] max-w-[300px] p-0 shadow-lg z-[200] max-h-[250px]" 
                align="start" 
                sideOffset={4}
                side="bottom"
                onOpenAutoFocus={(e) => e.preventDefault()}
                style={{ pointerEvents: 'auto' }}
              >
                <Command className="rounded-lg flex flex-col" shouldFilter={true}>
                  <CommandInput placeholder="Search clients..." className="h-9 flex-shrink-0 border-b" />
                  <CommandList className="max-h-[200px] overflow-y-auto overflow-x-hidden">
                    <CommandEmpty>No client found.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={`${client.name} ${client.email} ${client.company || ''}`}
                          onSelect={() => {
                            setSelectedClientId(client.id);
                            updateField('client', {
                              id: client.id,
                              name: client.name,
                              email: client.email,
                              company: client.company,
                            });
                            setClientSearchOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{client.name}</span>
                            {client.email && (
                              <span className="text-[10px] text-muted-foreground">{client.email}</span>
                            )}
                          </div>
                          {selectedClientId === client.id && (
                            <Check className="ml-auto h-4 w-4" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <div className="flex items-start justify-between">
              <div className="space-y-1 text-xs">
                <div className="font-medium">{shoot.client?.name || 'Unknown'}</div>
                {shoot.client?.email && (
                  <div className="text-muted-foreground truncate">{shoot.client.email}</div>
                )}
              </div>
              {/* Sales Rep - right aligned, from client's account */}
              {isAdmin && (
                <div className="text-xs text-right">
                  <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Rep</div>
                  {(shoot.client as any)?.rep ? (
                    <div className="font-medium">{(shoot.client as any).rep.name}</div>
                  ) : (
                    <div className="text-muted-foreground">No rep</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Photographer Card — per-service or single (hidden from photographer viewing their own details) */}
      {!isPhotographer &&
        (shoot.photographer || isEditMode || photographerAssignments.hasAssignments) &&
        (() => {
          const catEntries = isEditMode ? editModePhotographerRows : photographerAssignments.groups;
          const distinctPhotographerIds = Array.from(
            new Set(
              catEntries
                .map((group) => group.photographer?.id)
                .filter((id): id is string => Boolean(id)),
            ),
          );
          const hasMultiplePhotographers = isEditMode
            ? distinctPhotographerIds.length > 1
            : photographerAssignments.hasMultiplePhotographers;
          const hasMultipleCategories = catEntries.length > 1;
          const displayedPhotographer = isEditMode
            ? resolvePhotographerDetails(selectedPhotographerIdEdit) || catEntries[0]?.photographer
            : shoot.photographer || catEntries[0]?.photographer;

          return (
            <div className="p-2.5 border rounded-lg bg-card">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CameraIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  {(isEditMode ? hasMultipleCategories : hasMultiplePhotographers)
                    ? 'Photographers'
                    : 'Photographer'}
                </span>
              </div>
              {isEditMode ? (
                <div className="space-y-2">
                  {(hasMultipleCategories ? editModePhotographerRows : editModePhotographerRows.slice(0, 1)).map(
                    (group) => {
                      const selectedPhotographer = resolvePhotographerDetails(
                        perCategoryPhotographers[group.key]
                          || group.photographer?.id
                          || selectedPhotographerIdEdit
                          || '',
                      );

                      return (
                        <div
                          key={group.key}
                          className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5"
                        >
                          <div className="min-w-0 space-y-1 text-xs">
                            {hasMultipleCategories && (
                              <div className="text-[10px] font-medium uppercase text-muted-foreground">
                                {group.name}
                              </div>
                            )}
                            <div className="font-medium">
                              {selectedPhotographer?.name || 'Not assigned'}
                            </div>
                            {!isClient && selectedPhotographer?.email && (
                              <div className="truncate text-muted-foreground">
                                {selectedPhotographer.email}
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 text-xs"
                            onClick={() =>
                              openEditPhotographerPicker({
                                source: 'edit',
                                categoryKey: hasMultipleCategories ? group.key : undefined,
                                categoryName: hasMultipleCategories ? group.name : undefined,
                              })
                            }
                          >
                            Edit photographer
                          </Button>
                        </div>
                      );
                    },
                  )}
                </div>
              ) : hasMultiplePhotographers ? (
                <div className="space-y-1.5">
                  {catEntries.map((group) => {
                    const photog = group.photographer || shoot.photographer;
                    return (
                      <div
                        key={group.key}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="text-[10px] font-medium text-muted-foreground uppercase truncate">
                          {group.name}
                        </span>
                        <span className="font-medium truncate">
                          {photog?.name || 'Not assigned'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <div className="font-medium">{displayedPhotographer?.name || 'Not assigned'}</div>
                  {!isClient && displayedPhotographer?.email && (
                    <div className="text-muted-foreground truncate">
                      {displayedPhotographer.email}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

      {/* Property Access Card - Lockbox or Access Contact Info */}
      <div className="p-2.5 border rounded-lg bg-card">
        <div className="flex items-center gap-1.5 mb-1.5">
          {presenceOption === 'lockbox' ? (
            <Key className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">
            Property Access
          </span>
        </div>
        {isEditMode ? (
          <div className="space-y-3 text-xs">
            <RadioGroup
              value={presenceOption}
              onValueChange={(value) => setPresenceOption(value as 'self' | 'other' | 'lockbox')}
              className="grid grid-cols-3 gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="self" id="presence-self" />
                <Label htmlFor="presence-self" className="text-xs cursor-pointer">Self</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="presence-other" />
                <Label htmlFor="presence-other" className="text-xs cursor-pointer">Other contact</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="lockbox" id="presence-lockbox" />
                <Label htmlFor="presence-lockbox" className="text-xs cursor-pointer">Lockbox</Label>
              </div>
            </RadioGroup>
            {presenceOption === 'lockbox' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Lockbox code</span>
                  <Input
                    value={lockboxCode}
                    onChange={(e) => setLockboxCode(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="####"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Location / instructions</span>
                  <Input
                    value={lockboxLocation}
                    onChange={(e) => setLockboxLocation(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="e.g., on the gate"
                  />
                </div>
              </div>
            )}
            {presenceOption === 'other' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Contact name</span>
                  <Input
                    value={accessContactName}
                    onChange={(e) => setAccessContactName(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Full name"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Contact phone</span>
                  <Input
                    value={accessContactPhone}
                    onChange={(e) => setAccessContactPhone(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            )}
            {presenceOption === 'self' && (
              <p className="text-muted-foreground text-[11px]">Client will be present at the property.</p>
            )}
          </div>
        ) : (
          (() => {
            const details = propertyDetails || {};
            const hasLockboxData = !!(details.lockboxCode || details.lockboxLocation);
            const hasAccessContactData = !!(details.accessContactName || details.accessContactPhone);
            if (!hasLockboxData && !hasAccessContactData) {
              return <div className="text-xs text-muted-foreground">No access details provided.</div>;
            }
            const isLockbox = hasLockboxData || details.presenceOption === 'lockbox';
            return (
              <div className="space-y-1 text-xs">
                {isLockbox ? (
                  <>
                    {details.lockboxCode && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Code:</span>
                        <span className="font-medium font-mono">{details.lockboxCode}</span>
                      </div>
                    )}
                    {details.lockboxLocation && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-muted-foreground">Location:</span>
                        <span className="font-medium text-right flex-1">{details.lockboxLocation}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {details.accessContactName && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">On-site Contact:</span>
                        <span className="font-medium">{details.accessContactName}</span>
                      </div>
                    )}
                    {details.accessContactPhone && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Contact Phone:</span>
                        <a href={`tel:${details.accessContactPhone}`} className="font-medium text-primary hover:underline">
                          {details.accessContactPhone}
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()
        )}
      </div>

      {/* Completion Info Card - Only show if completed */}
      {shoot.completedDate && (
        <div className="p-2.5 border rounded-lg bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Completion</span>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed:</span>
              <span>{formatDate(shoot.completedDate)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Media Links Card - Editor only */}
      {isEditor && (
        <MediaLinksSection shoot={shoot} isEditor={isEditor} onShootUpdate={onShootUpdate} />
      )}

      {/* Payment Summary Card - Hidden from photographers and editors */}
      {!isPhotographer && !isEditor && (
      <div className="p-2.5 border rounded-lg bg-card">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Payment</span>
        {isEditMode && isAdmin ? (
          <div className="space-y-1.5 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Base Quote:</span>
              <Input
                type="number"
                step="0.01"
                value={parseFloat(String(editedShoot.payment?.baseQuote ?? shoot.payment?.baseQuote ?? 0)).toFixed(2)}
                onChange={(e) => updateField('payment.baseQuote', parseFloat(parseFloat(e.target.value).toFixed(2)) || 0)}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Tax Amount:</span>
              <Input
                type="number"
                step="0.01"
                value={parseFloat(String(editedShoot.payment?.taxAmount ?? shoot.payment?.taxAmount ?? 0)).toFixed(2)}
                onChange={(e) => {
                  const nextValue = parseFloat(parseFloat(e.target.value).toFixed(2));
                  setTaxAmountDirty(true);
                  updateField('payment.taxAmount', Number.isFinite(nextValue) ? nextValue : 0);
                }}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Total Quote:</span>
              <Input
                type="number"
                step="0.01"
                value={parseFloat(String(editedShoot.payment?.totalQuote ?? shoot.payment?.totalQuote ?? 0)).toFixed(2)}
                onChange={(e) => updateField('payment.totalQuote', parseFloat(parseFloat(e.target.value).toFixed(2)) || 0)}
                className="h-7 text-xs"
              />
            </div>
            <Separator className="my-1.5" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid:</span>
              <span>${(Number(shoot.payment?.totalPaid) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance:</span>
              <span className={((Number(editedShoot.payment?.totalQuote ?? shoot.payment?.totalQuote) || 0) - (Number(shoot.payment?.totalPaid) || 0) > 0) ? 'text-orange-600 font-medium' : 'text-green-600'}>
                ${((Number(editedShoot.payment?.totalQuote ?? shoot.payment?.totalQuote) || 0) - (Number(shoot.payment?.totalPaid) || 0)).toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5 text-xs">
            {isAdmin ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base:</span>
                  <span>${(Number(shoot.payment?.baseQuote) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax:</span>
                  <span>${(Number(shoot.payment?.taxAmount) || 0).toFixed(2)}</span>
                </div>
                <Separator className="my-1.5" />
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span>${(Number(shoot.payment?.totalQuote) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid:</span>
                  <span>${(Number(shoot.payment?.totalPaid) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance:</span>
                  <span className={((shoot.payment?.totalQuote || 0) - (shoot.payment?.totalPaid || 0) > 0) ? 'text-orange-600 font-medium' : 'text-green-600'}>
                    ${((shoot.payment?.totalQuote || 0) - (shoot.payment?.totalPaid || 0)).toFixed(2)}
                  </span>
                </div>
              </>
            ) : isClient ? (
              <>
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span>${(Number(shoot.payment?.totalQuote) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid:</span>
                  <span>${(Number(shoot.payment?.totalPaid) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Outstanding:</span>
                  <span className={((Number(shoot.payment?.totalQuote) || 0) - (Number(shoot.payment?.totalPaid) || 0) > 0) ? 'text-orange-600 font-medium' : 'text-green-600'}>
                    ${((Number(shoot.payment?.totalQuote) || 0) - (Number(shoot.payment?.totalPaid) || 0)).toFixed(2)}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">Not available</div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Notes section - only for photographer */}
      {isPhotographer && (
        <div className="p-2.5 border rounded-lg bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Notes</span>
          <ShootNotesTab shoot={shoot} isAdmin={false} isPhotographer={true} role="photographer" />
        </div>
      )}

      {/* Assign Photographer Dialog - Matching Book Shoot selector */}
      <Dialog open={assignPhotographerOpen} onOpenChange={(open) => {
        if (open) {
          setAssignPhotographerOpen(true);
          return;
        }
        closePhotographerPicker();
      }}>
        <DialogContent className="sm:max-w-2xl w-full">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <DialogHeader>
                  <DialogTitle className="text-lg text-slate-900 dark:text-slate-100">
                    {photographerPickerContext?.categoryName
                      ? `Select Photographer for ${photographerPickerContext.categoryName}`
                      : 'Select Photographer'}
                  </DialogTitle>
                  <DialogDescription>
                    {photographerPickerContext?.categoryName
                      ? `Choose a photographer for ${photographerPickerContext.categoryName} services`
                      : isEditMode
                      ? 'Choose a photographer for this shoot before saving your edits'
                      : 'Choose a photographer to assign to this shoot'}
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>

            {/* Search and Sort Controls */}
            <div className="space-y-3 mb-4">
              {/* Search Field */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search photographers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(value: 'distance' | 'name') => setSortBy(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">Sort by Distance</SelectItem>
                    <SelectItem value="name">Sort by Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {/* Scrollable content area */}
              <div className="pt-3 max-h-[48vh] overflow-y-auto pr-2">
                {isCalculatingDistances ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Calculating distances...</span>
                  </div>
                ) : filteredAndSortedPhotographers.length > 0 ? (
                  <div className="grid gap-4">
                    {filteredAndSortedPhotographers.map((photographerItem) => (
                      <div
                        key={photographerItem.id}
                        className={cn(
                          "p-4 rounded-2xl border transition-all",
                          selectedPhotographerId === photographerItem.id
                            ? "border-blue-300 bg-blue-50/70 dark:border-blue-700 dark:bg-blue-950/40"
                            : "border-gray-100 bg-gray-50 dark:border-slate-700 dark:bg-slate-800",
                          "hover:border-blue-200 dark:hover:border-blue-800"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={photographerItem.avatar} alt={photographerItem.name} />
                            <AvatarFallback>{photographerItem.name?.charAt(0)}</AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                  {photographerItem.name}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                  {photographerItem.distance !== undefined ? (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {photographerItem.distance} mi away
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">Distance unavailable</span>
                                  )}
                                  {photographerItem.city && photographerItem.state && (
                                    <span className="text-muted-foreground">
                                      • {photographerItem.city}, {getStateFullName(photographerItem.state)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {selectedPhotographerId === photographerItem.id && (
                                <span className="text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-300">Selected</span>
                              )}
                            </div>

                            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              <MapPinIcon className="h-3.5 w-3.5" />
                              <span className="font-medium">
                                {photographerItem.distanceFrom === 'previous_shoot' ? 'Last shoot' : 'Home base'}:
                              </span>
                              <span className="truncate">
                                {formatLocationLabel(photographerItem.originAddress || {
                                  address: photographerItem.address,
                                  city: photographerItem.city,
                                  state: photographerItem.state,
                                  zip: photographerItem.zip,
                                }) || 'Location unavailable'}
                              </span>
                            </div>

                            <div className="mt-3">
                              <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                <span>Today’s availability</span>
                                {typeof photographerItem.shootsCountToday === 'number' && (
                                  <span>{photographerItem.shootsCountToday} shoots</span>
                                )}
                              </div>
                              <div className="mt-2 flex gap-1">
                                {buildAvailabilitySegments(photographerItem.netAvailableSlots).map((isAvailable, index) => (
                                  <span
                                    key={`${photographerItem.id}-slot-${index}`}
                                    className={cn(
                                      "h-1.5 flex-1 rounded-full",
                                      isAvailable
                                        ? "bg-blue-500 dark:bg-blue-400"
                                        : "bg-slate-200 dark:bg-slate-700"
                                    )}
                                  />
                                ))}
                              </div>
                              <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                {isLoadingAvailability
                                  ? 'Checking today’s slots...'
                                  : formatAvailabilitySummary(photographerItem.netAvailableSlots) || 'No open slots today'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPhotographerId(photographerItem.id);
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors",
                                selectedPhotographerId === photographerItem.id
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600"
                              )}
                            >
                              {selectedPhotographerId === photographerItem.id ? 'Selected' : 'Select'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                    {searchQuery ? 'No photographers found matching your search.' : 'No photographers available.'}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="pt-4">
                <div className="flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={() => {
                    closePhotographerPicker();
                  }} className="w-full">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedPhotographerId) {
                        toast({
                          title: "No photographer selected",
                          description: "Please select a photographer before continuing.",
                          variant: "destructive",
                        });
                        return;
                      }
                      handleAssignPhotographer();
                    }}
                    className="w-full"
                    disabled={!selectedPhotographerId}
                  >
                    {isEditMode ? 'Use selection' : 'Assign'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
