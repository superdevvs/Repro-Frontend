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
import { Switch } from '@/components/ui/switch';
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
import { useEditorRates } from '@/hooks/useEditorRates';
import { API_BASE_URL } from '@/config/env';
import { apiClient } from '@/services/api';
import { useAuth } from '@/components/auth';
import { calculateDistance, getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { cn } from '@/lib/utils';
import API_ROUTES from '@/lib/api';
import { getStateFullName } from '@/utils/stateUtils';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { getServicePricingForSqft } from '@/utils/servicePricing';
import type { ServiceWithPricing } from '@/utils/servicePricing';
import {
  getShootPhotographerAssignmentGroups,
  normalizeShootServiceCategoryKey,
} from '@/utils/shootPhotographerAssignments';
import { to12Hour } from '@/utils/availabilityUtils';
import AddressLookupField, { buildNormalizedPropertyDetails } from '@/components/AddressLookupField';
import { setNestedDraftValue } from './overview/draftUtils';
import { MediaLinksSection } from './overview/MediaLinksSection';
import { OverviewAccessSection } from './overview/OverviewAccessSection';
import { OverviewClientSection } from './overview/OverviewClientSection';
import { OverviewPaymentSummarySection } from './overview/OverviewPaymentSummarySection';
import { OverviewPhotographerPickerDialog } from './overview/OverviewPhotographerPickerDialog';
import { OverviewPhotographerSection } from './overview/OverviewPhotographerSection';
import { OverviewPropertyLocationSection } from './overview/OverviewPropertyLocationSection';
import { OverviewScheduleWeatherSection } from './overview/OverviewScheduleWeatherSection';
import { OverviewServicesSection } from './overview/OverviewServicesSection';
import {
  extractPhotoCountFromServiceName,
  findMatchingEditorRate,
  getExplicitEditorPhotoCount,
  isPhotoServiceName,
} from '@/utils/editorRates';
import { useShootOverviewEditor } from './overview/useShootOverviewEditor';
import { getNormalizedIguideSync, normalizePropertyDetails } from '@/utils/shootTourData';
import { formatPropertyMetricValue, getBathroomMetricDisplay } from '@/utils/shootPropertyDisplay';

const serviceCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const toSafeNumber = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

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

const resolveFeaturedShootState = (shoot?: Partial<ShootData> | null) => {
  const snakeCaseValue = (shoot as any)?.is_featured;
  if (snakeCaseValue !== undefined && snakeCaseValue !== null) {
    return Boolean(snakeCaseValue);
  }

  const camelCaseValue = (shoot as any)?.isFeatured;
  if (camelCaseValue !== undefined && camelCaseValue !== null) {
    return Boolean(camelCaseValue);
  }

  return false;
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
  mls_id?: string;
  price?: number;
  lot_size?: number;
  year_built?: number;
  property_type?: string;
  zpid?: string;
  source?: string;
  confidence?: number;
  field_sources?: Record<string, string>;
  property_source_chain?: string[];
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

interface ShootDetailsOverviewTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  isRep: boolean;
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
  isRep,
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
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatTemperature, formatTime: formatTimePreference, formatDate: formatDatePreference } = useUserPreferences();
  const [isFeaturedShoot, setIsFeaturedShoot] = useState<boolean>(() => resolveFeaturedShootState(shoot));
  const [isSavingFeaturedShoot, setIsSavingFeaturedShoot] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);

  const {
    state: {
      editedShoot,
      taxAmountDirty,
      clients,
      selectedClientId,
      clientSearchOpen,
      selectedPhotographerIdEdit,
      perCategoryPhotographers,
      servicesList,
      selectedServiceIds,
      serviceDialogOpen,
      servicePanelCategory,
      serviceModalSearch,
      presenceOption,
      lockboxCode,
      lockboxLocation,
      accessContactName,
      accessContactPhone,
      propertyMetricsEdit,
      addressInput,
      assignPhotographerOpen,
      selectedPhotographerId,
      photographerPickerContext,
      searchQuery,
      sortBy,
      isCalculatingDistances,
      isLoadingAvailability,
    },
    actions: {
      setTaxAmountDirty,
      setSelectedClientId,
      setClientSearchOpen,
      setSelectedPhotographerIdEdit,
      setPerCategoryPhotographers,
      setServiceDialogOpen,
      setServicePanelCategory,
      setServiceModalSearch,
      setPresenceOption,
      setLockboxCode,
      setLockboxLocation,
      setAccessContactName,
      setAccessContactPhone,
      setPropertyMetricsEdit,
      setAddressInput,
      setAssignPhotographerOpen,
      setSelectedPhotographerId,
      setSearchQuery,
      setSortBy,
      updateField,
      clearAddressDerivedState,
      handleAddressSelect,
      toggleServiceSelection,
      resolvePhotographerDetails,
      closePhotographerPicker,
      openEditPhotographerPicker,
      handleAssignPhotographer,
      formatLocationLabel,
      buildAvailabilitySegments,
      formatAvailabilitySummary,
    },
    photographerAssignments,
    effectiveSqft,
    serviceCategoryOptions,
    panelServices,
    filteredAndSortedPhotographers,
    editModePhotographerRows,
  } = useShootOverviewEditor({
    shoot,
    isAdmin,
    role,
    isEditMode,
    onShootUpdate,
    onSave,
    onCancel,
    onRegisterEditActions,
    toast,
  });

  useEffect(() => {
    setIsFeaturedShoot(resolveFeaturedShootState(shoot));
  }, [shoot]);

  const isAssignedPhotographer = Boolean(
    isPhotographer &&
    user?.id != null &&
    String(shoot.photographer?.id ?? (shoot as any)?.photographer_id ?? '') === String(user.id),
  );

  const handleFeaturedShootToggle = async (checked: boolean) => {
    const previousValue = isFeaturedShoot;
    setIsFeaturedShoot(checked);
    setIsSavingFeaturedShoot(true);

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_featured: checked }),
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
      const persisted = resolveFeaturedShootState((json?.data || json || { is_featured: checked }) as Partial<ShootData>);
      setIsFeaturedShoot(persisted);
      onShootUpdate();
      toast({
        title: persisted ? 'Featured Shoot enabled' : 'Featured Shoot removed',
        description: 'Internal marketing flag updated.',
      });
    } catch (error) {
      console.error('Failed to update Featured Shoot', error);
      setIsFeaturedShoot(previousValue);
      toast({
        title: 'Unable to update Featured Shoot',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingFeaturedShoot(false);
    }
  };

  const handleCreatePaymentLink = async () => {
    if (!isClient) return;

    setCreatingPayment(true);
    try {
      const response = await apiClient.post(`/shoots/${shoot.id}/create-checkout-link`);
      const url = response.data?.url || response.data?.checkout_url || response.data?.checkoutUrl;

      if (!url) {
        throw new Error('Checkout URL not returned');
      }

      window.open(url, '_blank');
      toast({
        title: 'Payment window opened',
        description: 'Complete payment in the new window.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create payment link',
        variant: 'destructive',
      });
    } finally {
      setCreatingPayment(false);
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
    const address = shoot.location?.address || (shoot as any).address || '';
    
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
      numericBaseSqft && service.pricing_type === 'variable' && service.sqft_ranges?.length
        ? getServicePricingForSqft(serviceWithPricing, numericBaseSqft)
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
    if (isClient) return baseName;
    return quantity > 1 ? `${baseName} x${quantity}` : baseName;
  };

  const getServiceCountBadge = (service: any) => {
    if (isClient) return null;
    const quantity = getServiceQuantity(service);
    return quantity > 1 ? `x${quantity}` : null;
  };

  const services = getServices();

  const { rates: editorRates } = useEditorRates(user?.id, {
    enabled: isEditor && Boolean(user?.id),
  });

  const getEditorServicePayout = (
    service: ServiceOption | Record<string, unknown>,
  ) => {
    const serviceName = String(service.name ?? '');
    const matchedRate = findMatchingEditorRate(service, editorRates);
    if (!matchedRate || matchedRate.rate <= 0) {
      return 0;
    }

    const quantity = Math.max(1, getServiceQuantity(service));
    const explicitPhotoCount = getExplicitEditorPhotoCount(service);
    const photoCount =
      explicitPhotoCount ||
      extractPhotoCountFromServiceName(serviceName) ||
      toSafeNumber(shoot.editedPhotoCount) ||
      toSafeNumber(shoot.expectedFinalCount) ||
      quantity;

    if (isPhotoServiceName(serviceName)) {
      return photoCount * matchedRate.rate;
    }

    if (explicitPhotoCount > 0) {
      return explicitPhotoCount * matchedRate.rate;
    }

    return quantity * matchedRate.rate;
  };

  const getServiceDisplayPrice = (service: ServiceOption) => {
    const serviceWithPrice: ServiceWithPricing = { ...service, price: service.price ?? 0 };
    const hasSqftRanges = Array.isArray(service.sqft_ranges) && service.sqft_ranges.length > 0;
    const pricingInfo = effectiveSqft && service.pricing_type === 'variable' && hasSqftRanges
      ? getServicePricingForSqft(serviceWithPrice, effectiveSqft)
      : null;
    const amount = isEditor
      ? getEditorServicePayout(service)
      : isPhotographer
        ? pricingInfo?.photographerPay ?? Number(service.photographer_pay ?? 0)
        : pricingInfo?.price ?? Number(service.price ?? 0);
    return serviceCurrencyFormatter.format(Number.isFinite(amount) ? amount : 0);
  };

  const getServiceCategoryBadgeName = (service: ServiceOption) => {
    const categoryName = deriveServiceCategoryName(service);
    return categoryName !== 'Uncategorized' ? categoryName : null;
  };
  const locationDetails = getLocationDetails();
  
  // Get property details - handle both camelCase and snake_case
  const propertyDetails = normalizePropertyDetails(shoot as any);
  const baseBeds = propertyDetails?.bedrooms;
  const baseBaths = propertyDetails?.bathrooms;
  const baseSqft = propertyDetails?.sqft;
  const numericBaseSqft =
    baseSqft === '' || baseSqft === null || baseSqft === undefined
      ? null
      : Number.isFinite(Number(baseSqft))
        ? Number(baseSqft)
        : null;
  const iguideSync = getNormalizedIguideSync(shoot as any);
  const iguideTourUrl = iguideSync.url;
  const iguideFloorplans = iguideSync.floorplans;
  const iguideLastSyncedAt = iguideSync.lastSyncedAt;
  const iguidePropertyId = iguideSync.propertyId;

  const metricDisplayValues = {
    beds: isEditMode ? propertyMetricsEdit.beds : baseBeds,
    baths: isEditMode ? propertyMetricsEdit.baths : baseBaths,
    sqft: isEditMode ? propertyMetricsEdit.sqft : baseSqft,
  };

  const bathroomDisplay = !isEditMode
    ? getBathroomMetricDisplay(metricDisplayValues.baths)
    : null;

  const propertyMetrics = [
    {
      label: 'Beds',
      icon: BedDouble,
      value: formatPropertyMetricValue(metricDisplayValues.beds),
    },
    {
      label: bathroomDisplay?.label ?? 'Baths',
      icon: ShowerHead,
      value: bathroomDisplay?.value ?? formatPropertyMetricValue(metricDisplayValues.baths),
    },
    {
      label: 'Sqft',
      icon: Ruler,
      value: formatPropertyMetricValue(metricDisplayValues.sqft),
    },
  ];

  const paymentTotalPaid = Number(shoot.payment?.totalPaid) || 0;
  const paymentTotalQuote = Number(shoot.payment?.totalQuote) || 0;
  const editedPaymentTotalQuote = Number(editedShoot.payment?.totalQuote ?? shoot.payment?.totalQuote) || 0;
  const paymentBalance = Math.max(paymentTotalQuote - paymentTotalPaid, 0);
  const editedPaymentBalance = Math.max(editedPaymentTotalQuote - paymentTotalPaid, 0);

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
      <OverviewScheduleWeatherSection
        isEditMode={isEditMode}
        editedShoot={editedShoot}
        shoot={shoot}
        scheduleDateDisplay={scheduleDateDisplay}
        scheduleTimeDisplay={scheduleTimeDisplay}
        hasWeatherDetails={hasWeatherDetails}
        formattedTemperature={formattedTemperature}
        weatherDescription={weatherDescription}
        weatherIcon={renderWeatherIcon(weatherIcon)}
        formatDateForInput={formatDateForInput}
        updateField={updateField}
      />

      <OverviewPropertyLocationSection
        isEditMode={isEditMode}
        propertyMetrics={propertyMetrics}
        propertyMetricsEdit={propertyMetricsEdit}
        setPropertyMetricsEdit={setPropertyMetricsEdit}
        addressInput={addressInput}
        setAddressInput={setAddressInput}
        editedShoot={editedShoot}
        shoot={shoot}
        updateField={updateField}
        clearAddressDerivedState={clearAddressDerivedState}
        handleAddressSelect={handleAddressSelect}
        getLocationAddress={getLocationAddress}
        locationDetails={locationDetails}
      />

      <OverviewServicesSection
        isEditMode={isEditMode}
        shoot={shoot}
        services={services}
        servicesList={servicesList}
        selectedServiceIds={selectedServiceIds}
        serviceDialogOpen={serviceDialogOpen}
        setServiceDialogOpen={setServiceDialogOpen}
        serviceCategoryOptions={serviceCategoryOptions}
        servicePanelCategory={servicePanelCategory}
        setServicePanelCategory={setServicePanelCategory}
        serviceModalSearch={serviceModalSearch}
        setServiceModalSearch={setServiceModalSearch}
        panelServices={panelServices}
        toggleServiceSelection={toggleServiceSelection}
        formatServiceLabel={formatServiceLabel}
        getServiceCountBadge={getServiceCountBadge}
        getServiceDisplayPrice={getServiceDisplayPrice}
        getReadonlyServiceDisplayPrice={getServiceDisplayPrice}
        getServiceCategoryBadgeName={getServiceCategoryBadgeName}
        effectiveSqft={effectiveSqft}
      />

      <OverviewClientSection
        shoot={shoot}
        isEditMode={isEditMode}
        isAdmin={isAdmin}
        isRep={isRep}
        isPhotographer={isPhotographer}
        isEditor={isEditor}
        isClient={isClient}
        shouldHideClientDetails={shouldHideClientDetails}
        clients={clients}
        selectedClientId={selectedClientId}
        clientSearchOpen={clientSearchOpen}
        setClientSearchOpen={setClientSearchOpen}
        setSelectedClientId={setSelectedClientId}
        updateField={updateField}
      />

      <OverviewPhotographerSection
        shoot={shoot}
        isEditMode={isEditMode}
        isPhotographer={isPhotographer}
        isClient={isClient}
        photographerAssignments={photographerAssignments}
        editModePhotographerRows={editModePhotographerRows}
        perCategoryPhotographers={perCategoryPhotographers}
        selectedPhotographerIdEdit={selectedPhotographerIdEdit}
        resolvePhotographerDetails={resolvePhotographerDetails}
        openEditPhotographerPicker={openEditPhotographerPicker}
      />

      {!isEditor && (
        <OverviewAccessSection
          isEditMode={isEditMode}
          propertyDetails={propertyDetails}
          presenceOption={presenceOption}
          setPresenceOption={setPresenceOption}
          lockboxCode={lockboxCode}
          setLockboxCode={setLockboxCode}
          lockboxLocation={lockboxLocation}
          setLockboxLocation={setLockboxLocation}
          accessContactName={accessContactName}
          setAccessContactName={setAccessContactName}
          accessContactPhone={accessContactPhone}
          setAccessContactPhone={setAccessContactPhone}
        />
      )}

      {isAssignedPhotographer && (
        <div className="p-2.5 border rounded-lg bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Internal Marketing</span>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">Featured Shoot</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Mark this shoot for internal marketing and featured collections.
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSavingFeaturedShoot ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : null}
              <Switch
                checked={isFeaturedShoot}
                onCheckedChange={(checked: boolean) => {
                  void handleFeaturedShootToggle(checked);
                }}
                disabled={isSavingFeaturedShoot}
              />
            </div>
          </div>
        </div>
      )}

      {/* Completion Info Card - Only show if completed */}
      {!isEditor && shoot.completedDate && (
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
        <MediaLinksSection shoot={shoot} isEditor={isEditor} />
      )}

      {/* Payment Summary Card - Hidden from photographers and editors */}
      {!isPhotographer && !isEditor && (
        <OverviewPaymentSummarySection
          isEditMode={isEditMode}
          isAdmin={isAdmin}
          isClient={isClient}
          editedShoot={editedShoot}
          shoot={shoot}
          paymentTotalPaid={paymentTotalPaid}
          paymentBalance={paymentBalance}
          editedPaymentBalance={editedPaymentBalance}
          setTaxAmountDirty={setTaxAmountDirty}
          updateField={updateField}
          onPayNow={isClient ? () => { void handleCreatePaymentLink(); } : undefined}
          isPaying={creatingPayment}
        />
      )}

      {/* Notes section - visible in overview for photographer and editing manager */}
      {(isPhotographer || role === 'editing_manager') && (
        <div className="p-2.5 border rounded-lg bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Notes</span>
          <ShootNotesTab
            shoot={shoot}
            isAdmin={isAdmin}
            isPhotographer={isPhotographer}
            role={role}
            hideEmptySections
          />
        </div>
      )}

      <OverviewPhotographerPickerDialog
        open={assignPhotographerOpen}
        onOpenChange={(open) => {
          if (open) {
            setAssignPhotographerOpen(true);
            return;
          }
          closePhotographerPicker();
        }}
        photographerPickerContext={photographerPickerContext}
        isEditMode={isEditMode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        isCalculatingDistances={isCalculatingDistances}
        isLoadingAvailability={isLoadingAvailability}
        filteredAndSortedPhotographers={filteredAndSortedPhotographers}
        selectedPhotographerId={selectedPhotographerId}
        setSelectedPhotographerId={setSelectedPhotographerId}
        formatLocationLabel={formatLocationLabel}
        buildAvailabilitySegments={buildAvailabilitySegments}
        formatAvailabilitySummary={formatAvailabilitySummary}
        handleAssignPhotographer={handleAssignPhotographer}
      />
    </div>
  );
}
