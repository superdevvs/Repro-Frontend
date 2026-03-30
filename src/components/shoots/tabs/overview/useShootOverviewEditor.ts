/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isValid, parse } from 'date-fns';
import axios from 'axios';
import { ShootData } from '@/types/shoots';
import { API_BASE_URL } from '@/config/env';
import API_ROUTES from '@/lib/api';
import { calculateDistance, getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { getServicePricingForSqft } from '@/utils/servicePricing';
import {
  getShootPhotographerAssignmentGroups,
  normalizeShootServiceCategoryKey,
} from '@/utils/shootPhotographerAssignments';
import { to12Hour } from '@/utils/availabilityUtils';
import { buildNormalizedPropertyDetails } from '@/components/AddressLookupField';
import { setNestedDraftValue } from './draftUtils';

type PresenceOption = 'self' | 'other' | 'lockbox';

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

type ClientOption = {
  id: string;
  name: string;
  email: string;
  company?: string;
};

type UseShootOverviewEditorArgs = {
  shoot: ShootData;
  isAdmin: boolean;
  role: string;
  isEditMode?: boolean;
  onShootUpdate: () => void;
  onSave?: (updates: Partial<ShootData>) => void;
  onCancel?: () => void;
  onRegisterEditActions?: (actions: { save: () => void; cancel: () => void }) => void;
  toast: (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
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
    const parsedDate = new Date(timestamp);
    if (isValid(parsedDate)) return parsedDate;
  }
  for (const formatString of FLEXIBLE_DATE_FORMATS) {
    try {
      const parsedDate = parse(trimmed, formatString, new Date());
      if (isValid(parsedDate)) return parsedDate;
    } catch {
      // Ignore invalid matches and continue through the fallback formats.
    }
  }
  return null;
};

const formatDateForInput = (dateString?: string | null) => {
  if (!dateString) return format(new Date(), 'yyyy-MM-dd');
  try {
    const parsedDate = parseFlexibleDate(dateString);
    if (!parsedDate) return format(new Date(), 'yyyy-MM-dd');
    return format(parsedDate, 'yyyy-MM-dd');
  } catch {
    return format(new Date(), 'yyyy-MM-dd');
  }
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'uncategorized';

const normalizeCategoryName = (value?: string) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'photo' || normalized === 'photos') return 'photos';
  return normalized;
};

const deriveServiceCategoryId = (service: ServiceOption) => {
  const categoryName = typeof service.category === 'string' ? service.category : service.category?.name;
  const normalizedName = normalizeCategoryName(categoryName);
  if (normalizedName === 'photos') return 'photos';
  if (!service.category) return 'uncategorized';
  if (typeof service.category === 'string') return slugify(normalizedName || service.category);
  if (service.category.id) return String(service.category.id);
  if (service.category.name) return slugify(normalizedName || service.category.name);
  return 'uncategorized';
};

const deriveServiceCategoryName = (service: ServiceOption) => {
  const categoryName = typeof service.category === 'string' ? service.category : service.category?.name;
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
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await axios.get(API_ROUTES.people.adminPhotographers, { headers });
    const data = response.data?.data || response.data || [];
    const formatted = Array.isArray(data) ? data.map(mapPhotographerPickerOption) : [];
    if (formatted.length > 0) return formatted;
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

const toNumberOrUndefined = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return undefined;
  const parsedValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const formatEditableValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : String(numeric);
};

const deriveMetricsFromAddress = (details: AddressDetailsForLookup) => {
  const propertyDetails = details.property_details || {};
  const bedrooms = details.bedrooms ?? (propertyDetails as any).beds ?? (propertyDetails as any).bedrooms ?? (propertyDetails as any).bed;
  const bathrooms = details.bathrooms ?? (details as any).baths ?? (propertyDetails as any).baths ?? (propertyDetails as any).bathrooms ?? (propertyDetails as any).bath;
  const sqft = details.sqft ?? (propertyDetails as any).sqft ?? (propertyDetails as any).livingArea ?? (propertyDetails as any).living_area ?? (propertyDetails as any).squareFeet ?? (propertyDetails as any).square_feet;
  return { bedrooms, bathrooms, sqft };
};

const extractLookupPropertyDetails = (details: AddressDetailsForLookup) =>
  buildNormalizedPropertyDetails({
    ...details,
    property_details:
      details.property_details && typeof details.property_details === 'object'
        ? (details.property_details as Record<string, any>)
        : {},
  });

