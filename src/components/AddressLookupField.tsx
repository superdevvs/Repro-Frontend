import React, { useState, useEffect, useRef } from 'react';
import { BedDouble, Bath, CheckCircle, AlertCircle, Loader, MapPin, Ruler } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { API_BASE_URL } from '@/config/env';

interface AddressSuggestion {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  types: string[];
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  raw?: Record<string, any>;
  source?: string;
}

interface SuggestionPreviewState {
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  details?: AddressDetails;
}

type AddressDetailsApiPayload = Partial<AddressDetails> & {
  property_details?: Record<string, any>;
  propertyDetails?: Record<string, any>;
};

type SuggestionMetric = {
  key: string;
  label: string;
  icon: React.ReactElement;
};

export interface AddressDetails {
  formatted_address: string;
  address: string;
  apt_suite?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  mls_id?: string;
  price?: number;
  lot_size?: number;
  year_built?: number;
  property_type?: string;
  garage_cars?: number;
  garage_sqft?: number;
  property_details?: Record<string, any>;
  raw_parcel_data?: Record<string, any>;
  raw_assessment_data?: Record<string, any>;
  raw_legacy_data?: Record<string, any>;
  manual_override?: Record<string, any>;
  override_applied?: boolean;
  override_fields?: string[];
  zpid?: string;
  source?: string;
  confidence?: number;
  field_sources?: Record<string, string>;
  property_source_chain?: string[];
}

const normalizeNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const normalizeString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
};

const parseSecondaryText = (text?: string) => {
  if (!text) {
    return { city: '', state: '', zip: '', country: '' };
  }

  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  const city = parts[0] || '';
  let state = '';
  let zip = '';

  if (parts.length >= 2) {
    const stateZipParts = parts[1].split(/\s+/).filter(Boolean);
    state = stateZipParts[0] || '';
    zip = stateZipParts.slice(1).join(' ') || '';
  }

  const country = parts.length >= 3 ? parts[2] : '';

  return { city, state, zip, country };
};

const buildDetailsFromSuggestion = (
  suggestion: AddressSuggestion,
  overrides: Partial<
    AddressDetails & { property_details?: Record<string, any>; propertyDetails?: Record<string, any> }
  > = {},
): AddressDetails => {
  const parsedSecondary = parseSecondaryText(overrides.formatted_address ? undefined : suggestion.secondary_text);
  const propertyDetails = overrides.property_details || overrides.propertyDetails || undefined;

  const bedrooms =
    overrides.bedrooms ??
    propertyDetails?.beds ??
    propertyDetails?.bedrooms ??
    propertyDetails?.bed;
  const bathrooms =
    overrides.bathrooms ??
    propertyDetails?.baths ??
    propertyDetails?.bathrooms ??
    propertyDetails?.bath;
  const sqft =
    overrides.sqft ??
    propertyDetails?.sqft ??
    propertyDetails?.livingArea ??
    propertyDetails?.living_area ??
    propertyDetails?.squareFeet ??
    propertyDetails?.square_feet;
  const price =
    overrides.price ??
    propertyDetails?.price ??
    propertyDetails?.listPrice ??
    propertyDetails?.listingPrice;
  const lotSize =
    overrides.lot_size ??
    propertyDetails?.lot_size ??
    propertyDetails?.lotSize ??
    propertyDetails?.lotSizeSqft;
  const yearBuilt =
    overrides.year_built ??
    propertyDetails?.year_built ??
    propertyDetails?.yearBuilt;
  const propertyType =
    overrides.property_type ??
    propertyDetails?.property_type ??
    propertyDetails?.propertyType;
  const mlsId =
    overrides.mls_id ??
    propertyDetails?.mls_id ??
    propertyDetails?.mlsId ??
    propertyDetails?.mlsNumber;

  return {
    formatted_address: overrides.formatted_address ?? suggestion.description,
    address: overrides.address ?? suggestion.address ?? suggestion.main_text ?? suggestion.description,
    city: overrides.city ?? suggestion.city ?? parsedSecondary.city,
    state: overrides.state ?? suggestion.state ?? parsedSecondary.state,
    zip: overrides.zip ?? suggestion.zip ?? parsedSecondary.zip,
    country: (overrides.country ?? suggestion.country ?? parsedSecondary.country) || 'US',
    latitude: overrides.latitude ?? suggestion.latitude,
    longitude: overrides.longitude ?? suggestion.longitude,
    bedrooms: normalizeNumber(bedrooms),
    bathrooms: normalizeNumber(bathrooms),
    sqft: normalizeNumber(sqft),
    mls_id: mlsId ? String(mlsId) : undefined,
    price: normalizeNumber(price),
    lot_size: normalizeNumber(lotSize),
    year_built: normalizeNumber(yearBuilt),
    property_type: propertyType ? String(propertyType) : undefined,
    property_details: propertyDetails,
    raw_parcel_data: overrides.raw_parcel_data,
    raw_assessment_data: overrides.raw_assessment_data,
    raw_legacy_data: overrides.raw_legacy_data,
    manual_override: overrides.manual_override,
    override_applied: overrides.override_applied,
    override_fields: overrides.override_fields,
    garage_cars: overrides.garage_cars ?? normalizeNumber(propertyDetails?.garage_cars),
    garage_sqft: overrides.garage_sqft ?? normalizeNumber(propertyDetails?.garage_sqft),
    zpid: overrides.zpid ?? (propertyDetails as any)?.zpid ?? suggestion.place_id,
    source: overrides.source,
    confidence: normalizeNumber(overrides.confidence),
    field_sources: overrides.field_sources,
    property_source_chain: overrides.property_source_chain,
  };
};

