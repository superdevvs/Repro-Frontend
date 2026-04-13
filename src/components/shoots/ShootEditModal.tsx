import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CalendarIcon, 
  Edit, 
  Loader2, 
  MapPin, 
  User, 
  Clock, 
  Layers,
  Check,
  BellOff,
  FileText,
  Home,
  Search,
  Bath,
  BedDouble,
  Ruler
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { useMediaQuery } from '@/hooks/use-media-query';
import { API_BASE_URL } from '@/config/env';
import API_ROUTES from '@/lib/api';
import AddressLookupField, { type AddressDetails } from '@/components/AddressLookupField';
import { getShootPhotographerAssignmentGroups } from '@/utils/shootPhotographerAssignments';
import { calculatePricingBreakdown, type PricingDiscountType } from '@/utils/pricing';
import axios from 'axios';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SqftRange {
  id?: number;
  sqft_from: number;
  sqft_to: number;
  price: number;
  photographer_pay?: number | null;
}

interface Service {
  id: number | string;
  name: string;
  price?: number;
  pricing_type?: 'fixed' | 'variable';
  sqft_ranges?: SqftRange[];
  category?: { id: number | string; name: string } | string;
}

interface Photographer {
  id: string | number;
  name: string;
  avatar?: string;
  email?: string;
  city?: string;
  state?: string;
  address?: string;
  zip?: string;
}

interface PropertyDetails {
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  squareFeet?: number;
  square_feet?: number;
  livingArea?: number;
  living_area?: number;
  yearBuilt?: number;
  lotSize?: number;
  mls_id?: string;
  mlsId?: string;
  mlsNumber?: string;
  price?: number;
  listPrice?: number;
  lot_size?: number;
  year_built?: number;
  property_type?: string;
  propertyType?: string;
  zpid?: string;
  source?: string;
  confidence?: number;
  field_sources?: Record<string, string>;
  property_source_chain?: string[];
  [key: string]: unknown;
}

type PhotographerSource = {
  id?: string | number;
  name?: string;
  avatar?: string;
  profile_image?: string;
  profile_photo_url?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  zipcode?: string;
  metadata?: {
    address?: string;
    homeAddress?: string;
    city?: string;
    state?: string;
    zip?: string;
    zipcode?: string;
  };
};

type PropertyLookupInput = {
  property_details?: Record<string, unknown> | null;
  sqft?: number | string;
  squareFeet?: number | string;
  square_feet?: number | string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  lot_size?: number | string;
  year_built?: number | string;
  mls_id?: string;
  price?: number | string;
  property_type?: string;
  zpid?: string;
  source?: string;
  confidence?: number;
  field_sources?: Record<string, string>;
  property_source_chain?: string[];
  [key: string]: unknown;
};

type SelectedServiceSource =
  | string
  | {
      id?: string | number;
      service_id?: string | number;
      name?: string;
      label?: string;
    };

type ServiceApiRange = {
  id?: number;
  sqft_from?: number | string;
  sqft_to?: number | string;
  price?: number | string;
  photographer_pay?: number | string | null;
};

type ServiceApiRecord = {
  id?: string | number;
  name?: string;
  price?: number | string;
  pricing_type?: 'fixed' | 'variable' | string;
  category?: { id?: string | number; name?: string };
  sqft_ranges?: ServiceApiRange[];
  sqftRanges?: ServiceApiRange[];
};

interface ShootDetails {
  id: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  client?: {
    id: number;
    name: string;
    email?: string;
    phonenumber?: string;
    phone?: string;
    client_discount_type?: PricingDiscountType;
    client_discount_value?: number | string | null;
    clientDiscountType?: PricingDiscountType;
    clientDiscountValue?: number | string | null;
  };
  services?: Service[];
  serviceObjects?: Service[];
  scheduledAt?: string;
  scheduled_at?: string;
  totalQuote?: number;
  shoot_notes?: string;
  shootNotes?: string;
  location?: { address?: string; city?: string; state?: string; zip?: string };
  payment?: {
    totalQuote?: number;
    taxRate?: number | string | null;
    discount_type?: PricingDiscountType;
    discount_value?: number | string | null;
    discount_amount?: number | string | null;
    discountType?: PricingDiscountType;
    discountValue?: number | string | null;
    discountAmount?: number | string | null;
  };
  photographer_id?: number | string;
  photographer?: { id: number; name: string; email?: string };
  sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  property_details?: PropertyDetails;
  tax_percent?: number | string | null;
  taxPercent?: number | string | null;
  discount_type?: PricingDiscountType;
  discount_value?: number | string | null;
  discount_amount?: number | string | null;
  discountType?: PricingDiscountType;
  discountValue?: number | string | null;
  discountAmount?: number | string | null;
}

interface ShootEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  shootId: string | number;
  onSaved?: () => void;
}

type PhotographerPickerContext = {
  categoryKey?: string;
  categoryName?: string;
} | null;

type MobileEditPanel = 'details' | 'schedule' | 'services';

const normalizeCategoryKey = (value?: string) =>
  (value || 'other').trim().toLowerCase().replace(/s$/, '') || 'other';

const mapPhotographerOption = (photographer: PhotographerSource): Photographer => ({
  id: photographer.id?.toString() || '',
  name: photographer.name || 'Unknown',
  avatar: photographer.avatar || photographer.profile_image || photographer.profile_photo_url,
  email: photographer.email || '',
  address: photographer.address || photographer.metadata?.address || photographer.metadata?.homeAddress,
  city: photographer.city || photographer.metadata?.city,
  state: photographer.state || photographer.metadata?.state,
  zip: photographer.zip || photographer.zipcode || photographer.metadata?.zip || photographer.metadata?.zipcode,
});

const loadPhotographerOptions = async (): Promise<Photographer[]> => {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await axios.get(API_ROUTES.people.adminPhotographers, { headers });
    const data = response.data?.data || response.data || [];
    const formatted = Array.isArray(data) ? data.map(mapPhotographerOption) : [];
    if (formatted.length > 0) {
      return formatted;
    }
  } catch (error) {
    console.warn('[ShootEditModal] Admin photographers endpoint failed, falling back to public list:', error);
  }

  try {
    const response = await axios.get(API_ROUTES.people.photographers);
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data.map(mapPhotographerOption) : [];
  } catch (error) {
    console.error('[ShootEditModal] Public photographers endpoint failed:', error);
    return [];
  }
};

