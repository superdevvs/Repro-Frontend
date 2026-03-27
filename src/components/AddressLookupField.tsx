import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, CheckCircle, AlertCircle, Loader } from 'lucide-react';
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

interface AddressDetails {
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
  garage_cars?: number;
  garage_sqft?: number;
  property_details?: Record<string, any>;
  zpid?: string;
}

const normalizeNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
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
    property_details: propertyDetails,
    garage_cars: overrides.garage_cars ?? normalizeNumber(propertyDetails?.garage_cars),
    garage_sqft: overrides.garage_sqft ?? normalizeNumber(propertyDetails?.garage_sqft),
    zpid: overrides.zpid ?? (propertyDetails as any)?.zpid ?? suggestion.place_id,
  };
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

  return primarySqft + supplementalSqft;
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

interface AddressLookupFieldProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (address: AddressDetails) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const AddressLookupField: React.FC<AddressLookupFieldProps> = ({
  value,
  onChange,
  onAddressSelect,
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
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync internal inputValue when parent value prop changes (e.g., edit mode initialization)
  useEffect(() => {
    if (value && value !== inputValue && !selectedAddress) {
      setInputValue(value);
    }
  }, [value]);

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
    if (searchQuery.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const base = API_BASE_URL;
      const url = `${base}/api/address/search?query=${encodeURIComponent(searchQuery)}`;
      const response = await fetch(url, { headers: getAuthHeaders() });

      if (!response.ok) {
        throw new Error(`Address search failed with status ${response.status}`);
      }

      const data = await response.json();
      const backendSuggestions: AddressSuggestion[] = data.data || [];
      setSuggestions(backendSuggestions);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Address search error:', err);

      const mockSuggestions = getMockSuggestions(searchQuery);
      setSuggestions(mockSuggestions);
      setShowSuggestions(true);

      if (mockSuggestions.length === 0) {
        setError('Address search temporarily unavailable. Please enter address manually.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setSelectedAddress(null);
    setSqftNotice(null);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Immediate search with minimal debounce (150ms) to prevent excessive API calls
    debounceRef.current = setTimeout(() => {
      searchAddresses(newValue);
    }, 150);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: AddressSuggestion) => {
    console.log('🎯 handleSuggestionSelect called with:', suggestion);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setShowSuggestions(false);
    setIsLoading(true);
    setError(null);

    try {
      const base = API_BASE_URL;
      const url = `${base}/api/address/details?place_id=${encodeURIComponent(suggestion.place_id)}`;
      const response = await fetch(url, { headers: getAuthHeaders() });

      if (!response.ok) {
        throw new Error(`Address details failed with status ${response.status}`);
      }

      const data = await response.json();
      const payload = data.data || data || {};
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
        garage_cars: normalizeNumber(payload?.garage_cars ?? derived?.garage_cars),
        garage_sqft: normalizeNumber(payload?.garage_sqft ?? derived?.garage_sqft),
        property_details: payload?.property_details ?? derived?.property_details,
        zpid: payload?.zpid ?? derived?.zpid,
      });
      
      console.log('📍 Address selected - mergedDetails:', {
        address: mergedDetails.address,
        city: mergedDetails.city,
        state: mergedDetails.state,
        zip: mergedDetails.zip,
        bedrooms: mergedDetails.bedrooms,
        bathrooms: mergedDetails.bathrooms,
        sqft: mergedDetails.sqft,
      });
      
      setSelectedAddress(mergedDetails);
      setSqftNotice(
        mergedDetails.sqft
          ? null
          : 'Square footage could not be fetched for this address. Please fill the sqft manually.'
      );
      onAddressSelect(mergedDetails);
      // Clear search input display after selection (don't touch form field)
      setInputValue('');
      setShowSuggestions(false);
    } catch (err) {
      console.warn('Address details fetch error:', err);
      const fallbackDetails =
        suggestion.place_id.startsWith('mock_')
          ? getMockAddressDetails(suggestion.place_id)
          : buildDetailsFromSuggestion(suggestion);
      setSelectedAddress(fallbackDetails);
      setSqftNotice(
        fallbackDetails.sqft
          ? null
          : 'Square footage could not be fetched for this address. Please fill the sqft manually.'
      );
      onAddressSelect(fallbackDetails);
      // Clear search input display after selection (don't touch form field)
      setInputValue('');
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

// ... (rest of the code remains the same)


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
    };
  }, []);

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
              <div className="flex items-start">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate text-sm">
                    {suggestion.main_text}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {suggestion.secondary_text}
                  </div>
                </div>
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