function useOverviewLookupData(
  isEditMode: boolean,
  shoot: ShootData,
  effectiveSqft: number | null,
  resolveServicePrice: (service: ServiceOption, sqft: number | null, overrideValue?: string) => { price: number; basePrice: number; hasOverride: boolean },
  setClients: Dispatch<SetStateAction<ClientOption[]>>,
  setServicesList: Dispatch<SetStateAction<ServiceOption[]>>,
  setSelectedServiceIds: Dispatch<SetStateAction<string[]>>,
  setServicePrices: Dispatch<SetStateAction<Record<string, string>>>,
  setServicePhotographerPays: Dispatch<SetStateAction<Record<string, string>>>,
  setEditPhotographers: Dispatch<SetStateAction<PhotographerPickerOption[]>>,
) {
  useEffect(() => {
    if (!isEditMode) return;

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
        const clientsList = (json.data || json || []).map((client: any) => ({
          id: String(client.id),
          name: client.name,
          email: client.email || '',
          company: client.company_name || client.company || '',
        }));
        const currentClient = shoot.client;
        if (currentClient && !clientsList.some((client: ClientOption) => client.id === String(currentClient.id))) {
          clientsList.unshift({
            id: String(currentClient.id),
            name: currentClient.name || 'Current client',
            email: currentClient.email || '',
            company: currentClient.company || '',
          });
        }
        setClients(clientsList);
      } catch (error) {
        console.error('Error fetching clients:', error);
      }
    };

    const fetchServices = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/services`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (!response.ok) return;
        const json = await response.json();
        const servicesData = (json.data || json || []).map((service: any) => ({
          id: String(service.id),
          name: service.name,
          price: Number(service.price) || 0,
          pricing_type: service.pricing_type || 'fixed',
          allow_multiple: service.allow_multiple ?? false,
          sqft_ranges: (service.sqft_ranges || service.sqftRanges || []).map((range: any) => ({
            ...range,
            sqft_from: Number(range.sqft_from) || 0,
            sqft_to: Number(range.sqft_to) || 0,
            price: Number(range.price) || 0,
            photographer_pay: range.photographer_pay != null ? Number(range.photographer_pay) : null,
            duration: range.duration != null ? Number(range.duration) : null,
          })),
          category: service.category || service.service_category || null,
          description: service.description || '',
          photographer_pay: service.photographer_pay != null ? Number(service.photographer_pay) : null,
          duration: service.duration != null ? Number(service.duration) : null,
        }));
        setServicesList(servicesData);

        const serviceSource: any[] = shoot.serviceObjects && shoot.serviceObjects.length > 0
          ? shoot.serviceObjects
          : (Array.isArray(shoot.services) ? shoot.services : []);
        if (serviceSource.length === 0 || servicesData.length === 0) return;

        const currentServiceIds = serviceSource
          .map((service: any) => {
            if (typeof service === 'string') {
              const foundService = servicesData.find((serviceOption: any) => serviceOption.name === service);
              return foundService ? foundService.id : null;
            }
            if (service && typeof service === 'object') {
              return String(service.id || service.service_id || '');
            }
            return null;
          })
          .filter(Boolean) as string[];

        setSelectedServiceIds(currentServiceIds);

        const nextPrices: Record<string, string> = {};
        const nextPhotographerPays: Record<string, string> = {};
        serviceSource.forEach((service: any) => {
          if (!service || typeof service !== 'object') return;
          const serviceId = String(service.id || service.service_id || '');
          if (!serviceId || !currentServiceIds.includes(serviceId)) return;
          const serviceRecord = servicesData.find((serviceOption: ServiceOption) => serviceOption.id === serviceId);
          const basePrice = serviceRecord
            ? resolveServicePrice(serviceRecord, effectiveSqft).basePrice
            : Number(service.price ?? 0);
          const normalizedBasePrice = Number.isFinite(basePrice) ? basePrice : 0;
          const parsedPrice = service.price === null || service.price === undefined || service.price === ''
            ? NaN
            : Number(service.price);
          const shouldUsePrice = Number.isFinite(parsedPrice)
            && (
              (normalizedBasePrice === 0 && parsedPrice > 0)
              || (normalizedBasePrice > 0 && Math.abs(parsedPrice - normalizedBasePrice) > 0.01)
            );
          if (shouldUsePrice) nextPrices[serviceId] = String(parsedPrice);
          if (service.photographer_pay !== undefined && service.photographer_pay !== null) {
            nextPhotographerPays[serviceId] = String(service.photographer_pay);
          }
        });
        setServicePrices(nextPrices);
        setServicePhotographerPays(nextPhotographerPays);
      } catch (error) {
        console.error('Error fetching services:', error);
      }
    };

    const fetchPhotographers = async () => {
      try {
        const photographersList = await loadPhotographerPickerOptions();
        const nextPhotographers = [...photographersList];
        const currentPhotographer = shoot.photographer;
        if (currentPhotographer && !nextPhotographers.some((photographer) => photographer.id === String(currentPhotographer.id))) {
          nextPhotographers.unshift(mapPhotographerPickerOption(currentPhotographer));
        }
        setEditPhotographers(nextPhotographers);
      } catch (error) {
        console.error('Error fetching photographers:', error);
        setEditPhotographers([]);
      }
    };

    fetchClients();
    fetchServices();
    fetchPhotographers();
  }, [
    effectiveSqft,
    isEditMode,
    resolveServicePrice,
    setClients,
    setEditPhotographers,
    setSelectedServiceIds,
    setServicePhotographerPays,
    setServicePrices,
    setServicesList,
    shoot,
  ]);
}

function usePhotographerAssignmentOptions(
  assignPhotographerOpen: boolean,
  editPhotographers: PhotographerPickerOption[],
  isAdminOrRep: boolean,
  isEditMode: boolean,
  setPhotographers: Dispatch<SetStateAction<PhotographerPickerOption[]>>,
  setEditPhotographers: Dispatch<SetStateAction<PhotographerPickerOption[]>>,
) {
  useEffect(() => {
    if (!assignPhotographerOpen) return;

    if (editPhotographers.length > 0) {
      setPhotographers((current) => current.length > 0 ? current : editPhotographers.map((photographer) => ({ ...photographer })));
    }

    if (!isAdminOrRep && !isEditMode) return;

    const fetchPhotographers = async () => {
      try {
        const photographersList = await loadPhotographerPickerOptions();
        if (photographersList.length > 0) {
          setPhotographers(photographersList);
          setEditPhotographers((current) => current.length > 0 ? current : photographersList);
        }
      } catch (error) {
        console.error('Error fetching photographers:', error);
      }
    };

    fetchPhotographers();
  }, [assignPhotographerOpen, editPhotographers, isAdminOrRep, isEditMode, setEditPhotographers, setPhotographers]);
}

function usePhotographerDistanceAvailability(
  assignPhotographerOpen: boolean,
  photographers: PhotographerPickerOption[],
  isAdminOrRep: boolean,
  getShootLocation: () => { address: string; city: string; state: string; zip: string },
  setPhotographers: Dispatch<SetStateAction<PhotographerPickerOption[]>>,
  setIsCalculatingDistances: Dispatch<SetStateAction<boolean>>,
  setIsLoadingAvailability: Dispatch<SetStateAction<boolean>>,
) {
  const shootLocation = getShootLocation();
  const shootLocationKey = [
    shootLocation.address,
    shootLocation.city,
    shootLocation.state,
    shootLocation.zip,
  ].join('|');
  const photographerDistanceKey = photographers
    .map((photographer) => [
      photographer.id,
      photographer.originAddress?.address || photographer.address || '',
      photographer.originAddress?.city || photographer.city || '',
      photographer.originAddress?.state || photographer.state || '',
      photographer.originAddress?.zip || photographer.zip || '',
    ].join('|'))
    .join('::');
  const photographerAvailabilityKey = photographers
    .map((photographer) => String(photographer.id))
    .join(',');

  useEffect(() => {
    const calculateDistances = async () => {
      if (!assignPhotographerOpen || photographers.length === 0) return;
      if (!shootLocation.address || !shootLocation.city || !shootLocation.state) return;
      if (photographers.every((photographer) => photographer.distance !== undefined)) return;

      setIsCalculatingDistances(true);
      try {
        const shootCoords = await getCoordinatesFromAddress(
          shootLocation.address,
          shootLocation.city,
          shootLocation.state,
          shootLocation.zip,
        );
        if (!shootCoords) return;

        const photographersWithDistance = await Promise.all(
          photographers.map(async (photographer) => {
            if (photographer.distance !== undefined && photographer.originAddress) return photographer;

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
              sourceZip,
            );
            if (!photographerCoords) {
              return { ...photographer, distance: undefined };
            }

            const distance = calculateDistance(
              shootCoords.lat,
              shootCoords.lon,
              photographerCoords.lat,
              photographerCoords.lon,
            );

            return {
              ...photographer,
              distance: Math.round(distance * 10) / 10,
            };
          }),
        );

        setPhotographers(photographersWithDistance);
      } catch (error) {
        console.error('Error calculating distances:', error);
      } finally {
        setIsCalculatingDistances(false);
      }
    };

    calculateDistances();
  }, [
    assignPhotographerOpen,
    photographerDistanceKey,
    setIsCalculatingDistances,
    setPhotographers,
    shootLocationKey,
  ]);

  useEffect(() => {
    if (!assignPhotographerOpen || !isAdminOrRep || photographers.length === 0) return;
    if (!shootLocation.address || !shootLocation.city || !shootLocation.state) return;
    if (photographers.every((photographer) => photographer.hasAvailability !== undefined)) return;

    let cancelled = false;
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
        const response = await fetch(`${API_BASE_URL}/api/photographer/availability/for-booking`, {
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
            photographer_ids: photographers.map((photographer) => Number(photographer.id)),
          }),
        });

        if (!response.ok) throw new Error('Failed to load availability');
        const json = await response.json();
        if (cancelled) return;
        const availabilityList = Array.isArray(json.data) ? json.data : [];

        setPhotographers((current) => current.map((photographer) => {
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
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching photographer availability:', error);
      } finally {
        if (!cancelled) setIsLoadingAvailability(false);
      }
    };

    fetchAvailability();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    assignPhotographerOpen,
    isAdminOrRep,
    photographerAvailabilityKey,
    setIsLoadingAvailability,
    setPhotographers,
    shootLocationKey,
  ]);
}

export function useShootOverviewEditor({
  shoot,
  isAdmin,
  role,
  isEditMode = false,
  onShootUpdate,
  onSave,
  onCancel,
  onRegisterEditActions,
  toast,
}: UseShootOverviewEditorArgs) {
  const [editedShoot, setEditedShoot] = useState<Partial<ShootData>>({});
  const [taxAmountDirty, setTaxAmountDirty] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>(() => {
    if (!shoot.client) return [];
    return [{
      id: String(shoot.client.id),
      name: shoot.client.name || '',
      email: shoot.client.email || '',
      company: shoot.client.company || '',
    }];
  });
  const [selectedClientId, setSelectedClientId] = useState(() => (shoot.client ? String(shoot.client.id) : ''));
  const [editPhotographers, setEditPhotographers] = useState<PhotographerPickerOption[]>([]);
  const [selectedPhotographerIdEdit, setSelectedPhotographerIdEdit] = useState(() => (shoot.photographer ? String(shoot.photographer.id) : ''));
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [photographerSearchOpen, setPhotographerSearchOpen] = useState(false);
  const [perCategoryPhotographers, setPerCategoryPhotographers] = useState<Record<string, string>>({});
  const [perCategoryPopoverOpen, setPerCategoryPopoverOpen] = useState<Record<string, boolean>>({});
  const [servicesList, setServicesList] = useState<ServiceOption[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [servicePrices, setServicePrices] = useState<Record<string, string>>({});
  const [servicePhotographerPays, setServicePhotographerPays] = useState<Record<string, string>>({});
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [servicePanelCategory, setServicePanelCategory] = useState('all');
  const [serviceModalSearch, setServiceModalSearch] = useState('');
  const [presenceOption, setPresenceOption] = useState<PresenceOption>('self');
  const [lockboxCode, setLockboxCode] = useState('');
  const [lockboxLocation, setLockboxLocation] = useState('');
  const [accessContactName, setAccessContactName] = useState('');
  const [accessContactPhone, setAccessContactPhone] = useState('');
  const [propertyMetricsEdit, setPropertyMetricsEdit] = useState({ beds: '', baths: '', sqft: '' });
  const [addressInput, setAddressInput] = useState('');
  const [assignPhotographerOpen, setAssignPhotographerOpen] = useState(false);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState('');
  const [photographerPickerContext, setPhotographerPickerContext] = useState<PhotographerPickerContext>(null);
  const [photographers, setPhotographers] = useState<PhotographerPickerOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);

  const photographerAssignments = useMemo(() => getShootPhotographerAssignmentGroups(shoot), [shoot]);
  const isAdminOrRep = isAdmin || role === 'rep' || role === 'representative';

  const resolveServicePrice = useCallback((service: ServiceOption, sqft: number | null, overrideValue?: string) => {
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
  }, []);

  const initializeMetricsFromShoot = useCallback(() => {
    const propertyDetails = shoot.propertyDetails || (shoot as any).property_details || {};
    setPropertyMetricsEdit({
      beds: formatEditableValue(propertyDetails.beds ?? propertyDetails.bedrooms ?? propertyDetails.bed ?? (shoot as any).beds ?? (shoot as any).bedrooms ?? ''),
      baths: formatEditableValue(propertyDetails.baths ?? propertyDetails.bathrooms ?? propertyDetails.bath ?? (shoot as any).baths ?? (shoot as any).bathrooms ?? ''),
      sqft: formatEditableValue(
        propertyDetails.sqft ??
        propertyDetails.squareFeet ??
        propertyDetails.square_feet ??
        (shoot as any).sqft ??
        (shoot as any).squareFeet ??
        (shoot as any).square_feet ??
        (shoot as any).livingArea ??
        (shoot as any).living_area ??
        '',
      ),
    });
  }, [shoot]);

  const updateField = useCallback((field: string, value: unknown) => {
    setEditedShoot((current) => setNestedDraftValue(current as Record<string, any>, field, value));
  }, []);

  const clearAddressDerivedState = useCallback(({ keepAddressInput = true }: { keepAddressInput?: boolean } = {}) => {
    if (!keepAddressInput) {
      setAddressInput('');
      updateField('location.address', '');
      updateField('location.fullAddress', '');
    }
    updateField('location.city', '');
    updateField('location.state', '');
    updateField('location.zip', '');
    updateField('location.latitude', undefined);
    updateField('location.longitude', undefined);
    updateField('propertyDetails', {});
    setPropertyMetricsEdit({ beds: '', baths: '', sqft: '' });
  }, [updateField]);

  const handleAddressSelect = useCallback((details: AddressDetailsForLookup) => {
    const mergedAddress = details.address || details.formatted_address || '';
    setAddressInput(mergedAddress);
    updateField('location.address', mergedAddress);
    updateField('location.fullAddress', details.formatted_address || mergedAddress);
    updateField('location.city', details.city || '');
    updateField('location.state', details.state || '');
    updateField('location.zip', details.zip || '');
    updateField('location.latitude', details.latitude);
    updateField('location.longitude', details.longitude);
    updateField('propertyDetails', extractLookupPropertyDetails(details));

    const derivedMetrics = deriveMetricsFromAddress(details);
    setPropertyMetricsEdit({
      beds: formatEditableValue(derivedMetrics.bedrooms),
      baths: formatEditableValue(derivedMetrics.bathrooms),
      sqft: formatEditableValue(derivedMetrics.sqft),
    });
  }, [updateField]);

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
    const parsedSqft = Number(rawSqft);
    return Number.isFinite(parsedSqft) ? parsedSqft : null;
  }, [isEditMode, propertyMetricsEdit.sqft, shoot]);

  useOverviewLookupData(
    isEditMode,
    shoot,
    effectiveSqft,
    resolveServicePrice,
    setClients,
    setServicesList,
    setSelectedServiceIds,
    setServicePrices,
    setServicePhotographerPays,
    setEditPhotographers,
  );

  useEffect(() => {
    if (!isEditMode) return;

    const propertyDetails = shoot.propertyDetails || (shoot as any).property_details || {};
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
      client: shoot.client ? { ...shoot.client } : undefined,
      photographer: shoot.photographer ? { ...shoot.photographer } : undefined,
      payment: shoot.payment ? { ...shoot.payment } : undefined,
    });
    setAddressInput(shoot.location?.address || shoot.location?.fullAddress || (shoot as any).address || '');
    initializeMetricsFromShoot();
    if (shoot.client) setSelectedClientId(String(shoot.client.id));
    if (shoot.photographer) setSelectedPhotographerIdEdit(String(shoot.photographer.id));

    const nextPerCategoryPhotographers: Record<string, string> = {};
    for (const group of photographerAssignments.groups) {
      const photographerId = group.photographer?.id;
      if (photographerId != null && !nextPerCategoryPhotographers[group.key]) {
        nextPerCategoryPhotographers[group.key] = String(photographerId);
      }
    }
    setPerCategoryPhotographers(nextPerCategoryPhotographers);
    setTaxAmountDirty(false);
    setPresenceOption(propertyDetails.presenceOption === 'lockbox' || propertyDetails.presenceOption === 'other' ? propertyDetails.presenceOption : 'self');
    setLockboxCode(propertyDetails.lockboxCode || '');
    setLockboxLocation(propertyDetails.lockboxLocation || '');
    setAccessContactName(propertyDetails.accessContactName || '');
    setAccessContactPhone(propertyDetails.accessContactPhone || '');
  }, [initializeMetricsFromShoot, isEditMode, photographerAssignments.groups, shoot]);

  const handleSave = useCallback(() => {
    if (!onSave) return;

    const updates = { ...editedShoot } as Partial<ShootData> & Record<string, any>;
    const incomingPropertyDetails =
      updates.propertyDetails && typeof updates.propertyDetails === 'object'
        ? { ...(updates.propertyDetails as Record<string, any>) }
        : null;
    const basePropertyDetails = { ...(shoot.propertyDetails || (shoot as any).property_details || {}) } as Record<string, any>;

    if (incomingPropertyDetails) {
      [
        'beds', 'bedrooms', 'baths', 'bathrooms', 'sqft', 'squareFeet',
        'mls_id', 'mlsId', 'price', 'lot_size', 'lotSize', 'year_built',
        'yearBuilt', 'property_type', 'propertyType', 'zpid', 'source',
        'confidence', 'field_sources', 'property_source_chain',
      ].forEach((key) => {
        delete basePropertyDetails[key];
      });
      Object.assign(basePropertyDetails, incomingPropertyDetails);
    }

    const bedsValue = toNumberOrUndefined(propertyMetricsEdit.beds);
    const bathsValue = toNumberOrUndefined(propertyMetricsEdit.baths);
    const sqftValue = toNumberOrUndefined(propertyMetricsEdit.sqft);

    if (bedsValue !== undefined) {
      basePropertyDetails.beds = bedsValue;
      basePropertyDetails.bedrooms = bedsValue;
    } else if (incomingPropertyDetails) {
      delete basePropertyDetails.beds;
      delete basePropertyDetails.bedrooms;
    }
    if (bathsValue !== undefined) {
      basePropertyDetails.baths = bathsValue;
      basePropertyDetails.bathrooms = bathsValue;
    } else if (incomingPropertyDetails) {
      delete basePropertyDetails.baths;
      delete basePropertyDetails.bathrooms;
    }
    if (sqftValue !== undefined) {
      basePropertyDetails.sqft = sqftValue;
      basePropertyDetails.squareFeet = sqftValue;
    } else if (incomingPropertyDetails) {
      delete basePropertyDetails.sqft;
      delete basePropertyDetails.squareFeet;
    }

    updates.propertyDetails = {
      ...basePropertyDetails,
      presenceOption,
      lockboxCode: presenceOption === 'lockbox' ? lockboxCode || undefined : undefined,
      lockboxLocation: presenceOption === 'lockbox' ? lockboxLocation || undefined : undefined,
      accessContactName: presenceOption === 'other' ? accessContactName || undefined : undefined,
      accessContactPhone: presenceOption === 'other' ? accessContactPhone || undefined : undefined,
    };

    if (updates.client?.id !== undefined && updates.client.id !== null) {
      const clientId = typeof updates.client.id === 'string' ? parseInt(updates.client.id, 10) : Number(updates.client.id);
      if (!Number.isNaN(clientId) && clientId > 0) {
        updates.client = { ...updates.client, id: clientId };
      }
    }
    if (updates.photographer?.id !== undefined && updates.photographer.id !== null) {
      const photographerId = typeof updates.photographer.id === 'string' ? parseInt(updates.photographer.id, 10) : Number(updates.photographer.id);
      if (!Number.isNaN(photographerId) && photographerId > 0) {
        updates.photographer = { ...updates.photographer, id: photographerId };
      } else {
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

    if (selectedServiceIds.length > 0) {
      updates.services = selectedServiceIds.map((serviceId) => {
        const service = servicesList.find((serviceOption) => serviceOption.id === serviceId);
        const resolvedPrice = service ? resolveServicePrice(service, sqftForPricing, servicePrices[serviceId]).price : 0;
        const serviceData: any = {
          id: Number(serviceId),
          price: resolvedPrice,
          quantity: 1,
        };
        if (servicePhotographerPays[serviceId]) {
          serviceData.photographer_pay = parseFloat(servicePhotographerPays[serviceId]);
        }
        return serviceData;
      });
    }

    const servicePhotographerAssignments: Array<{ service_id: number; photographer_id: number }> = [];
    if (Object.keys(perCategoryPhotographers).length > 0 && selectedServiceIds.length > 0) {
      for (const serviceId of selectedServiceIds) {
        const service = servicesList.find((serviceOption) => serviceOption.id === serviceId);
        if (!service) continue;
        const categoryName = deriveServiceCategoryName(service);
        const categoryKey = categoryName.trim().toLowerCase().replace(/s$/, '');
        const photographerId = perCategoryPhotographers[categoryKey];
        if (photographerId) {
          servicePhotographerAssignments.push({
            service_id: Number(serviceId),
            photographer_id: Number(photographerId),
          });
        }
      }
    }
    if (servicePhotographerAssignments.length > 0) {
      updates.service_photographers = servicePhotographerAssignments;
    }

    onSave(updates);
  }, [
    accessContactName,
    accessContactPhone,
    editedShoot,
    lockboxCode,
    lockboxLocation,
    onSave,
    perCategoryPhotographers,
    presenceOption,
    propertyMetricsEdit.baths,
    propertyMetricsEdit.beds,
    propertyMetricsEdit.sqft,
    resolveServicePrice,
    selectedServiceIds,
    servicePhotographerPays,
    servicePrices,
    servicesList,
    shoot,
  ]);

  const handleCancel = useCallback(() => {
    setEditedShoot({});
    setClientSearchOpen(false);
    setPhotographerSearchOpen(false);
    setServiceModalSearch('');
    setSearchQuery('');
    if (onCancel) onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (!isEditMode || !onRegisterEditActions) return;
    onRegisterEditActions({
      save: handleSave,
      cancel: handleCancel,
    });
  }, [handleCancel, handleSave, isEditMode, onRegisterEditActions]);

  const serviceCategoryOptions = useMemo<ServiceCategoryOption[]>(() => {
    if (!servicesList.length) return [];
    const categories = new Map<string, ServiceCategoryOption>();
    servicesList.forEach((service) => {
      const id = deriveServiceCategoryId(service);
      const name = deriveServiceCategoryName(service);
      const existing = categories.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        categories.set(id, { id, name, count: 1 });
      }
    });
    return Array.from(categories.values());
  }, [servicesList]);

  const panelServices = useMemo(() => {
    if (!servicesList.length) return [];
    let filteredServices = servicesList;
    if (servicePanelCategory) {
      filteredServices = filteredServices.filter((service) => deriveServiceCategoryId(service) === servicePanelCategory);
    }
    if (serviceModalSearch) {
      const query = serviceModalSearch.toLowerCase();
      filteredServices = filteredServices.filter((service) => service.name.toLowerCase().includes(query));
    }
    return filteredServices;
  }, [serviceModalSearch, servicePanelCategory, servicesList]);

  useEffect(() => {
    if (!serviceCategoryOptions.length) return;
    const hasSelectedCategory = serviceCategoryOptions.some((category) => category.id === servicePanelCategory);
    if (!hasSelectedCategory) {
      setServicePanelCategory(serviceCategoryOptions[0].id);
    }
  }, [serviceCategoryOptions, servicePanelCategory]);

  const toggleServiceSelection = useCallback((serviceId: string) => {
    setSelectedServiceIds((current) => {
      if (current.includes(serviceId)) {
        setServicePrices((prices) => {
          const nextPrices = { ...prices };
          delete nextPrices[serviceId];
          return nextPrices;
        });
        setServicePhotographerPays((pays) => {
          const nextPays = { ...pays };
          delete nextPays[serviceId];
          return nextPays;
        });
        return current.filter((id) => id !== serviceId);
      }
      return [...current, serviceId];
    });
  }, []);

  useEffect(() => {
    const total = selectedServiceIds.reduce((sum, serviceId) => {
      const service = servicesList.find((serviceOption) => serviceOption.id === serviceId);
      if (!service) return sum;
      const resolvedPrice = resolveServicePrice(service, effectiveSqft, servicePrices[serviceId]).price;
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
    editedShoot.payment?.taxAmount,
    editedShoot.payment?.taxRate,
    effectiveSqft,
    resolveServicePrice,
    selectedServiceIds,
    servicePrices,
    servicesList,
    shoot.payment?.taxAmount,
    shoot.payment?.taxRate,
    taxAmountDirty,
    updateField,
  ]);

  const getShootLocation = useCallback(() => {
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
  }, [editedShoot.location, isEditMode, shoot]);

  usePhotographerAssignmentOptions(
    assignPhotographerOpen,
    editPhotographers,
    isAdminOrRep,
    isEditMode,
    setPhotographers,
    setEditPhotographers,
  );

  usePhotographerDistanceAvailability(
    assignPhotographerOpen,
    photographers,
    isAdminOrRep,
    getShootLocation,
    setPhotographers,
    setIsCalculatingDistances,
    setIsLoadingAvailability,
  );

  const fallbackAssignedPhotographers = useMemo(() => {
    const photographersMap = new Map<string, PhotographerPickerOption>();
    const addPhotographer = (photographer?: any | null) => {
      if (!photographer?.id) return;
      const mappedPhotographer = mapPhotographerPickerOption(photographer);
      photographersMap.set(String(mappedPhotographer.id), mappedPhotographer);
    };

    addPhotographer(shoot.photographer);
    photographerAssignments.groups.forEach((group) => addPhotographer(group.photographer));

    return Array.from(photographersMap.values());
  }, [photographerAssignments.groups, shoot.photographer]);

  const photographerPickerOptions = useMemo(() => {
    if (photographers.length > 0) return photographers;
    if (editPhotographers.length > 0) {
      return editPhotographers.map((photographer) => ({ ...photographer }));
    }
    return fallbackAssignedPhotographers;
  }, [editPhotographers, fallbackAssignedPhotographers, photographers]);

  const filteredAndSortedPhotographers = useMemo(() => {
    let filteredPhotographers = [...photographerPickerOptions];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredPhotographers = filteredPhotographers.filter((photographer) =>
        photographer.name.toLowerCase().includes(query)
        || photographer.email?.toLowerCase().includes(query)
        || photographer.city?.toLowerCase().includes(query)
        || photographer.state?.toLowerCase().includes(query),
      );
    }

    filteredPhotographers.sort((first, second) => {
      if (sortBy === 'distance') {
        if (first.distance === undefined && second.distance === undefined) return 0;
        if (first.distance === undefined) return 1;
        if (second.distance === undefined) return -1;
        return first.distance - second.distance;
      }
      return first.name.localeCompare(second.name);
    });

    return filteredPhotographers;
  }, [photographerPickerOptions, searchQuery, sortBy]);

  const resolvePhotographerDetails = useCallback((photographerId?: string | null) => {
    if (!photographerId) return null;
    const normalizedId = String(photographerId);
    return (
      photographerPickerOptions.find((photographer) => String(photographer.id) === normalizedId)
      || editPhotographers.find((photographer) => String(photographer.id) === normalizedId)
      || (shoot.photographer && String(shoot.photographer.id) === normalizedId ? shoot.photographer : null)
    );
  }, [editPhotographers, photographerPickerOptions, shoot.photographer]);

  const closePhotographerPicker = useCallback(() => {
    setAssignPhotographerOpen(false);
    setSearchQuery('');
    setSelectedPhotographerId('');
    setPhotographerPickerContext(null);
  }, []);

  const openEditPhotographerPicker = useCallback((context: Exclude<PhotographerPickerContext, null>) => {
    const initialSelection = context.categoryKey
      ? perCategoryPhotographers[context.categoryKey] || selectedPhotographerIdEdit || ''
      : selectedPhotographerIdEdit || '';
    setPhotographerPickerContext(context);
    setSelectedPhotographerId(initialSelection);
    setSearchQuery('');
    setAssignPhotographerOpen(true);
  }, [perCategoryPhotographers, selectedPhotographerIdEdit]);

  const editModePhotographerRows = useMemo(() => {
    const groupedRows = photographerAssignments.groups.map((group) => {
      const selectedId = perCategoryPhotographers[group.key] || group.photographer?.id || selectedPhotographerIdEdit || '';
        return {
          key: group.key,
          name: group.name,
          photographer: resolvePhotographerDetails(String(selectedId)) || group.photographer || null,
        };
      });

    const fallbackRows = groupedRows.length > 0
      ? groupedRows
        : [{
            key: 'photographer',
            name: 'Photographer',
            photographer: resolvePhotographerDetails(String(selectedPhotographerIdEdit || shoot.photographer?.id || '')) || shoot.photographer || null,
          }];

    if (!isEditMode || selectedServiceIds.length === 0 || servicesList.length === 0) return fallbackRows;

    const rows = new Map<string, { key: string; name: string; photographer: ReturnType<typeof resolvePhotographerDetails> }>();
    selectedServiceIds.forEach((serviceId) => {
      const service = servicesList.find((serviceOption) => serviceOption.id === serviceId);
      if (!service) return;
      const categoryName = deriveServiceCategoryName(service);
      const categoryKey = normalizeShootServiceCategoryKey(categoryName);
      const existingGroup = photographerAssignments.groups.find((group) => group.key === categoryKey);
      const selectedId = perCategoryPhotographers[categoryKey] || existingGroup?.photographer?.id || selectedPhotographerIdEdit || '';
      rows.set(categoryKey, {
        key: categoryKey,
        name: categoryName,
        photographer: resolvePhotographerDetails(String(selectedId)) || existingGroup?.photographer || null,
      });
    });

    return rows.size > 0 ? Array.from(rows.values()) : fallbackRows;
  }, [
    isEditMode,
    perCategoryPhotographers,
    photographerAssignments.groups,
    resolvePhotographerDetails,
    selectedPhotographerIdEdit,
    selectedServiceIds,
    servicesList,
    shoot.photographer,
  ]);

  const handleAssignPhotographer = useCallback(async () => {
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
        setPerCategoryPhotographers((current) => ({ ...current, [categoryKey]: selectedPhotographerId }));
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
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ photographer_id: selectedPhotographerId }),
      });
      if (!response.ok) throw new Error('Failed to assign photographer');

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
  }, [
    closePhotographerPicker,
    editModePhotographerRows.length,
    isEditMode,
    onShootUpdate,
    photographerPickerContext,
    resolvePhotographerDetails,
    selectedPhotographerId,
    shoot.id,
    toast,
    updateField,
  ]);

  const formatLocationLabel = useCallback((location?: { address?: string; city?: string; state?: string; zip?: string }) => {
    if (!location) return '';
    return [location.address, location.city, location.state, location.zip]
      .filter((part) => part && String(part).trim().length > 0)
      .join(', ');
  }, []);

  const timeToMinutes = useCallback((time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    if (!Number.isFinite(hours)) return 0;
    return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
  }, []);

  const buildAvailabilitySegments = useCallback((slots: Array<{ start_time: string; end_time: string }> = []) => {
    const segments: boolean[] = [];
    for (let hour = 8; hour < 20; hour += 1) {
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
  }, [timeToMinutes]);

  const formatAvailabilitySummary = useCallback((slots: Array<{ start_time: string; end_time: string }> = []) =>
    slots
      .slice(0, 3)
      .map((slot) => `${to12Hour(slot.start_time)}-${to12Hour(slot.end_time)}`)
      .join(', '), []);

  return {
    state: {
      editedShoot,
      taxAmountDirty,
      clients,
      selectedClientId,
      clientSearchOpen,
      editPhotographers,
      selectedPhotographerIdEdit,
      photographerSearchOpen,
      perCategoryPhotographers,
      perCategoryPopoverOpen,
      servicesList,
      selectedServiceIds,
      servicePrices,
      servicePhotographerPays,
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
      photographers,
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
      setPhotographerSearchOpen,
      setPerCategoryPhotographers,
      setPerCategoryPopoverOpen,
      setServicePrices,
      setServicePhotographerPays,
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
      handleSave,
      handleCancel,
      clearAddressDerivedState,
      handleAddressSelect,
      resolveServicePrice,
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
    isAdminOrRep,
    effectiveSqft,
    serviceCategoryOptions,
    panelServices,
    filteredAndSortedPhotographers,
    editModePhotographerRows,
  };
}

export type {
  AddressDetailsForLookup,
  ClientOption,
  PhotographerPickerOption,
  ServiceCategoryOption,
  ServiceOption,
};