export const buildNormalizedPropertyDetails: (
  details: Partial<AddressDetails> & { property_details?: Record<string, any> },
) => Record<string, any> = (
  details: Partial<AddressDetails> & { property_details?: Record<string, any> },
): Record<string, any> => {
  const normalized =
    details.property_details && typeof details.property_details === 'object'
      ? { ...details.property_details }
      : {};

  const bedrooms = normalizeNumber(details.bedrooms ?? normalized.bedrooms ?? normalized.beds ?? normalized.bed);
  const bathrooms = normalizeNumber(details.bathrooms ?? normalized.bathrooms ?? normalized.baths ?? normalized.bath);
  const sqft = normalizeNumber(
    details.sqft ??
      normalized.sqft ??
      normalized.squareFeet ??
      normalized.square_feet ??
      normalized.livingArea ??
      normalized.living_area,
  );
  const garageCars = normalizeNumber(details.garage_cars ?? normalized.garage_cars ?? normalized.garageCars);
  const garageSqft = normalizeNumber(details.garage_sqft ?? normalized.garage_sqft ?? normalized.garageSqft);
  const mlsId = normalizeString(
    details.mls_id ?? normalized.mls_id ?? normalized.mlsId ?? normalized.mls_number ?? normalized.mlsNumber,
  );
  const price = normalizeNumber(details.price ?? normalized.price ?? normalized.listPrice ?? normalized.listingPrice);
  const lotSize = normalizeNumber(
    details.lot_size ?? normalized.lot_size ?? normalized.lotSize ?? normalized.lotSizeSqft,
  );
  const yearBuilt = normalizeNumber(details.year_built ?? normalized.year_built ?? normalized.yearBuilt);
  const propertyType = normalizeString(
    details.property_type ?? normalized.property_type ?? normalized.propertyType,
  );
  const zpid = normalizeString(details.zpid ?? normalized.zpid);

  if (bedrooms !== undefined) {
    normalized.beds = bedrooms;
    normalized.bedrooms = bedrooms;
  }
  if (bathrooms !== undefined) {
    normalized.baths = bathrooms;
    normalized.bathrooms = bathrooms;
  }
  if (sqft !== undefined) {
    normalized.sqft = sqft;
    normalized.squareFeet = sqft;
  }
  if (garageCars !== undefined) {
    normalized.garage_cars = garageCars;
  }
  if (garageSqft !== undefined) {
    normalized.garage_sqft = garageSqft;
  }
  if (mlsId !== undefined) {
    normalized.mls_id = mlsId;
    normalized.mlsId = mlsId;
  }
  if (price !== undefined) {
    normalized.price = price;
  }
  if (lotSize !== undefined) {
    normalized.lot_size = lotSize;
    normalized.lotSize = lotSize;
  }
  if (yearBuilt !== undefined) {
    normalized.year_built = yearBuilt;
    normalized.yearBuilt = yearBuilt;
  }
  if (propertyType !== undefined) {
    normalized.property_type = propertyType;
    normalized.propertyType = propertyType;
  }
  if (zpid !== undefined) {
    normalized.zpid = zpid;
  }
  if (details.source) {
    normalized.source = details.source;
  }
  if (details.confidence !== undefined) {
    normalized.confidence = details.confidence;
  }
  if (details.field_sources) {
    normalized.field_sources = details.field_sources;
  }
  if (details.property_source_chain) {
    normalized.property_source_chain = details.property_source_chain;
  }

  return normalized;
};