const extractLookupPropertyDetails = (details: PropertyLookupInput | AddressDetails | null | undefined): PropertyDetails => {
  const toOptionalNumber = (value: unknown): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const lookupDetails =
    details?.property_details && typeof details.property_details === 'object'
      ? (details.property_details as PropertyDetails)
      : {};
  const lookupInput = details as PropertyLookupInput | null | undefined;

  const sqft =
    details?.sqft ??
    lookupInput?.squareFeet ??
    lookupInput?.square_feet ??
    lookupDetails.sqft ??
    lookupDetails.squareFeet ??
    lookupDetails.square_feet ??
    lookupDetails.livingArea ??
    lookupDetails.living_area;
  const bedrooms = details?.bedrooms ?? lookupDetails.bedrooms ?? lookupDetails.beds;
  const bathrooms = details?.bathrooms ?? lookupDetails.bathrooms ?? lookupDetails.baths;
  const lotSize = details?.lot_size ?? lookupDetails.lot_size ?? lookupDetails.lotSize;
  const yearBuilt = details?.year_built ?? lookupDetails.year_built ?? lookupDetails.yearBuilt;

  return {
    ...lookupDetails,
    bedrooms: toOptionalNumber(bedrooms) ?? lookupDetails.bedrooms ?? undefined,
    beds: toOptionalNumber(bedrooms) ?? lookupDetails.beds ?? undefined,
    bathrooms: toOptionalNumber(bathrooms) ?? lookupDetails.bathrooms ?? undefined,
    baths: toOptionalNumber(bathrooms) ?? lookupDetails.baths ?? undefined,
    sqft: toOptionalNumber(sqft),
    squareFeet: toOptionalNumber(sqft) ?? lookupDetails.squareFeet ?? undefined,
    mls_id:
      details?.mls_id ??
      lookupDetails.mls_id ??
      lookupDetails.mlsId ??
      lookupDetails.mlsNumber ??
      undefined,
    price: toOptionalNumber(details?.price) ?? lookupDetails.price ?? lookupDetails.listPrice ?? undefined,
    lot_size: toOptionalNumber(lotSize),
    lotSize: toOptionalNumber(lotSize) ?? lookupDetails.lotSize ?? undefined,
    year_built: toOptionalNumber(yearBuilt),
    yearBuilt: toOptionalNumber(yearBuilt) ?? lookupDetails.yearBuilt ?? undefined,
    property_type:
      details?.property_type ??
      lookupDetails.property_type ??
      lookupDetails.propertyType ??
      undefined,
    zpid: details?.zpid ?? lookupDetails.zpid ?? undefined,
    source: details?.source ?? lookupDetails.source ?? undefined,
    confidence: details?.confidence ?? lookupDetails.confidence ?? undefined,
    field_sources: details?.field_sources ?? lookupDetails.field_sources ?? undefined,
    property_source_chain:
      details?.property_source_chain ?? lookupDetails.property_source_chain ?? undefined,
  };
};

const resolveSelectedServiceIds = (serviceSource: SelectedServiceSource[], servicesCatalog: Service[]) => {
  const ids = new Set<string>();

  serviceSource.forEach((service) => {
    const rawId = service && typeof service === 'object'
      ? service.id || service.service_id
      : undefined;
    const normalizedId = rawId != null ? String(rawId) : '';
    if (normalizedId && servicesCatalog.some((catalogService) => String(catalogService.id) === normalizedId)) {
      ids.add(normalizedId);
      return;
    }

    const rawName = typeof service === 'string'
      ? service
      : service?.name || service?.label;
    const normalizedName = String(rawName || '').trim().toLowerCase();
    if (!normalizedName) return;

    const matchedService = servicesCatalog.find((catalogService) =>
      String(catalogService.name || '').trim().toLowerCase() === normalizedName,
    );
    if (matchedService?.id != null) {
      ids.add(String(matchedService.id));
    }
  });

  return ids;
};

