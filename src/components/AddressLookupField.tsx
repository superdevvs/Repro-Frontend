import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  API_BASE_URL,
  BRIDGE_DATA_ACCESS_TOKEN,
  BRIDGE_DATA_BASE_URL,
} from '@/config/env';

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

const deriveBridgeMetrics = (parcelResponse: any) => {
  if (!parcelResponse) return null;
  const rawProperty =
    parcelResponse.bundle ?? parcelResponse.data ?? parcelResponse.property ?? parcelResponse;

  if (!rawProperty) return null;

  const address = rawProperty.address ?? {};
  const areas: any[] = rawProperty.areas ?? [];
  const buildingData = rawProperty.building ?? [];
  const building = Array.isArray(buildingData) ? buildingData[0] ?? {} : buildingData ?? {};

  let sqft: number | undefined;
  for (const area of areas) {
    if (area?.type && areaTypePriority.includes(area.type) && area.areaSquareFeet) {
      sqft = Number(area.areaSquareFeet);
      break;
    }
  }

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

// Search Bridge Data by address - returns ListingKey and optionally property data (exactly like PropertyLookup.tsx)
// Tries multiple address formats for better matching
const searchBridgeDataByAddress = async (addressQuery: string, suggestion?: AddressSuggestion): Promise<{ listingKey?: string; propertyData?: any } | null> => {
  // Searching Bridge Data by address
  
  if (!BRIDGE_DATA_ACCESS_TOKEN) {
    console.warn('Bridge Data access token missing. Skipping search.');
    return null;
  }

  // Try multiple address formats for better matching
  const addressVariations: string[] = [];
  if (suggestion) {
    // Try street address only first (most specific match)
    if (suggestion.main_text || suggestion.address) {
      addressVariations.push(suggestion.main_text || suggestion.address || '');
    }
    // Try street + city
    if (suggestion.city) {
      const streetCity = [suggestion.main_text || suggestion.address, suggestion.city].filter(Boolean).join(', ');
      if (streetCity) addressVariations.push(streetCity);
    }
    // Try full address
    if (addressQuery) addressVariations.push(addressQuery);
  } else {
    addressVariations.push(addressQuery);
  }
  
  // Remove duplicates and empty strings
  const uniqueAddresses = [...new Set(addressVariations)].filter(Boolean);

  for (const searchAddress of uniqueAddresses) {
    try {
      // First, try RESO Web API OData with contains filter (exactly like PropertyLookup.tsx line 84-93)
      const filter = `contains(tolower(UnparsedAddress), '${searchAddress.toLowerCase().replace(/'/g, "''")}')`;
      const resoUrl = `${BRIDGE_DATA_BASE_URL}/OData/pub/Property?access_token=${BRIDGE_DATA_ACCESS_TOKEN}&$filter=${encodeURIComponent(filter)}&$top=10&$select=ListingKey,UnparsedAddress,City,StateOrProvince,PostalCode,BedroomsTotal,BathroomsTotalInteger,LivingArea,GarageSpaces,YearBuilt,LotSizeSquareFeet`;
      
      // Making Bridge Data RESO OData search call
      
      const resoResponse = await fetch(resoUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (resoResponse.ok) {
        const data = await resoResponse.json();
        const results = data.value || [];
        // Bridge Data RESO search results received

        if (results.length > 0) {
          // Return ListingKey and property data from first result (like PropertyLookup.tsx line 98-112)
          const firstResult = results[0];
          const listingKey = firstResult.ListingKey || firstResult['@odata.id']?.split('/').pop();
          
          // Extract property data from RESO response
          const propertyData = {
            bedrooms: firstResult.BedroomsTotal || 0,
            bathrooms: firstResult.BathroomsTotalInteger || 0,
            sqft: firstResult.LivingArea || 0,
            garage: firstResult.GarageSpaces || 0,
            yearBuilt: firstResult.YearBuilt || 0,
            lotSize: firstResult.LotSizeSquareFeet || 0,
            address: firstResult.UnparsedAddress || '',
            city: firstResult.City || '',
            state: firstResult.StateOrProvince || '',
            zip: firstResult.PostalCode || '',
          };
          
          return { listingKey, propertyData };
        }
      } else {
        // Continue to next variation if this one failed
        continue;
      }
    } catch (error) {
      console.warn('Bridge Data RESO search error for:', searchAddress, error);
      continue;
    }
  }

  // If RESO failed for all variations, try parcels endpoint fallback (exactly like PropertyLookup.tsx line 119-143)
  // RESO API failed, trying parcels endpoint fallback
  for (const searchAddress of uniqueAddresses) {
    try {
      const parcelsUrl = `${BRIDGE_DATA_BASE_URL}/pub/parcels?access_token=${BRIDGE_DATA_ACCESS_TOKEN}&address.full=${encodeURIComponent(searchAddress)}&limit=10`;
      
      const parcelsResponse = await fetch(parcelsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (parcelsResponse.ok) {
        const parcelsData = await parcelsResponse.json();
        // Parcels API response received
        const parcels = parcelsData.bundle || [];
        
        if (parcels.length > 0) {
          const firstParcel = parcels[0];
          const listingKey = firstParcel.id || firstParcel._id;
          return { listingKey };
        }
      }
    } catch (error) {
      console.warn('Bridge Data parcels search error for:', searchAddress, error);
      continue;
    }
  }

  return null;
};

const fetchBridgeParcelDetails = async (parcelId: string) => {
  // Fetching Bridge Data parcel details
  
  if (!BRIDGE_DATA_ACCESS_TOKEN) {
    console.warn('Bridge Data access token missing. Skipping direct lookup.');
    return null;
  }

  // Use the exact same endpoint as the working PropertyLookup.tsx
  const url = `${BRIDGE_DATA_BASE_URL}/pub/parcels/${parcelId}?access_token=${BRIDGE_DATA_ACCESS_TOKEN}`;
    // Making Bridge Data parcels API call
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        Accept: 'application/json',
      },
    });

    // Bridge Data parcels API response received

    if (!response.ok) {
      console.error('Bridge Data parcels lookup failed', {
        parcelId,
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = await response.json();

    // Prefer the shared parser (uses areas priority + bathroom fractions), matching PropertyLookup.tsx
    const derived = deriveBridgeMetrics(data);
    if (!derived) return null;

    return {
      ...derived,
      zpid: derived.zpid ?? parcelId,
    };
  } catch (error) {
    console.error('Bridge Data parcels lookup error', { parcelId, error });
    return null;
  }
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
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debug: Log Bridge Data token on mount
  useEffect(() => {
    // Bridge Data config initialized
  }, []);

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

  // Search Bridge API directly (like PropertyLookup.tsx)
  const searchBridgeApiDirect = async (searchQuery: string): Promise<AddressSuggestion[]> => {
    if (!BRIDGE_DATA_ACCESS_TOKEN) {
      console.warn('Bridge Data access token missing');
      return [];
    }

    try {
      // Use RESO Web API OData with contains filter (exactly like PropertyLookup.tsx)
      const filter = `contains(tolower(UnparsedAddress), '${searchQuery.toLowerCase().replace(/'/g, "''")}')`;
      const url = `${BRIDGE_DATA_BASE_URL}/OData/pub/Property?access_token=${BRIDGE_DATA_ACCESS_TOKEN}&$filter=${encodeURIComponent(filter)}&$top=10&$select=ListingKey,UnparsedAddress,City,StateOrProvince,PostalCode,BedroomsTotal,BathroomsTotalInteger,LivingArea,GarageSpaces,YearBuilt,LotSizeSquareFeet`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Bridge RESO API Response:', data);
        
        const results: AddressSuggestion[] = (data.value || []).map((property: any) => ({
          place_id: property.ListingKey || property['@odata.id'] || `bridge_${Date.now()}_${Math.random()}`,
          description: property.UnparsedAddress || '',
          main_text: property.UnparsedAddress || '',
          secondary_text: `${property.City || ''}, ${property.StateOrProvince || ''} ${property.PostalCode || ''}`.trim(),
          types: ['street_address'],
          address: property.UnparsedAddress || '',
          city: property.City || '',
          state: property.StateOrProvince || '',
          zip: property.PostalCode || '',
          source: 'bridge_reso',
          raw: {
            bedrooms: property.BedroomsTotal || 0,
            bathrooms: property.BathroomsTotalInteger || 0,
            sqft: property.LivingArea || 0,
            garage: property.GarageSpaces || 0,
            yearBuilt: property.YearBuilt || 0,
            lotSize: property.LotSizeSquareFeet || 0,
          },
        }));

        if (results.length > 0) {
          return results;
        }
      }

      // Fallback: Try parcels endpoint (like PropertyLookup.tsx)
      console.log('RESO failed, trying parcels endpoint');
      const parcelsUrl = `${BRIDGE_DATA_BASE_URL}/pub/parcels?access_token=${BRIDGE_DATA_ACCESS_TOKEN}&address.full=${encodeURIComponent(searchQuery)}&limit=10`;
      
      const parcelsResponse = await fetch(parcelsUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (parcelsResponse.ok) {
        const parcelsData = await parcelsResponse.json();
        console.log('Bridge Parcels API Response:', parcelsData);
        
        const results: AddressSuggestion[] = (parcelsData.bundle || []).map((parcel: any) => ({
          place_id: parcel.id || parcel._id || `parcel_${Date.now()}_${Math.random()}`,
          description: parcel.address?.full || `${parcel.address?.deliveryLine || ''}, ${parcel.address?.city || ''}, ${parcel.address?.state || ''} ${parcel.address?.zip || ''}`,
          main_text: parcel.address?.deliveryLine || parcel.address?.full || '',
          secondary_text: `${parcel.address?.city || ''}, ${parcel.address?.state || ''} ${parcel.address?.zip || ''}`.trim(),
          types: ['street_address'],
          address: parcel.address?.deliveryLine || '',
          city: parcel.address?.city || '',
          state: parcel.address?.state || '',
          zip: parcel.address?.zip || '',
          source: 'bridge_parcels',
          raw: parcel,
        }));

        return results;
      }
    } catch (error) {
      console.error('Bridge API direct search error:', error);
    }

    return [];
  };

  // Debounced search function - matching PropertyLookup.tsx behavior
  const searchAddresses = async (searchQuery: string) => {
    // Minimum 1 character for immediate search
    if (searchQuery.length < 1) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try Bridge API FIRST for faster property data (skip backend which is slow)
      console.log('🔍 Searching Bridge API directly for:', searchQuery);
      const bridgeSuggestions = await searchBridgeApiDirect(searchQuery);
      
      if (bridgeSuggestions.length > 0) {
        console.log('✅ Bridge API returned', bridgeSuggestions.length, 'results');
        setSuggestions(bridgeSuggestions);
        setShowSuggestions(true);
        return;
      }
      
      // Fallback to backend API if Bridge returns nothing
      console.log('Bridge API returned no results, trying backend API');
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const base = API_BASE_URL;
      const url = `${base}/api/address/search?query=${encodeURIComponent(searchQuery)}`;
      const response = await fetch(url, { headers });

      let backendSuggestions: AddressSuggestion[] = [];
      
      if (response.ok) {
        const data = await response.json();
        backendSuggestions = data.data || [];
      }
      
      // If backend returned results, use them
      if (backendSuggestions.length > 0) {
        console.log('✅ Backend API returned', backendSuggestions.length, 'results');
        setSuggestions(backendSuggestions);
        setShowSuggestions(true);
        return;
      }

      // If both failed, show no results
      console.warn('No address suggestions from Bridge or backend API', { query: searchQuery });
      setSuggestions([]);
      setShowSuggestions(false);
    } catch (err) {
      console.error('Address search error:', err);
      
      // Try backend API as fallback
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const base = API_BASE_URL;
        const url = `${base}/api/address/search?query=${encodeURIComponent(searchQuery)}`;
        const response = await fetch(url, { headers });
        if (response.ok) {
          const data = await response.json();
          const backendSuggestions = data.data || [];
          if (backendSuggestions.length > 0) {
            setSuggestions(backendSuggestions);
            setShowSuggestions(true);
            return;
          }
        }
      } catch (backendErr) {
        console.error('Backend API fallback also failed:', backendErr);
      }
      
      setSuggestions([]);
      setError('Address search temporarily unavailable. Please enter address manually.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSelectedAddress(null);

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
      let backendDetails: Partial<AddressDetails> | null = null;

      // Check if suggestion came from Bridge API with pre-populated property data
      if (suggestion.source === 'bridge_reso' && suggestion.raw) {
        console.log('✅ Using pre-populated Bridge RESO data:', suggestion.raw);
        backendDetails = {
          bedrooms: normalizeNumber(suggestion.raw.bedrooms),
          bathrooms: normalizeNumber(suggestion.raw.bathrooms),
          sqft: normalizeNumber(suggestion.raw.sqft),
          garage_cars: normalizeNumber(suggestion.raw.garage),
          property_details: suggestion.raw,
          zpid: suggestion.place_id,
        };
        console.log('✅ Extracted backendDetails:', backendDetails);
      } else if (suggestion.source === 'bridge_parcels' && suggestion.raw) {
        // Parse parcel data using deriveBridgeMetrics
        console.log('Parsing Bridge parcels data:', suggestion.raw);
        const derived = deriveBridgeMetrics({ bundle: suggestion.raw });
        if (derived) {
          backendDetails = {
            bedrooms: derived.bedrooms,
            bathrooms: derived.bathrooms,
            sqft: derived.sqft,
            garage_cars: derived.garage_cars,
            garage_sqft: derived.garage_sqft,
            property_details: suggestion.raw,
            zpid: suggestion.place_id,
          };
        }
      }

      // If we have valid Bridge data, use it immediately (skip all fallbacks for speed)
      const hasValidBridgeData = backendDetails && (
        backendDetails.bedrooms !== undefined ||
        backendDetails.bathrooms !== undefined ||
        backendDetails.sqft !== undefined
      );
      
      if (hasValidBridgeData) {
        // Fast path: We already have Bridge data, use it directly
        console.log('⚡ Fast path: Using Bridge data directly');
        const mergedDetails = buildDetailsFromSuggestion(suggestion, backendDetails);
        console.log('📍 Address selected (fast path):', {
          bedrooms: mergedDetails.bedrooms,
          bathrooms: mergedDetails.bathrooms,
          sqft: mergedDetails.sqft,
        });
        setSelectedAddress(mergedDetails);
        onAddressSelect(mergedDetails);
        onChange(mergedDetails.address || mergedDetails.formatted_address || suggestion.description);
        setIsLoading(false);
        return;
      }
      
      // No Bridge data, try backend API
      if (!backendDetails) {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const base = API_BASE_URL;
        const url = `${base}/api/address/details?place_id=${encodeURIComponent(suggestion.place_id)}`;
        const response = await fetch(url, { headers });

        if (response.ok) {
          const data = await response.json();
          const payload = data.data || data;
          backendDetails = {
            bedrooms: normalizeNumber(payload?.bedrooms),
            bathrooms: normalizeNumber(payload?.bathrooms),
            sqft: normalizeNumber(payload?.sqft),
            garage_cars: normalizeNumber(payload?.garage_cars),
            garage_sqft: normalizeNumber(payload?.garage_sqft),
            property_details: payload?.property_details,
            zpid: payload?.zpid ?? suggestion.place_id,
          };

          // If backend provided raw property details, parse them using Bridge-like logic
          if (payload?.property_details) {
            const derived = deriveBridgeMetrics(payload.property_details);
            if (derived && (derived.bedrooms !== undefined || derived.bathrooms !== undefined || derived.sqft !== undefined)) {
              backendDetails = {
                ...backendDetails,
                bedrooms: derived.bedrooms ?? backendDetails.bedrooms,
                bathrooms: derived.bathrooms ?? backendDetails.bathrooms,
                sqft: derived.sqft ?? backendDetails.sqft,
                garage_cars: derived.garage_cars ?? backendDetails.garage_cars,
                garage_sqft: derived.garage_sqft ?? backendDetails.garage_sqft,
                property_details: backendDetails.property_details,
                zpid: backendDetails.zpid ?? derived.zpid,
              };
            }
          }
        } else {
          console.warn('Primary address details endpoint failed, attempting Bridge Data fallback');
        }
      }

      // Check for undefined, not falsy - 0 is a valid value
      const missingMetrics =
        !backendDetails ||
        (backendDetails.bedrooms === undefined && backendDetails.bathrooms === undefined && backendDetails.sqft === undefined);

      // Checking if metrics are missing and fallback is needed

      // Helper function to search Bridge Data by address and fetch parcel details
      const tryBridgeDataSearchByAddress = async () => {
        // Build address query from suggestion - prefer full description, fallback to building full address
        let addressQuery = suggestion.description || suggestion.main_text || suggestion.address || '';
        
        // If description doesn't include city/state/zip, build full address from components
        if (addressQuery && (!addressQuery.includes(',') || !(suggestion.zip || suggestion.state))) {
          const parts = [
            suggestion.main_text || suggestion.address,
            suggestion.city,
            suggestion.state,
            suggestion.zip,
          ].filter(Boolean);
          const fullAddress = parts.join(', ');
          if (fullAddress) {
            addressQuery = fullAddress;
          }
        }
        
        if (!addressQuery) {
          return;
        }
        const searchResult = await searchBridgeDataByAddress(addressQuery, suggestion);
        
        if (searchResult) {
          // If we got property data directly from RESO search, use it (like PropertyLookup.tsx)
          if (searchResult.propertyData && (searchResult.propertyData.bedrooms !== undefined || searchResult.propertyData.bathrooms !== undefined || searchResult.propertyData.sqft !== undefined)) {
            backendDetails = {
              bedrooms: normalizeNumber(searchResult.propertyData.bedrooms),
              bathrooms: normalizeNumber(searchResult.propertyData.bathrooms),
              sqft: normalizeNumber(searchResult.propertyData.sqft),
              garage_cars: normalizeNumber(searchResult.propertyData.garage),
              property_details: searchResult.propertyData,
            };
            
            // If we have a ListingKey, try to fetch full parcel details to enrich the data
            if (searchResult.listingKey) {
              const bridgeDetails = await fetchBridgeParcelDetails(searchResult.listingKey);
              if (bridgeDetails && (bridgeDetails.bedrooms !== undefined || bridgeDetails.bathrooms !== undefined || bridgeDetails.sqft !== undefined)) {
                // Prefer parcel-derived metrics (usually the most accurate)
                const derivedMetrics = deriveBridgeMetrics(bridgeDetails.property_details);
                backendDetails = {
                  ...backendDetails,
                  bedrooms: derivedMetrics.bedrooms ?? backendDetails.bedrooms,
                  bathrooms: derivedMetrics.bathrooms ?? backendDetails.bathrooms,
                  sqft: derivedMetrics.sqft ?? backendDetails.sqft,
                  garage_cars: derivedMetrics.garage_cars ?? backendDetails.garage_cars,
                  garage_sqft: derivedMetrics.garage_sqft ?? backendDetails.garage_sqft,
                  property_details: derivedMetrics.property_details ?? backendDetails.property_details,
                  zpid: derivedMetrics.zpid ?? backendDetails.zpid,
                };
              }
            }
          } else if (searchResult.listingKey) {
            // If we only got ListingKey, fetch full parcel details (like PropertyLookup.tsx line 163-228)
            const bridgeDetails = await fetchBridgeParcelDetails(searchResult.listingKey);
            if (bridgeDetails && (bridgeDetails.bedrooms !== undefined || bridgeDetails.bathrooms !== undefined || bridgeDetails.sqft !== undefined)) {
              const derivedMetrics = deriveBridgeMetrics(bridgeDetails.property_details);
              backendDetails = {
                bedrooms: derivedMetrics.bedrooms,
                bathrooms: derivedMetrics.bathrooms,
                sqft: derivedMetrics.sqft,
                garage_cars: derivedMetrics.garage_cars,
                garage_sqft: derivedMetrics.garage_sqft,
                property_details: derivedMetrics.property_details,
              };
            }
          }
        }
      };

      if (missingMetrics) {
        // First, try to parse property_details from backend if available
        if (backendDetails?.property_details) {
          const parsedMetrics = deriveBridgeMetrics(backendDetails.property_details);
          if (parsedMetrics && (parsedMetrics.bedrooms !== undefined || parsedMetrics.bathrooms !== undefined || parsedMetrics.sqft !== undefined)) {
            backendDetails = parsedMetrics;
          } else {
            await tryBridgeDataSearchByAddress();
          }
        } else {
          await tryBridgeDataSearchByAddress();
        }
      }

      if (!backendDetails) {
        const fallbackDetails = buildDetailsFromSuggestion(suggestion);
        setSelectedAddress(fallbackDetails);
        onAddressSelect(fallbackDetails);
        onChange(fallbackDetails.address || suggestion.main_text || suggestion.description);
        return;
      }

      const mergedDetails = buildDetailsFromSuggestion(suggestion, backendDetails);
      
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
      onAddressSelect(mergedDetails);
      onChange(mergedDetails.address || mergedDetails.formatted_address || suggestion.description);
    } catch (err) {
      console.warn('Address details fetch error:', err);
      const fallbackDetails: AddressDetails = {
        formatted_address: suggestion.description,
        address: suggestion.main_text,
        city: (suggestion as any).city || '',
        state: (suggestion as any).state || '',
        zip: (suggestion as any).zip || '',
        country: (suggestion as any).country || '',
        latitude: (suggestion as any).latitude,
        longitude: (suggestion as any).longitude,
      };
      setSelectedAddress(fallbackDetails);
      onAddressSelect(fallbackDetails);
      onChange(fallbackDetails.address || suggestion.main_text || suggestion.description);
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
          value={value}
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

      {/* Address validation status */}
      {selectedAddress && (
        <div className="mt-1 text-xs text-green-600 flex items-center">
          <CheckCircle className="w-3 h-3 mr-1" />
          Address verified and auto-filled
        </div>
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
      {showSuggestions && suggestions.length === 0 && value.length >= 1 && !isLoading && (
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