const areaTypePriority = [
  'Living Building Area',
  'Finished Building Area',
  'Zillow Calculated Finished Area',
  'Base Building Area',
  'Gross Building Area',
];

const supplementalFinishedAreaTypes = [
  'Basement Finished',
  'Game Room/Recreation',
  'Lower Level Finished',
  'Finished Basement',
  'Basement Partially Finished',
  'Finished Rec Room',
];

const getAreaSquareFeet = (area: any): number | undefined => {
  const value = normalizeNumber(area?.areaSquareFeet);
  return value && value > 0 ? value : undefined;
};

const getPreferredFinishedSqft = (areas: any[]): number | undefined => {
  let primarySqft: number | undefined;
  let primaryType: string | undefined;

  for (const type of areaTypePriority) {
    const candidates = areas
      .filter((area) => area?.type === type)
      .map(getAreaSquareFeet)
      .filter((value): value is number => value !== undefined);

    if (candidates.length > 0) {
      primarySqft = Math.max(...candidates);
      primaryType = type;
      break;
    }
  }

  if (!primarySqft) {
    return undefined;
  }

  if (primaryType !== 'Living Building Area') {
    return primarySqft;
  }

  const supplementalSqft = areas
    .filter((area) => supplementalFinishedAreaTypes.includes(area?.type))
    .map(getAreaSquareFeet)
    .filter((value): value is number => value !== undefined)
    .reduce((sum, value) => sum + value, 0);

  if (supplementalSqft > 0) {
    return primarySqft + supplementalSqft;
  }

  const hasFinishedAreaMarker = areas.some((area) => {
    const type = String(area?.type ?? '');
    return type.endsWith(' Finished') || type.startsWith('Finished ');
  });

  if (!hasFinishedAreaMarker) {
    return primarySqft;
  }

  const basementFallback = areas
    .filter((area) => area?.type === 'Basement')
    .map(getAreaSquareFeet)
    .filter((value): value is number => value !== undefined);

  if (!basementFallback.length) {
    return primarySqft;
  }

  return primarySqft + Math.max(...basementFallback);
};

const deriveBridgeMetrics = (parcelResponse: any) => {
  if (!parcelResponse) return null;
  const rawProperty =
    parcelResponse.bundle ?? parcelResponse.data ?? parcelResponse.property ?? parcelResponse;

  if (!rawProperty) return null;

  const address = rawProperty.address ?? {};
  const areas: any[] = rawProperty.areas ?? [];
  const buildingData = rawProperty.building ?? [];
  const building = Array.isArray(buildingData) ? buildingData[0] ?? {} : buildingData ?? {};

  const sqft = getPreferredFinishedSqft(areas);

  const bedrooms = normalizeNumber(building.bedrooms ?? building.totalRooms);
  const fullBaths = Number(building.fullBaths ?? 0);
  const halfBaths = Number(building.halfBaths ?? 0) * 0.5;
  const threeQuarterBaths = Number(building.threeQuarterBaths ?? 0) * 0.75;
  const quarterBaths = Number(building.quarterBaths ?? 0) * 0.25;
  let bathrooms = fullBaths + halfBaths + threeQuarterBaths + quarterBaths;
  if (!bathrooms) {
    bathrooms = normalizeNumber(building.baths) ?? 0;
  }
  if (!bathrooms) {
    bathrooms = undefined;
  }

  const garages: any[] = rawProperty.garages ?? [];
  let garageCars: number | undefined;
  let garageSqft: number | undefined;
  if (garages.length) {
    let carTotal = 0;
    let sqftTotal = 0;
    let hasCars = false;
    let hasSqft = false;
    garages.forEach((garage) => {
      if (garage?.carCount) {
        carTotal += Number(garage.carCount);
        hasCars = true;
      }
      if (garage?.areaSquareFeet) {
        sqftTotal += Number(garage.areaSquareFeet);
        hasSqft = true;
      }
    });
    if (!hasCars && garages.length) {
      carTotal = garages.length;
      hasCars = true;
    }
    if (hasCars && carTotal > 0) {
      garageCars = carTotal;
    }
    if (hasSqft && sqftTotal > 0) {
      garageSqft = sqftTotal;
    }
  }

  return {
    formatted_address:
      address.full ?? address.formattedStreetAddress ?? address.deliveryLine ?? undefined,
    address:
      address.deliveryLine ??
      `${address.streetNumber ?? ''} ${address.streetName ?? ''}`.trim() ??
      undefined,
    city: address.city,
    state: address.state ?? address.stateCode,
    zip: address.zip ?? address.zipcode ?? address.postalCode,
    country: address.country ?? address.countryCode,
    latitude: address.latitude ?? rawProperty.latitude,
    longitude: address.longitude ?? rawProperty.longitude,
    bedrooms,
    bathrooms,
    sqft,
    garage_cars: garageCars,
    garage_sqft: garageSqft,
    property_details: rawProperty,
    zpid: rawProperty.id ?? rawProperty.zpid,
  };
};

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const formatMetricValue = (value?: number): string | null => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1).replace(/\.0$/, '');
};