export function ShootEditModal({
  isOpen,
  onClose,
  shootId,
  onSaved,
}: ShootEditModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shootDetails, setShootDetails] = useState<ShootDetails | null>(null);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [photographerPickerOpen, setPhotographerPickerOpen] = useState(false);
  const [photographerPickerContext, setPhotographerPickerContext] = useState<PhotographerPickerContext>(null);
  const [pickerPhotographerId, setPickerPhotographerId] = useState('');
  const [photographerSearchQuery, setPhotographerSearchQuery] = useState('');
  const [expandedServiceCategoryKeys, setExpandedServiceCategoryKeys] = useState<string[]>([]);
  
  // Role checks
  const userRole = user?.role?.toLowerCase() || '';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isRep = userRole === 'rep' || userRole === 'salesrep';
  const isAdminOrRep = isAdmin || isRep;
  
  // Editable fields
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>('10:00');
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [photographerId, setPhotographerId] = useState<string>('');
  const [perCategoryPhotographers, setPerCategoryPhotographers] = useState<Record<string, string>>({});
  
  // Notes fields (role-based visibility)
  const [shootNotes, setShootNotes] = useState(''); // All: client, admin, rep
  const [companyNotes, setCompanyNotes] = useState(''); // Admin only
  const [photographerNotes, setPhotographerNotes] = useState(''); // Admin and rep
  const [editorNotes, setEditorNotes] = useState(''); // Admin and rep
  const showInternalNotes = isAdminOrRep;
  const [companyNotesOpen, setCompanyNotesOpen] = useState(false);
  const [photographerNotesOpen, setPhotographerNotesOpen] = useState(false);
  const [editorNotesOpen, setEditorNotesOpen] = useState(false);
  
  // Property details
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);
  const [propertySqft, setPropertySqft] = useState<number | null>(null);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobileEditPanel>('details');
  const isDesktopLayout = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    if (isOpen) {
      setActiveMobilePanel('details');
    }
  }, [isOpen, shootId]);

  // Fetch shoot details, services, and photographers when modal opens
  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen || !shootId) return;
      
      setIsLoading(true);
      setSelectedServiceIds(new Set());
      setPerCategoryPhotographers({});
      setPhotographerId('');
      setExpandedServiceCategoryKeys([]);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        // Fetch shoot details, services, and photographers in parallel
        const [shootResponse, servicesResponse, photographersData] = await Promise.all([
          fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_BASE_URL}/api/services`),
          loadPhotographerOptions(),
        ]);
        
        // Process services with sqft_ranges
        const servicesData = servicesResponse.data?.data || [];
        const mappedServices = servicesData.map((s: ServiceApiRecord) => ({
          id: s.id?.toString() || s.id,
          name: s.name,
          price: Number(s.price || 0),
          pricing_type: s.pricing_type || 'fixed',
          category: s.category ? { id: s.category.id, name: s.category.name } : undefined,
          sqft_ranges: (s.sqft_ranges || s.sqftRanges || []).map((r: ServiceApiRange) => ({
            ...r,
            sqft_from: Number(r.sqft_from) || 0,
            sqft_to: Number(r.sqft_to) || 0,
            price: Number(r.price) || 0,
            photographer_pay: r.photographer_pay != null ? Number(r.photographer_pay) : null,
          })),
        }));
        setAvailableServices(mappedServices);
        
        // Process photographers
        setPhotographers(photographersData);
        
        // Process shoot details
        if (shootResponse.ok) {
          const data = await shootResponse.json();
          const shoot = data.data || data;
          setShootDetails(shoot);
          
          // Initialize editable fields
          setAddress(shoot.address || shoot.location?.address || '');
          setCity(shoot.city || shoot.location?.city || '');
          setState(shoot.state || shoot.location?.state || '');
          setZip(shoot.zip || shoot.location?.zip || '');
          
          // Set all notes fields
          setShootNotes(shoot.shoot_notes || shoot.shootNotes || '');
          setCompanyNotes(shoot.company_notes || shoot.companyNotes || '');
          setPhotographerNotes(shoot.photographer_notes || shoot.photographerNotes || '');
          setEditorNotes(shoot.editor_notes || shoot.editorNotes || '');
          
          // Set photographer
          const photoId = shoot.photographer_id || shoot.photographer?.id;
          setPhotographerId(photoId ? photoId.toString() : '');
          
          // Set property details
          const sqft =
            shoot.sqft ||
            shoot.squareFeet ||
            shoot.square_feet ||
            shoot.property_details?.sqft ||
            shoot.property_details?.squareFeet ||
            shoot.property_details?.square_feet ||
            shoot.property_details?.livingArea ||
            shoot.property_details?.living_area ||
            null;
          setPropertySqft(sqft ? Number(sqft) : null);
          setPropertyDetails(
            extractLookupPropertyDetails({
              ...shoot,
              sqft: sqft ? Number(sqft) : undefined,
              bedrooms: shoot.bedrooms || shoot.property_details?.bedrooms,
              bathrooms: shoot.bathrooms || shoot.property_details?.bathrooms,
              property_details: shoot.property_details,
            })
          );
          
          // Set date/time
          const dateStr = shoot.scheduled_date || shoot.scheduledDate;
          if (dateStr) {
            // Extract just the date portion (YYYY-MM-DD) in case it includes time
            const dateOnly = dateStr.split(/[T\s]/)[0];
            const date = new Date(`${dateOnly}T12:00:00`);
            if (!isNaN(date.getTime())) {
              setScheduledDate(date);
            }
          } else {
            const scheduledAt = shoot.start_time || shoot.scheduled_at || shoot.scheduledAt;
            if (scheduledAt) {
              const date = new Date(scheduledAt);
              if (!isNaN(date.getTime())) {
                setScheduledDate(date);
              }
            }
          }

          const normalizedTime =
            normalizeTimeValue(
              shoot.time_label ||
                shoot.timeLabel ||
                shoot.time ||
                shoot.scheduled_time ||
                shoot.scheduledTime
            ) || null;

          if (normalizedTime) {
            setScheduledTime(normalizedTime);
            setTimeOptions(buildTimeOptions(normalizedTime));
          }
          
          // Set tax percent
          const rawTaxPercent = shoot.tax_percent ?? shoot.taxPercent ?? shoot.payment?.taxRate ?? 0;
          setTaxPercent(Number(rawTaxPercent) || 0);

          // Set selected services
          const serviceSource = Array.isArray(shoot.serviceObjects) && shoot.serviceObjects.length > 0
            ? shoot.serviceObjects
            : Array.isArray(shoot.services)
            ? shoot.services
            : [];

          if (serviceSource.length > 0) {
            const ids = resolveSelectedServiceIds(serviceSource, mappedServices);
            setSelectedServiceIds(ids);

            // Initialize per-category photographer assignments from shoot services
            const catPhotogMap: Record<string, string> = {};
            const assignmentGroups = getShootPhotographerAssignmentGroups({
              serviceObjects: Array.isArray(shoot.serviceObjects) ? shoot.serviceObjects : undefined,
              services: Array.isArray(shoot.services) ? shoot.services : [],
              photographer: shoot.photographer
                ? {
                    id: shoot.photographer.id,
                    name: shoot.photographer.name,
                    email: shoot.photographer.email,
                  }
                : { name: 'Unassigned' },
            });

            for (const group of assignmentGroups.groups) {
              const photographerId = group.photographer?.id;
              if (photographerId != null && !catPhotogMap[group.key]) {
                catPhotogMap[group.key] = String(photographerId);
              }
            }
            setPerCategoryPhotographers(catPhotogMap);
          }
        }
      } catch (error: unknown) {
        console.error('Error fetching data:', error);
        // Only show error if we don't already have shoot details loaded
        if (!shootDetails) {
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to load shoot details.',
            variant: 'destructive',
          });
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, shootId]);

  const clearAddressDerivedState = React.useCallback(() => {
    setCity('');
    setState('');
    setZip('');
    setPropertySqft(null);
    setPropertyDetails(null);
  }, []);

  // Handle address selection from AddressLookupField
  const handleAddressSelect = (details: AddressDetails) => {
    if (details) {
      setAddress(details.address || '');
      setCity(details.city || '');
      setState(details.state || '');
      setZip(details.zip || '');

      const nextPropertyDetails = extractLookupPropertyDetails(details);
      setPropertySqft(nextPropertyDetails.sqft ? Number(nextPropertyDetails.sqft) : null);
      setPropertyDetails(nextPropertyDetails);
    }
  };

  // Get service price based on sqft
  const getServicePrice = (service: Service): number => {
    if (service.pricing_type === 'variable' && propertySqft && service.sqft_ranges?.length) {
      const matchingRange = service.sqft_ranges.find(
        range => propertySqft >= range.sqft_from && propertySqft <= range.sqft_to
      );
      if (matchingRange) {
        return Number(matchingRange.price) || 0;
      }
    }
    return Number(service.price) || 0;
  };

  const hasVariablePricingWithoutSqft = React.useMemo(() => {
    if (!selectedServiceIds.size) return false;
    return Array.from(selectedServiceIds).some((id) => {
      const service = availableServices.find((s) => s.id?.toString() === id);
      return Boolean(service?.pricing_type === 'variable' && service.sqft_ranges?.length && !propertySqft);
    });
  }, [selectedServiceIds, availableServices, propertySqft]);

  useEffect(() => {
    if (!shootDetails || selectedServiceIds.size > 0 || availableServices.length === 0) return;
    const serviceSource = Array.isArray(shootDetails.serviceObjects) && shootDetails.serviceObjects.length > 0
      ? shootDetails.serviceObjects
      : Array.isArray(shootDetails.services)
      ? shootDetails.services
      : [];

    if (!serviceSource.length) return;

    const ids = resolveSelectedServiceIds(serviceSource, availableServices);
    if (ids.size > 0) {
      setSelectedServiceIds(ids);
    }
  }, [availableServices, selectedServiceIds.size, shootDetails]);

  const clientName = shootDetails?.client?.name || 'Unknown Client';
  const clientEmail = shootDetails?.client?.email || '';
  const clientPhone = shootDetails?.client?.phonenumber || shootDetails?.client?.phone || '';
  const activeDiscountType = (shootDetails?.discount_type ??
    shootDetails?.discountType ??
    shootDetails?.payment?.discount_type ??
    shootDetails?.payment?.discountType ??
    shootDetails?.client?.client_discount_type ??
    shootDetails?.client?.clientDiscountType ??
    null) as PricingDiscountType;
  const activeDiscountValue = Number(
    shootDetails?.discount_value ??
      shootDetails?.discountValue ??
      shootDetails?.payment?.discount_value ??
      shootDetails?.payment?.discountValue ??
      shootDetails?.client?.client_discount_value ??
      shootDetails?.client?.clientDiscountValue ??
      0,
  ) || 0;
  const photographerEmail =
    shootDetails?.photographer?.email ||
    photographers.find((photographer) => String(photographer.id) === String(photographerId || shootDetails?.photographer?.id))?.email ||
    '';

  const availableServiceCategoryGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; services: Service[]; serviceIds: string[] }>();

    availableServices.forEach((service) => {
      const serviceId = String(service.id);
      const categoryName =
        typeof service.category === 'string'
          ? service.category
          : service.category?.name || 'Other';
      const key = normalizeCategoryKey(categoryName);
      const existing = groups.get(key);
      if (existing) {
        existing.services.push(service);
        existing.serviceIds.push(serviceId);
      } else {
        groups.set(key, {
          key,
          name: categoryName,
          services: [service],
          serviceIds: [serviceId],
        });
      }
    });

    return Array.from(groups.values());
  }, [availableServices]);

  const selectedServiceCategoryGroups = useMemo(
    () =>
      availableServiceCategoryGroups
        .map((group) => ({
          ...group,
          serviceIds: group.serviceIds.filter((serviceId) => selectedServiceIds.has(serviceId)),
        }))
        .filter((group) => group.serviceIds.length > 0),
    [availableServiceCategoryGroups, selectedServiceIds],
  );

  useEffect(() => {
    const selectedCategoryKeys = availableServiceCategoryGroups
      .filter((group) => group.serviceIds.some((serviceId) => selectedServiceIds.has(serviceId)))
      .map((group) => group.key);

    setExpandedServiceCategoryKeys((previous) => {
      const validPrevious = previous.filter((key) =>
        availableServiceCategoryGroups.some((group) => group.key === key),
      );
      return Array.from(new Set([...validPrevious, ...selectedCategoryKeys]));
    });
  }, [availableServiceCategoryGroups, selectedServiceIds]);

  const hasMultiplePhotographerCategories = selectedServiceCategoryGroups.length > 1;

  const resolvePhotographerDetails = (value?: string | number | null) => {
    if (value === null || value === undefined || value === '') return null;
    const normalizedId = String(value);
    return (
      photographers.find((photographer) => String(photographer.id) === normalizedId) ||
      (shootDetails?.photographer && String(shootDetails.photographer.id) === normalizedId
        ? mapPhotographerOption(shootDetails.photographer)
        : null)
    );
  };

  const filteredPhotographers = useMemo(() => {
    if (!photographerSearchQuery.trim()) return photographers;
    const query = photographerSearchQuery.trim().toLowerCase();
    return photographers.filter((photographer) =>
      photographer.name.toLowerCase().includes(query) ||
      String(photographer.email || '').toLowerCase().includes(query) ||
      String(photographer.city || '').toLowerCase().includes(query) ||
      String(photographer.state || '').toLowerCase().includes(query),
    );
  }, [photographerSearchQuery, photographers]);

  const openPhotographerPicker = (context: PhotographerPickerContext) => {
    const singleCategory = selectedServiceCategoryGroups[0];
    const initialId = context?.categoryKey
      ? perCategoryPhotographers[context.categoryKey] || photographerId || ''
      : singleCategory
      ? perCategoryPhotographers[singleCategory.key] || photographerId || ''
      : photographerId || '';
    setPhotographerPickerContext(context);
    setPickerPhotographerId(initialId && initialId !== 'unassigned' ? initialId : '');
    setPhotographerSearchQuery('');
    setPhotographerPickerOpen(true);
  };

  const closePhotographerPicker = () => {
    setPhotographerPickerOpen(false);
    setPhotographerPickerContext(null);
    setPickerPhotographerId('');
    setPhotographerSearchQuery('');
  };

  const handleConfirmPhotographerPicker = () => {
    if (!pickerPhotographerId) return;

    if (photographerPickerContext?.categoryKey) {
      setPerCategoryPhotographers((prev) => ({
        ...prev,
        [photographerPickerContext.categoryKey as string]: pickerPhotographerId,
      }));
      if (!photographerId || photographerId === 'unassigned') {
        setPhotographerId(pickerPhotographerId);
      }
    } else {
      setPhotographerId(pickerPhotographerId);
      if (selectedServiceCategoryGroups.length === 1) {
        setPerCategoryPhotographers((prev) => ({
          ...prev,
          [selectedServiceCategoryGroups[0].key]: pickerPhotographerId,
        }));
      }
    }

    closePhotographerPicker();
  };

  const handleClearPhotographerPicker = () => {
    if (photographerPickerContext?.categoryKey) {
      const nextAssignments = { ...perCategoryPhotographers };
      delete nextAssignments[photographerPickerContext.categoryKey];
      setPerCategoryPhotographers(nextAssignments);
      if (selectedServiceCategoryGroups.length <= 1) {
        setPhotographerId('');
      }
    } else {
      setPhotographerId('');
      if (selectedServiceCategoryGroups.length === 1) {
        const nextAssignments = { ...perCategoryPhotographers };
        delete nextAssignments[selectedServiceCategoryGroups[0].key];
        setPerCategoryPhotographers(nextAssignments);
      }
    }
    closePhotographerPicker();
  };

  const buildApprovalPayload = () => {
    if (!address.trim()) {
      toast({
        title: 'Address required',
        description: 'Please enter a property address.',
        variant: 'destructive',
      });
      return null;
    }

    if (!scheduledDate) {
      toast({
        title: 'Date required',
        description: 'Please select a scheduled date.',
        variant: 'destructive',
      });
      return null;
    }

    if (selectedServiceIds.size === 0) {
      toast({
        title: 'Services required',
        description: 'Please select at least one service.',
        variant: 'destructive',
      });
      return null;
    }
    // Combine date and time
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const scheduledAt = new Date(scheduledDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    // Calculate totals for the payload
    const servicesTotal = Array.from(selectedServiceIds).reduce((sum, id) => {
      const service = availableServices.find(s => s.id?.toString() === id);
      return sum + (service ? getServicePrice(service) : 0);
    }, 0);
    const normalizedTaxRate = taxPercent > 1 ? taxPercent / 100 : taxPercent;
    const pricing = calculatePricingBreakdown({
      serviceSubtotal: servicesTotal,
      discountType: activeDiscountType,
      discountValue: activeDiscountValue,
      taxRate: normalizedTaxRate,
    });

    const payload: Record<string, unknown> = {
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      scheduled_at: scheduledAt.toISOString(),
      shoot_notes: shootNotes.trim(),
      services: Array.from(selectedServiceIds).map(id => {
        const service = availableServices.find(s => s.id?.toString() === id);
        return { 
          id: Number(id), 
          quantity: 1,
          price: service ? getServicePrice(service) : undefined
        };
      }),
      base_quote: pricing.discountedSubtotal,
      discount_type: pricing.discountType,
      discount_value: pricing.discountValue,
      discount_amount: pricing.discountAmount,
      tax_amount: pricing.taxAmount,
      total_quote: pricing.totalQuote,
    };

    // Add photographer if selected (admin/rep only)
    if (isAdminOrRep && photographerId && photographerId !== 'unassigned') {
      payload.photographer_id = Number(photographerId);
    }

    // Add per-service photographer assignments
    const normCatKey = (name: string) => name.trim().toLowerCase().replace(/s$/, '');
    if (Object.keys(perCategoryPhotographers).length > 0) {
      const servicePhotographerAssignments: Array<{ service_id: number; photographer_id: number }> = [];
      for (const svcId of selectedServiceIds) {
        const service = availableServices.find(s => s.id?.toString() === svcId);
        if (!service) continue;
        const catName = typeof service.category === 'string' ? service.category : service.category?.name || 'Other';
        const catKey = normCatKey(catName);
        const photogId = perCategoryPhotographers[catKey];
        if (photogId && photogId !== 'unassigned') {
          servicePhotographerAssignments.push({
            service_id: Number(svcId),
            photographer_id: Number(photogId),
          });
        }
      }
      if (servicePhotographerAssignments.length > 0) {
        payload.service_photographers = servicePhotographerAssignments;
      }
    }

    // Add role-based notes
    if (showInternalNotes) {
      if (companyNotes.trim()) payload.company_notes = companyNotes.trim();
      if (photographerNotes.trim()) payload.photographer_notes = photographerNotes.trim();
      if (editorNotes.trim()) payload.editor_notes = editorNotes.trim();
    }

    // Add property details
    const mergedPropertyDetails = propertyDetails
      ? {
          ...propertyDetails,
          sqft: propertySqft ?? propertyDetails.sqft ?? undefined,
          squareFeet: propertySqft ?? propertyDetails.squareFeet ?? propertyDetails.sqft ?? undefined,
        }
      : null;

    if (propertySqft !== null && propertySqft !== undefined) {
      payload.sqft = propertySqft;
    }
    if (propertyDetails?.bedrooms !== null && propertyDetails?.bedrooms !== undefined) {
      payload.bedrooms = propertyDetails.bedrooms;
    }
    if (propertyDetails?.bathrooms !== null && propertyDetails?.bathrooms !== undefined) {
      payload.bathrooms = propertyDetails.bathrooms;
    }
    if (mergedPropertyDetails && Object.keys(mergedPropertyDetails).length > 0) {
      payload.property_details = mergedPropertyDetails;
    }

    return payload;
  };

  const canNotifyClient = Boolean(clientEmail);
  const notificationPhotographerId = photographerId || shootDetails?.photographer?.id;
  const canNotifyPhotographer = Boolean(
    photographerEmail
      && (
        !shootDetails?.client?.id
        || String(notificationPhotographerId) !== String(shootDetails?.client?.id)
      )
  );

  const submitApproval = async ({
    notifyClient,
    notifyPhotographer,
    silent,
  }: {
    notifyClient: boolean;
    notifyPhotographer: boolean;
    silent: boolean;
  }) => {
    if (isSubmitting || isLoading) return;
    const payload = buildApprovalPayload();
    if (!payload) return;

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const approvalPayload = {
        ...payload,
        notify_client: notifyClient,
        notify_photographer: notifyPhotographer,
      };

      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(approvalPayload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve shoot');
      }

      toast({
        title: 'Shoot approved',
        description: silent
          ? 'The shoot request has been approved without sending notifications.'
          : 'The shoot request has been approved successfully.',
      });

      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Error approving shoot:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve shoot. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = () =>
    submitApproval({
      notifyClient: canNotifyClient,
      notifyPhotographer: canNotifyPhotographer,
      silent: false,
    });

  const handleApproveWithoutNotification = () =>
    submitApproval({
      notifyClient: false,
      notifyPhotographer: false,
      silent: true,
    });

  const toggleService = (serviceId: string) => {
    const newSet = new Set(selectedServiceIds);
    if (newSet.has(serviceId)) {
      newSet.delete(serviceId);
    } else {
      newSet.add(serviceId);
    }
    setSelectedServiceIds(newSet);
  };

  const normalizeTimeValue = (raw?: string | null): string | null => {
    if (!raw) return null;
    const value = raw.trim();
    if (!value) return null;

    const ampmMatch = value.match(/^(\d{1,2}):(\d{2})\s*([APap][Mm])$/);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = parseInt(ampmMatch[2], 10);
      const suffix = ampmMatch[3].toLowerCase();
      if (suffix === 'pm' && hours !== 12) hours += 12;
      if (suffix === 'am' && hours === 12) hours = 0;
      if (minutes >= 0 && minutes < 60 && hours >= 0 && hours < 24) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }

    const hhmmMatch = value.match(/^(\d{1,2}):(\d{2})(:\d{2})?$/);
    if (hhmmMatch) {
      const hours = parseInt(hhmmMatch[1], 10);
      const minutes = parseInt(hhmmMatch[2], 10);
      if (minutes >= 0 && minutes < 60 && hours >= 0 && hours < 24) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }

    return null;
  };

  const buildTimeOptions = React.useCallback(
    (ensure?: string | null) => {
      const options: { value: string; label: string }[] = [];
      for (let h = 5; h < 23; h++) {
        for (const m of ['00', '30']) {
          const hour = h.toString().padStart(2, '0');
          const period = h >= 12 ? 'PM' : 'AM';
          const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
          options.push({
            value: `${hour}:${m}`,
            label: `${displayHour}:${m} ${period}`,
          });
        }
      }
      if (ensure && !options.find((o) => o.value === ensure)) {
        const [h, m] = ensure.split(':').map((v) => parseInt(v, 10));
        if (!Number.isNaN(h) && !Number.isNaN(m)) {
          const period = h >= 12 ? 'PM' : 'AM';
          const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
          options.push({
            value: ensure,
            label: `${displayHour}:${m.toString().padStart(2, '0')} ${period}`,
          });
          options.sort((a, b) => a.value.localeCompare(b.value));
        }
      }
      return options;
    },
    [],
  );

  const [timeOptions, setTimeOptions] = useState<{ value: string; label: string }[]>(() =>
    buildTimeOptions(scheduledTime),
  );
  const minSelectableDate = useMemo(
    () => format(new Date(), 'yyyy-MM-dd'),
    [],
  );
  const scheduledDateInputValue = useMemo(
    () => (scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : ''),
    [scheduledDate],
  );

  const renderDetailsPanel = () => (
    <div className="space-y-3 md:min-h-0 md:overflow-y-auto md:pr-1">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <User className="h-4 w-4 text-blue-500" />
          <p className="text-sm font-semibold">Client</p>
        </div>
        <p className="font-medium">{clientName}</p>
        {clientEmail && (
          <p className="text-sm text-muted-foreground">{clientEmail}</p>
        )}
        {clientPhone && (
          <p className="text-sm text-muted-foreground">{clientPhone}</p>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold">Property Address</p>
        </div>

        <AddressLookupField
          value={address}
          onChange={setAddress}
          onSelectionReset={clearAddressDerivedState}
          onSelectionStarted={() => {
            setAddress('');
            clearAddressDerivedState();
          }}
          onAddressSelect={handleAddressSelect}
          placeholder="Search address..."
        />

        <div className="grid grid-cols-3 gap-1.5">
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="h-8 text-xs"
          />
          <Input
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="ST"
            className="h-8 text-xs"
            maxLength={2}
          />
          <Input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="ZIP"
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Property Details
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-[10px]">
              <BedDouble className="h-3 w-3" /> Beds
            </Label>
            <Input
              type="number"
              value={propertyDetails?.bedrooms || ''}
              onChange={(e) => setPropertyDetails((prev) => ({
                ...prev,
                bedrooms: e.target.value ? Number(e.target.value) : undefined,
              }))}
              placeholder="0"
              className="h-7 text-xs"
              min={0}
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-[10px]">
              <Bath className="h-3 w-3" /> Baths
            </Label>
            <Input
              type="number"
              step="0.5"
              value={propertyDetails?.bathrooms || ''}
              onChange={(e) => setPropertyDetails((prev) => ({
                ...prev,
                bathrooms: e.target.value ? Number(e.target.value) : undefined,
              }))}
              placeholder="0"
              className="h-7 text-xs"
              min={0}
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-[10px]">
              <Ruler className="h-3 w-3" /> Sqft
            </Label>
            <Input
              type="number"
              value={propertySqft || ''}
              onChange={(e) => setPropertySqft(e.target.value ? Number(e.target.value) : null)}
              placeholder="0"
              className="h-7 text-xs"
              min={0}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-500" />
          <Label className="text-xs font-semibold">Shoot Notes</Label>
        </div>
        <Textarea
          value={shootNotes}
          onChange={(e) => setShootNotes(e.target.value)}
          placeholder="Access codes, instructions..."
          rows={2}
          className="resize-none text-xs"
        />
      </div>

      {showInternalNotes && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <Label className="text-xs font-semibold">Company Notes</Label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setCompanyNotesOpen((v) => !v)}
            >
              {companyNotesOpen ? 'Hide' : 'Show'}
            </Button>
          </div>
          {companyNotesOpen && (
            <Textarea
              value={companyNotes}
              onChange={(e) => setCompanyNotes(e.target.value)}
              placeholder="Internal notes..."
              rows={2}
              className="resize-none text-xs"
            />
          )}
        </div>
      )}
    </div>
  );

  const renderSchedulePanel = () => (
    <div className="space-y-3 md:min-h-0 md:overflow-y-auto md:pr-1">
      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold">Schedule</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Date *</Label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                min={minSelectableDate}
                value={scheduledDateInputValue}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) {
                    setScheduledDate(undefined);
                    return;
                  }
                  const nextDate = new Date(`${value}T12:00:00`);
                  if (!Number.isNaN(nextDate.getTime())) {
                    setScheduledDate(nextDate);
                  }
                }}
                className={cn(
                  'h-8 pl-8 text-xs',
                  !scheduledDate && 'text-muted-foreground',
                )}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">Time</Label>
            <Select value={scheduledTime} onValueChange={setScheduledTime}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isAdminOrRep && (() => {
          if (hasMultiplePhotographerCategories) {
            return (
              <div className="space-y-2">
                <Label className="text-[10px]">Photographers (per category)</Label>
                {selectedServiceCategoryGroups.map((group) => {
                  const selectedPhotographer = resolvePhotographerDetails(
                    perCategoryPhotographers[group.key] || photographerId,
                  );

                  return (
                    <div
                      key={group.key}
                      className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5"
                    >
                      <div className="min-w-0 space-y-1 text-xs">
                        <div className="text-[9px] font-medium uppercase text-muted-foreground">
                          {group.name}
                        </div>
                        <div className="font-medium">
                          {selectedPhotographer?.name || 'Unassigned'}
                        </div>
                        {selectedPhotographer?.email && (
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
                          openPhotographerPicker({
                            categoryKey: group.key,
                            categoryName: group.name,
                          })
                        }
                      >
                        {selectedPhotographer ? 'Edit photographer' : 'Select photographer'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            );
          }

          const selectedPhotographer = resolvePhotographerDetails(photographerId);

          return (
            <div className="space-y-2">
              <Label className="text-[10px]">Photographer</Label>
              <div className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5">
                <div className="min-w-0 space-y-1 text-xs">
                  <div className="font-medium">
                    {selectedPhotographer?.name || 'Unassigned'}
                  </div>
                  {selectedPhotographer?.email && (
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
                  onClick={() => openPhotographerPicker(null)}
                >
                  {selectedPhotographer ? 'Edit photographer' : 'Select photographer'}
                </Button>
              </div>
            </div>
          );
        })()}
      </div>

      {showInternalNotes && (
        <div className="space-y-3">
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-500" />
                <Label className="text-xs font-semibold">Photographer Notes</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPhotographerNotesOpen((v) => !v)}
              >
                {photographerNotesOpen ? 'Hide' : 'Show'}
              </Button>
            </div>
            {photographerNotesOpen && (
              <Textarea
                value={photographerNotes}
                onChange={(e) => setPhotographerNotes(e.target.value)}
                placeholder="Notes for the photographer"
                rows={2}
                className="resize-none text-xs"
              />
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-500" />
                <Label className="text-xs font-semibold">Editor Notes</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setEditorNotesOpen((v) => !v)}
              >
                {editorNotesOpen ? 'Hide' : 'Show'}
              </Button>
            </div>
            {editorNotesOpen && (
              <Textarea
                value={editorNotes}
                onChange={(e) => setEditorNotes(e.target.value)}
                placeholder="Notes for the editor"
                rows={2}
                className="resize-none text-xs"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderServicesPanel = () => (
    <div className="space-y-3 md:flex md:min-h-0 md:flex-col md:overflow-hidden">
      <div className="flex min-h-[360px] flex-col rounded-lg border border-border p-3 md:min-h-0 md:flex-1 md:overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-500" />
            <p className="text-xs font-semibold">Services *</p>
          </div>
          {propertySqft && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {propertySqft.toLocaleString()} sqft
            </Badge>
          )}
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-visible pr-1 md:max-h-full md:overflow-y-auto">
          <Accordion
            type="multiple"
            value={expandedServiceCategoryKeys}
            onValueChange={setExpandedServiceCategoryKeys}
            className="space-y-2"
          >
            {availableServiceCategoryGroups.map((group) => {
              const selectedCount = group.serviceIds.filter((serviceId) =>
                selectedServiceIds.has(serviceId),
              ).length;

              return (
                <AccordionItem
                  key={group.key}
                  value={group.key}
                  className="rounded-md border border-border px-2"
                >
                  <AccordionTrigger className="py-2 text-xs hover:no-underline">
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                      <span className="truncate font-semibold">{group.name}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {selectedCount} selected
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="space-y-1.5">
                      {group.services.map((service) => {
                        const serviceId = String(service.id);
                        const isSelected = selectedServiceIds.has(serviceId);
                        const price = getServicePrice(service);
                        const isVariablePricing =
                          service.pricing_type === 'variable' && service.sqft_ranges?.length;
                        const showVariablePlaceholder = isVariablePricing && !propertySqft;

                        return (
                          <div
                            key={serviceId}
                            className={cn(
                              'flex items-center justify-between rounded-md border p-2 transition-colors',
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50',
                            )}
                            onClick={() => toggleService(serviceId)}
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleService(serviceId)}
                                onClick={(event) => event.stopPropagation()}
                                className="h-3.5 w-3.5"
                              />
                              <span className="truncate text-xs font-medium">{service.name}</span>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 text-xs font-medium',
                                isVariablePricing && propertySqft
                                  ? 'text-emerald-600'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {showVariablePlaceholder ? 'Varies' : `$${price.toFixed(0)}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>

        {selectedServiceIds.size > 0 && (() => {
          const servicesTotal = hasVariablePricingWithoutSqft
            ? 0
            : Array.from(selectedServiceIds).reduce((sum, id) => {
              const service = availableServices.find((s) => s.id?.toString() === id);
              return sum + (service ? getServicePrice(service) : 0);
            }, 0);
          const normalizedTaxRate = taxPercent > 1 ? taxPercent / 100 : taxPercent;
          const pricing = calculatePricingBreakdown({
            serviceSubtotal: servicesTotal,
            discountType: activeDiscountType,
            discountValue: activeDiscountValue,
            taxRate: normalizedTaxRate,
          });
          const discountLabel = pricing.discountType === 'fixed'
            ? `Discount ($${pricing.discountValue?.toFixed?.(2) ?? Number(pricing.discountValue || 0).toFixed(2)})`
            : `Discount (${Number(pricing.discountValue || 0)}%)`;
          return (
            <div className="mt-3 space-y-1 border-t pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Selected:</span>
                <span className="font-semibold">{selectedServiceIds.size} service(s)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Base:</span>
                <span className={cn(
                  'font-semibold',
                  hasVariablePricingWithoutSqft ? 'text-amber-600' : '',
                )}>
                  {hasVariablePricingWithoutSqft ? 'TBD' : `$${servicesTotal.toFixed(2)}`}
                </span>
              </div>
              {!hasVariablePricingWithoutSqft && pricing.discountAmount > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{discountLabel}:</span>
                  <span className="font-medium text-emerald-600">
                    -${pricing.discountAmount.toFixed(2)}
                  </span>
                </div>
              )}
              {!hasVariablePricingWithoutSqft && taxPercent > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Tax ({taxPercent > 1 ? taxPercent : (taxPercent * 100).toFixed(1)}%):
                  </span>
                  <span className="font-medium">${pricing.taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Total:</span>
                <span className={cn(
                  hasVariablePricingWithoutSqft ? 'text-amber-600' : 'text-emerald-600',
                )}>
                  {hasVariablePricingWithoutSqft ? 'TBD' : `$${pricing.totalQuote.toFixed(2)}`}
                </span>
              </div>
              {hasVariablePricingWithoutSqft && (
                <p className="text-[10px] text-muted-foreground">
                  Sqft required for accurate variable pricing.
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0 text-slate-900 dark:text-slate-100 sm:max-w-[900px] md:max-w-[1100px] lg:max-w-[1200px]">
        <DialogHeader className="shrink-0 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3 pr-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <Edit className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <DialogTitle className="text-xl">Modify Shoot Request</DialogTitle>
              <DialogDescription className="mt-1">
                Edit the shoot details below
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:px-6 md:grid-cols-3">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 md:overflow-hidden">
            {isDesktopLayout ? (
              <div className="grid grid-cols-1 gap-4 md:h-full md:min-h-0 md:grid-cols-3 md:items-stretch">
                {renderDetailsPanel()}
                {renderSchedulePanel()}
                {renderServicesPanel()}
              </div>
            ) : (
              <Tabs
                value={activeMobilePanel}
                onValueChange={(value) => setActiveMobilePanel(value as MobileEditPanel)}
                className="space-y-3"
              >
                <div className="sticky top-0 z-10 bg-background pb-1">
                  <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-muted/60 p-1">
                    <TabsTrigger value="details" className="h-9 rounded-lg text-xs font-semibold">
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="schedule" className="h-9 rounded-lg text-xs font-semibold">
                      Schedule
                    </TabsTrigger>
                    <TabsTrigger value="services" className="h-9 rounded-lg text-xs font-semibold">
                      Services
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="details" className="mt-0">
                  {renderDetailsPanel()}
                </TabsContent>
                <TabsContent value="schedule" className="mt-0">
                  {renderSchedulePanel()}
                </TabsContent>
                <TabsContent value="services" className="mt-0">
                  {renderServicesPanel()}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}

        <DialogFooter className="mt-1 shrink-0 gap-2 border-t border-border/60 px-4 py-4 sm:px-6 sm:py-5">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleApproveWithoutNotification}
            disabled={isSubmitting || isLoading}
            className="w-full sm:min-w-[220px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <BellOff className="mr-2 h-4 w-4" />
                Approve without notification
              </>
            )}
          </Button>
          <Button 
            onClick={handleApprove} 
            disabled={isSubmitting || isLoading} 
            className="w-full bg-blue-600 hover:bg-blue-700 sm:min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Approve
              </>
            )}
          </Button>
        </DialogFooter>

        <Dialog open={photographerPickerOpen} onOpenChange={(open) => {
          if (!open) {
            closePhotographerPicker();
          }
        }}>
          <DialogContent className="w-[92vw] max-h-[90vh] overflow-hidden p-0 sm:max-w-2xl">
            <div className="flex h-full flex-col sm:h-[70vh]">
              <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
                <DialogHeader className="items-start space-y-1 text-left">
                  <DialogTitle className="text-xl text-slate-900 dark:text-slate-100">
                    {photographerPickerContext?.categoryName
                      ? `Select Photographer for ${photographerPickerContext.categoryName}`
                      : 'Select Photographer'}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                    Curated network - {filteredPhotographers.length} available
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or area..."
                      value={photographerSearchQuery}
                      onChange={(e) => setPhotographerSearchQuery(e.target.value)}
                      className="h-11 rounded-full bg-slate-50 pl-9 dark:bg-slate-900/50"
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                  {filteredPhotographers.length > 0 ? (
                    <div className="grid gap-3">
                      {filteredPhotographers.map((photographer) => {
                        const isSelected = pickerPhotographerId === String(photographer.id);

                        return (
                          <button
                            type="button"
                            key={photographer.id}
                            onClick={() => setPickerPhotographerId(String(photographer.id))}
                            className={cn(
                              'w-full rounded-[28px] border px-5 py-4 text-left transition-all',
                              isSelected
                                ? 'border-blue-500/80 bg-blue-950/35 shadow-[0_0_0_1px_rgba(59,130,246,0.18)]'
                                : 'border-slate-200/70 bg-slate-50/90 hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-blue-800',
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <Avatar className="h-12 w-12 shrink-0">
                                <AvatarImage src={photographer.avatar} alt={photographer.name} />
                                <AvatarFallback>{photographer.name?.charAt(0)}</AvatarFallback>
                              </Avatar>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {photographer.name}
                                    </div>
                                    {photographer.email && (
                                      <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                        {photographer.email}
                                      </div>
                                    )}
                                  </div>

                                  <span
                                    className={cn(
                                      'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors',
                                      isSelected
                                        ? 'border-blue-500 bg-blue-600 text-white'
                                        : 'border-slate-300 bg-transparent text-transparent dark:border-slate-700',
                                    )}
                                    aria-hidden="true"
                                  >
                                    <Check className="h-4 w-4" />
                                  </span>
                                </div>

                                {(photographer.city || photographer.state) && (
                                  <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                                    {[photographer.city, photographer.state].filter(Boolean).join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      {photographerSearchQuery ? 'No photographers found matching your search.' : 'No photographers available.'}
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 border-t border-slate-200/70 bg-white/80 pt-4 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/50">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        className={cn(
                          'h-10 w-10 shrink-0',
                          resolvePhotographerDetails(pickerPhotographerId)
                            ? 'ring-2 ring-blue-500/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
                            : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                        )}
                      >
                        {resolvePhotographerDetails(pickerPhotographerId) ? (
                          <>
                            <AvatarImage
                              src={resolvePhotographerDetails(pickerPhotographerId)?.avatar}
                              alt={resolvePhotographerDetails(pickerPhotographerId)?.name}
                            />
                            <AvatarFallback>{resolvePhotographerDetails(pickerPhotographerId)?.name?.charAt(0)}</AvatarFallback>
                          </>
                        ) : (
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        )}
                      </Avatar>

                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-blue-500/80">
                          {photographerPickerContext?.categoryName
                            ? `Photographer for ${photographerPickerContext.categoryName}`
                            : 'Selected specialist'}
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {resolvePhotographerDetails(pickerPhotographerId)?.name || 'None selected'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 self-stretch lg:self-auto">
                      <Button variant="outline" onClick={handleClearPhotographerPicker} className="flex-1 lg:flex-none">
                        Leave unassigned
                      </Button>
                      <Button variant="ghost" onClick={closePhotographerPicker} className="flex-1 lg:flex-none">
                        Discard
                      </Button>
                      <Button onClick={handleConfirmPhotographerPicker} disabled={!pickerPhotographerId} className="flex-1 lg:flex-none">
                        Use selection
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>

    </Dialog>
  );
}