const previewSuggestionLimit = 4;

interface AddressLookupFieldProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (address: AddressDetails) => void;
  onSelectionStarted?: () => void;
  onSelectionReset?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const AddressLookupField: React.FC<AddressLookupFieldProps> = ({
  value,
  onChange,
  onAddressSelect,
  onSelectionStarted,
  onSelectionReset,
  placeholder = 'Start typing an address...',
  className = '',
  disabled = false
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sqftNotice, setSqftNotice] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(value || '');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const detailsAbortRef = useRef<AbortController | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const latestSearchRequestRef = useRef(0);
  const searchCacheRef = useRef<Map<string, AddressSuggestion[]>>(new Map());
  const detailsCacheRef = useRef<Map<string, AddressDetails>>(new Map());
  const [suggestionPreviews, setSuggestionPreviews] = useState<Record<string, SuggestionPreviewState>>({});

  // Sync internal inputValue when parent value prop changes (e.g., edit mode initialization)
  useEffect(() => {
    if ((value || '') !== inputValue) {
      setInputValue(value || '');
    }
  }, [inputValue, value]);

  // Mock data for testing when API is not available
  const getMockSuggestions = (query: string): AddressSuggestion[] => {
    const mockAddresses = [
      {
        place_id: 'mock_1',
        description: '123 Main Street, Washington, DC, USA',
        main_text: '123 Main Street',
        secondary_text: 'Washington, DC, USA',
        types: ['street_address']
      },
      {
        place_id: 'mock_2', 
        description: '456 Oak Avenue, New York, NY, USA',
        main_text: '456 Oak Avenue',
        secondary_text: 'New York, NY, USA',
        types: ['street_address']
      },
      {
        place_id: 'mock_3',
        description: '789 Pine Road, Los Angeles, CA, USA',
        main_text: '789 Pine Road', 
        secondary_text: 'Los Angeles, CA, USA',
        types: ['street_address']
      },
      {
        place_id: 'mock_4',
        description: '321 Elm Street, Chicago, IL, USA',
        main_text: '321 Elm Street',
        secondary_text: 'Chicago, IL, USA',
        types: ['street_address']
      },
      {
        place_id: 'mock_5',
        description: '654 Maple Drive, Miami, FL, USA',
        main_text: '654 Maple Drive',
        secondary_text: 'Miami, FL, USA',
        types: ['street_address']
      }
    ];

    return mockAddresses.filter(addr => 
      addr.description.toLowerCase().includes(query.toLowerCase())
    );
  };

  // Mock address details for testing
  const getMockAddressDetails = (placeId: string): AddressDetails => {
    const mockDetails: Record<string, AddressDetails> = {
      'mock_1': {
        formatted_address: '123 Main Street, Washington, DC 20001, USA',
        address: '123 Main Street',
        city: 'Washington',
        state: 'DC',
        zip: '20001',
        country: 'US',
        latitude: 38.9072,
        longitude: -77.0369
      },
      'mock_2': {
        formatted_address: '456 Oak Avenue, New York, NY 10001, USA',
        address: '456 Oak Avenue',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.0060
      },
      'mock_3': {
        formatted_address: '789 Pine Road, Los Angeles, CA 90210, USA',
        address: '789 Pine Road',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90210',
        country: 'US',
        latitude: 34.0522,
        longitude: -118.2437
      },
      'mock_4': {
        formatted_address: '321 Elm Street, Chicago, IL 60601, USA',
        address: '321 Elm Street',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        country: 'US',
        latitude: 41.8781,
        longitude: -87.6298
      },
      'mock_5': {
        formatted_address: '654 Maple Drive, Miami, FL 33101, USA',
        address: '654 Maple Drive',
        city: 'Miami',
        state: 'FL',
        zip: '33101',
        country: 'US',
        latitude: 25.7617,
        longitude: -80.1918
      }
    };

    return mockDetails[placeId] || mockDetails['mock_1'];
  };

  // Debounced search function
  const searchAddresses = async (searchQuery: string) => {
    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery.length < 3) {
      previewAbortRef.current?.abort();
      setSuggestions([]);
      setSuggestionPreviews({});
      setShowSuggestions(false);
      setIsLoading(false);
      return;
    }

    const cachedSuggestions = searchCacheRef.current.get(normalizedQuery);
    if (cachedSuggestions) {
      setSuggestions(cachedSuggestions);
      setShowSuggestions(cachedSuggestions.length > 0);
      setIsLoading(false);
      setError(null);
      return;
    }

    latestSearchRequestRef.current += 1;
    const requestId = latestSearchRequestRef.current;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const base = API_BASE_URL;
      const url = `${base}/api/address/search?query=${encodeURIComponent(normalizedQuery)}`;
      const response = await fetch(url, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Address search failed with status ${response.status}`);
      }

      if (requestId !== latestSearchRequestRef.current) {
        return;
      }

      const data = await response.json();
      const backendSuggestions: AddressSuggestion[] = data.data || [];
      searchCacheRef.current.set(normalizedQuery, backendSuggestions);
      setSuggestions(backendSuggestions);
      setShowSuggestions(backendSuggestions.length > 0);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return;
      }

      console.error('Address search error:', err);

      const mockSuggestions = getMockSuggestions(normalizedQuery);
      setSuggestions(mockSuggestions);
      setShowSuggestions(mockSuggestions.length > 0);

      if (mockSuggestions.length === 0) {
        setError('Address search temporarily unavailable. Please enter address manually.');
      }
    } finally {
      if (requestId === latestSearchRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    if (selectedAddress) {
      onSelectionReset?.();
    }
    setSelectedAddress(null);
    setSqftNotice(null);
    detailsAbortRef.current?.abort();
    previewAbortRef.current?.abort();
    setSuggestionPreviews({});

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Keep Google autocomplete responsive while avoiding overlapping requests.
    debounceRef.current = setTimeout(() => {
      searchAddresses(newValue);
    }, 120);
  };

  const fetchSuggestionDetails = async (
    suggestion: AddressSuggestion,
    signal?: AbortSignal,
  ): Promise<AddressDetails> => {
    const cachedDetails = detailsCacheRef.current.get(suggestion.place_id);
    if (cachedDetails) {
      return cachedDetails;
    }

    const base = API_BASE_URL;
    const url = `${base}/api/address/details?place_id=${encodeURIComponent(suggestion.place_id)}`;
    const response = await fetch(url, {
      headers: getAuthHeaders(),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Address details failed with status ${response.status}`);
    }

    const data = await response.json();
    const payload: AddressDetailsApiPayload = data.data || data || {};
    const derived = payload?.property_details ? deriveBridgeMetrics(payload.property_details) : null;

    const mergedDetails = buildDetailsFromSuggestion(suggestion, {
      formatted_address: payload?.formatted_address ?? derived?.formatted_address,
      address: payload?.address ?? derived?.address,
      apt_suite: payload?.apt_suite,
      city: payload?.city ?? derived?.city,
      state: payload?.state ?? derived?.state,
      zip: payload?.zip ?? derived?.zip,
      country: payload?.country ?? derived?.country,
      latitude: payload?.latitude ?? derived?.latitude,
      longitude: payload?.longitude ?? derived?.longitude,
      bedrooms: normalizeNumber(payload?.bedrooms ?? derived?.bedrooms),
      bathrooms: normalizeNumber(payload?.bathrooms ?? derived?.bathrooms),
      sqft: normalizeNumber(payload?.sqft ?? derived?.sqft),
      mls_id: payload?.mls_id,
      price: normalizeNumber(payload?.price),
      lot_size: normalizeNumber(payload?.lot_size),
      year_built: normalizeNumber(payload?.year_built),
      property_type: payload?.property_type,
      garage_cars: normalizeNumber(payload?.garage_cars ?? derived?.garage_cars),
      garage_sqft: normalizeNumber(payload?.garage_sqft ?? derived?.garage_sqft),
      property_details: buildNormalizedPropertyDetails({
        ...payload,
        property_details: payload?.property_details ?? derived?.property_details,
      }),
      raw_parcel_data: payload?.raw_parcel_data,
      raw_assessment_data: payload?.raw_assessment_data,
      raw_legacy_data: payload?.raw_legacy_data,
      manual_override: payload?.manual_override,
      override_applied: payload?.override_applied,
      override_fields: payload?.override_fields,
      zpid: payload?.zpid ?? derived?.zpid,
      source: payload?.source,
      confidence: normalizeNumber(payload?.confidence),
      field_sources: payload?.field_sources,
      property_source_chain: payload?.property_source_chain,
    });

    detailsCacheRef.current.set(suggestion.place_id, mergedDetails);
    return mergedDetails;
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: AddressSuggestion) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    detailsAbortRef.current?.abort();
    previewAbortRef.current?.abort();

    onSelectionStarted?.();
    setShowSuggestions(false);
    setIsLoading(true);
    setError(null);
    setSelectedAddress(null);
    setSqftNotice(null);

    const cachedDetails = detailsCacheRef.current.get(suggestion.place_id);
    if (cachedDetails) {
      setSelectedAddress(cachedDetails);
      setSqftNotice(
        cachedDetails.sqft
          ? null
          : 'Square footage could not be fetched for this address. Please fill the sqft manually.'
      );
      setInputValue(cachedDetails.address || cachedDetails.formatted_address || '');
      onChange(cachedDetails.address || cachedDetails.formatted_address || '');
      onAddressSelect(cachedDetails);
      setIsLoading(false);
      return;
    }

    try {
      const controller = new AbortController();
      detailsAbortRef.current = controller;
      const mergedDetails = await fetchSuggestionDetails(suggestion, controller.signal);

      setSelectedAddress(mergedDetails);
      setSqftNotice(
        mergedDetails.sqft
          ? null
          : 'Square footage could not be fetched for this address. Please fill the sqft manually.'
      );
      setInputValue(mergedDetails.address || mergedDetails.formatted_address || '');
      onChange(mergedDetails.address || mergedDetails.formatted_address || '');
      onAddressSelect(mergedDetails);
      setShowSuggestions(false);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return;
      }

      console.warn('Address details fetch error:', err);
      const fallbackDetails =
        suggestion.place_id.startsWith('mock_')
          ? getMockAddressDetails(suggestion.place_id)
          : buildDetailsFromSuggestion(suggestion, {
              property_details: buildNormalizedPropertyDetails(buildDetailsFromSuggestion(suggestion)),
            });
      detailsCacheRef.current.set(suggestion.place_id, fallbackDetails);
      setSelectedAddress(fallbackDetails);
      setSqftNotice(
        fallbackDetails.sqft
          ? null
          : 'Square footage could not be fetched for this address. Please fill the sqft manually.'
      );
      setInputValue(fallbackDetails.address || fallbackDetails.formatted_address || '');
      onChange(fallbackDetails.address || fallbackDetails.formatted_address || '');
      onAddressSelect(fallbackDetails);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      searchAbortRef.current?.abort();
      detailsAbortRef.current?.abort();
      previewAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    previewAbortRef.current?.abort();

    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    const visibleSuggestions = suggestions.slice(0, previewSuggestionLimit);
    const visibleSuggestionIds = new Set(visibleSuggestions.map((suggestion) => suggestion.place_id));

    setSuggestionPreviews((current) => {
      const next: Record<string, SuggestionPreviewState> = {};

      visibleSuggestions.forEach((suggestion) => {
        const cachedDetails = detailsCacheRef.current.get(suggestion.place_id);
        if (cachedDetails) {
          next[suggestion.place_id] = {
            status: 'ready',
            details: cachedDetails,
          };
          return;
        }

        const existingPreview = current[suggestion.place_id];
        next[suggestion.place_id] = visibleSuggestionIds.has(suggestion.place_id)
          ? existingPreview ?? { status: 'idle' }
          : { status: 'idle' };
      });

      return next;
    });

    const queue = visibleSuggestions.filter((suggestion) => !detailsCacheRef.current.has(suggestion.place_id));
    if (queue.length === 0) {
      return;
    }

    const controller = new AbortController();
    previewAbortRef.current = controller;
    const startTimer = window.setTimeout(async () => {
      for (const suggestion of queue) {
        if (controller.signal.aborted) {
          return;
        }

        setSuggestionPreviews((current) => ({
          ...current,
          [suggestion.place_id]: {
            status: 'loading',
            details: current[suggestion.place_id]?.details,
          },
        }));

        try {
          const details = await fetchSuggestionDetails(suggestion, controller.signal);
          if (controller.signal.aborted) {
            return;
          }

          setSuggestionPreviews((current) => ({
            ...current,
            [suggestion.place_id]: {
              status: 'ready',
              details,
            },
          }));
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') {
            return;
          }

          setSuggestionPreviews((current) => ({
            ...current,
            [suggestion.place_id]: {
              status: 'unavailable',
            },
          }));
        }
      }
    }, 150);

    return () => {
      window.clearTimeout(startTimer);
      controller.abort();
    };
  }, [suggestions, showSuggestions]);

  const renderSuggestionMetrics = (suggestion: AddressSuggestion) => {
    const preview = suggestionPreviews[suggestion.place_id];

    if (!preview || preview.status === 'idle' || preview.status === 'unavailable') {
      return null;
    }

    if (preview.status === 'loading') {
      return (
        <div className="flex items-center justify-end gap-1.5">
          {[0, 1, 2].map((placeholder) => (
            <span
              key={placeholder}
              className="h-6 w-14 animate-pulse rounded-full bg-muted/70"
            />
          ))}
        </div>
      );
    }

    const bedroomValue = formatMetricValue(preview.details?.bedrooms);
    const bathroomValue = formatMetricValue(preview.details?.bathrooms);
    const sqftValue = formatMetricValue(preview.details?.sqft);
    const metrics: SuggestionMetric[] = [
      bedroomValue
        ? {
            key: 'bedrooms',
            label: `${bedroomValue} bd`,
            icon: <BedDouble className="h-3.5 w-3.5" />,
          }
        : null,
      bathroomValue
        ? {
            key: 'bathrooms',
            label: `${bathroomValue} ba`,
            icon: <Bath className="h-3.5 w-3.5" />,
          }
        : null,
      sqftValue
        ? {
            key: 'sqft',
            label: `${sqftValue} sqft`,
            icon: <Ruler className="h-3.5 w-3.5" />,
          }
        : null,
    ].filter((metric): metric is SuggestionMetric => Boolean(metric));

    if (metrics.length === 0) {
      return (
        <span className="text-[11px] text-muted-foreground">
          No property data yet
        </span>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {metrics.map((metric) => (
          <span
            key={metric.key}
            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-1 text-[11px] font-medium text-foreground"
          >
            {metric.icon}
            {metric.label}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-10 ${selectedAddress ? 'border-green-500' : ''} ${error ? 'border-red-500' : ''}`}
        />
        
        {/* Status icons */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {isLoading && <Loader className="w-4 h-4 text-blue-500 animate-spin" />}
          {selectedAddress && !isLoading && (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
          {error && !isLoading && (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center">
          <AlertCircle className="w-3 h-3 mr-1" />
          {error}
        </p>
      )}

      {sqftNotice && !error && (
        <p className="mt-1 flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
          <AlertCircle className="mr-1 h-3 w-3 shrink-0" />
          {sqftNotice}
        </p>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSuggestionSelect(suggestion)}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate text-sm">
                    {suggestion.main_text}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {suggestion.secondary_text}
                  </div>
                </div>
                <div className="hidden min-w-[190px] shrink-0 self-center sm:block">
                  {renderSuggestionMetrics(suggestion)}
                </div>
              </div>
              <div className="mt-2 sm:hidden">
                {renderSuggestionMetrics(suggestion)}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && suggestions.length === 0 && inputValue.length >= 1 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
          <div className="text-center text-gray-500">
            <MapPin className="w-6 h-6 mx-auto mb-1 text-gray-300" />
            <p className="text-xs">No addresses found</p>
            <p className="text-xs text-gray-400 mt-1">
              Try entering a more specific address
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressLookupField;
