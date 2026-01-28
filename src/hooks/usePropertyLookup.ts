import { useState, useRef, useCallback } from 'react';
import { BRIDGE_DATA_ACCESS_TOKEN, BRIDGE_DATA_BASE_URL } from '@/config/env';

// Types matching PropertyLookup.tsx exactly
export interface PropertyData {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  garage: string;
  garageCars?: number;
  garageSqft?: number;
  yearBuilt: number;
  lotSize: string;
}

export interface AddressSuggestion {
  id: string;
  fullAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  // Property data from RESO search (pre-populated)
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  garage?: number;
  yearBuilt?: number;
  lotSize?: number;
}

export interface PropertyLookupResult {
  suggestions: AddressSuggestion[];
  isSearching: boolean;
  isLoadingProperty: boolean;
  isVerified: boolean;
  propertyData: PropertyData;
  error: string | null;
  searchAddresses: (query: string) => void;
  selectAddress: (suggestion: AddressSuggestion) => Promise<void>;
  reset: () => void;
}

const DEFAULT_PROPERTY_DATA: PropertyData = {
  address: '',
  city: '',
  state: '',
  zipCode: '',
  bedrooms: 0,
  bathrooms: 0,
  sqft: 0,
  garage: 'N/A',
  garageCars: undefined,
  garageSqft: undefined,
  yearBuilt: 0,
  lotSize: 'N/A',
};

// Priority order for living area types (from PropertyLookup.tsx deriveBridgeMetrics logic)
const AREA_TYPE_PRIORITY = [
  'Living Building Area',
  'Finished Building Area',
  'Zillow Calculated Finished Area',
  'Base Building Area',
  'Gross Building Area',
];

/**
 * Parse Bridge API parcel response to extract property metrics
 * Matches the logic in PropertyLookup.tsx exactly
 */
const parseParcelResponse = (data: any): Partial<PropertyData> | null => {
  const parcel = data.bundle || data;
  if (!parcel) return null;

  // Extract building data - building is an ARRAY
  const building = Array.isArray(parcel.building) ? parcel.building[0] : parcel.building || {};
  const address = parcel.address || {};

  // Get living area from areas array with priority
  let sqft = 0;
  const areas: any[] = parcel.areas || [];
  for (const areaType of AREA_TYPE_PRIORITY) {
    const area = areas.find((a: any) => a.type === areaType);
    if (area?.areaSquareFeet) {
      sqft = Number(area.areaSquareFeet);
      break;
    }
  }
  // Fallback to building size
  if (!sqft && building?.size) {
    sqft = Number(building.size);
  }

  // Get garage info from garages array
  const garages: any[] = parcel.garages || [];
  let garageInfo = 'N/A';
  let garageCars: number | undefined;
  let garageSqft: number | undefined;
  
  if (garages.length > 0) {
    const garage = garages[0];
    garageInfo = garage.type || 'Garage';
    if (garage.carCount) {
      garageCars = Number(garage.carCount);
      garageInfo += ` (${garage.carCount} cars)`;
    } else if (garage.areaSquareFeet) {
      garageSqft = Number(garage.areaSquareFeet);
      garageInfo += ` (${garage.areaSquareFeet} sqft)`;
    }
    
    // Sum up all garages
    if (garages.length > 1) {
      let totalCars = 0;
      let totalSqft = 0;
      garages.forEach((g) => {
        if (g.carCount) totalCars += Number(g.carCount);
        if (g.areaSquareFeet) totalSqft += Number(g.areaSquareFeet);
      });
      if (totalCars > 0) garageCars = totalCars;
      if (totalSqft > 0) garageSqft = totalSqft;
    }
  }

  // Calculate total bathrooms (full + half + 3/4 + 1/4)
  const fullBaths = Number(building?.fullBaths || 0);
  const halfBaths = Number(building?.halfBaths || 0);
  const threeQuarterBaths = Number(building?.threeQuarterBaths || 0);
  const quarterBaths = Number(building?.quarterBaths || 0);
  let bathrooms = fullBaths + (halfBaths * 0.5) + (threeQuarterBaths * 0.75) + (quarterBaths * 0.25);
  
  // Fallback to baths field
  if (!bathrooms && building?.baths) {
    bathrooms = Number(building.baths);
  }

  // Get lot size
  let lotSize = 'N/A';
  if (parcel.lotSizeSquareFeet) {
    lotSize = `${Number(parcel.lotSizeSquareFeet).toLocaleString()} sqft`;
  } else if (parcel.lotSizeAcres) {
    lotSize = `${parcel.lotSizeAcres} acres`;
  }

  return {
    address: address.deliveryLine || address.full || '',
    city: address.city || '',
    state: address.state || address.stateCode || '',
    zipCode: address.zip || address.zipcode || address.postalCode || '',
    bedrooms: Number(building?.bedrooms || building?.totalRooms || 0),
    bathrooms: bathrooms || 0,
    sqft,
    garage: garageInfo,
    garageCars,
    garageSqft,
    yearBuilt: Number(building?.yearBuilt || 0),
    lotSize,
  };
};

/**
 * Custom hook for property address lookup using Bridge API
 * Matches the exact behavior of PropertyLookup.tsx
 */
export function usePropertyLookup(): PropertyLookupResult {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingProperty, setIsLoadingProperty] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [propertyData, setPropertyData] = useState<PropertyData>(DEFAULT_PROPERTY_DATA);
  const [error, setError] = useState<string | null>(null);
  
  const debounceRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset state
  const reset = useCallback(() => {
    setSuggestions([]);
    setIsSearching(false);
    setIsLoadingProperty(false);
    setIsVerified(false);
    setPropertyData(DEFAULT_PROPERTY_DATA);
    setError(null);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Search addresses using Bridge API (exactly like PropertyLookup.tsx)
  const searchAddresses = useCallback((query: string) => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Minimum 5 characters (matching PropertyLookup.tsx)
    if (query.length < 5) {
      setSuggestions([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Debounce 600ms (matching PropertyLookup.tsx)
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      abortControllerRef.current = new AbortController();

      try {
        // Use RESO Web API OData with contains filter (exactly like PropertyLookup.tsx line 84-93)
        const filter = `contains(tolower(UnparsedAddress), '${query.toLowerCase().replace(/'/g, "''")}')`;
        const url = `${BRIDGE_DATA_BASE_URL}/OData/pub/Property?access_token=${BRIDGE_DATA_ACCESS_TOKEN}&$filter=${encodeURIComponent(filter)}&$top=10&$select=ListingKey,UnparsedAddress,City,StateOrProvince,PostalCode,BedroomsTotal,BathroomsTotalInteger,LivingArea,GarageSpaces,YearBuilt,LotSizeSquareFeet`;

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: abortControllerRef.current?.signal,
        });

        if (response.ok) {
          const data = await response.json();
          console.log('RESO API Response:', data);
          
          const results: AddressSuggestion[] = (data.value || []).map((property: any) => ({
            id: property.ListingKey || property['@odata.id'],
            fullAddress: property.UnparsedAddress || '',
            streetAddress: property.UnparsedAddress || '',
            city: property.City || '',
            state: property.StateOrProvince || '',
            zipCode: property.PostalCode || '',
            // Store property data for later use
            bedrooms: property.BedroomsTotal || 0,
            bathrooms: property.BathroomsTotalInteger || 0,
            sqft: property.LivingArea || 0,
            garage: property.GarageSpaces || 0,
            yearBuilt: property.YearBuilt || 0,
            lotSize: property.LotSizeSquareFeet || 0,
          }));

          setSuggestions(results);
        } else {
          // Fallback: Try parcels with full address search (exactly like PropertyLookup.tsx line 119-143)
          console.warn('RESO API failed, trying parcels endpoint');
          
          const parcelsUrl = `${BRIDGE_DATA_BASE_URL}/pub/parcels?access_token=${BRIDGE_DATA_ACCESS_TOKEN}&address.full=${encodeURIComponent(query)}&limit=10`;
          
          const parcelsResponse = await fetch(parcelsUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: abortControllerRef.current?.signal,
          });

          if (parcelsResponse.ok) {
            const parcelsData = await parcelsResponse.json();
            console.log('Parcels API Response:', parcelsData);
            
            const results: AddressSuggestion[] = (parcelsData.bundle || []).map((parcel: any) => ({
              id: parcel.id || parcel._id,
              fullAddress: parcel.address?.full || `${parcel.address?.deliveryLine || ''}, ${parcel.address?.city || ''}, ${parcel.address?.state || ''} ${parcel.address?.zip || ''}`,
              streetAddress: parcel.address?.deliveryLine || parcel.address?.full || '',
              city: parcel.address?.city || '',
              state: parcel.address?.state || '',
              zipCode: parcel.address?.zip || '',
            }));

            setSuggestions(results);
          } else {
            setSuggestions([]);
            setError('No addresses found');
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Address search error:', err);
          setError('Failed to search addresses');
          setSuggestions([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 600);
  }, []);

  // Select address and fetch full property details (exactly like PropertyLookup.tsx handleSelectAddress)
  const selectAddress = useCallback(async (suggestion: AddressSuggestion): Promise<void> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    setSuggestions([]);
    setIsLoadingProperty(true);
    setIsVerified(false);
    setError(null);

    try {
      // Fetch detailed parcel data (exactly like PropertyLookup.tsx line 163-228)
      const url = `${BRIDGE_DATA_BASE_URL}/pub/parcels/${suggestion.id}?access_token=${BRIDGE_DATA_ACCESS_TOKEN}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Full parcel data:', data);

        const parsed = parseParcelResponse(data);
        
        if (parsed) {
          setPropertyData({
            address: suggestion.fullAddress || parsed.address || '',
            city: parsed.city || suggestion.city || '',
            state: parsed.state || suggestion.state || '',
            zipCode: parsed.zipCode || suggestion.zipCode || '',
            bedrooms: parsed.bedrooms || suggestion.bedrooms || 0,
            bathrooms: parsed.bathrooms || suggestion.bathrooms || 0,
            sqft: parsed.sqft || suggestion.sqft || 0,
            garage: parsed.garage || 'N/A',
            garageCars: parsed.garageCars,
            garageSqft: parsed.garageSqft,
            yearBuilt: parsed.yearBuilt || suggestion.yearBuilt || 0,
            lotSize: parsed.lotSize || 'N/A',
          });
          setIsVerified(true);
        } else {
          // Use data from suggestion if parcel parsing failed
          setPropertyData({
            ...DEFAULT_PROPERTY_DATA,
            address: suggestion.fullAddress,
            city: suggestion.city,
            state: suggestion.state,
            zipCode: suggestion.zipCode,
            bedrooms: suggestion.bedrooms || 0,
            bathrooms: suggestion.bathrooms || 0,
            sqft: suggestion.sqft || 0,
          });
          setIsVerified(true);
        }
      } else {
        // Use data from suggestion if API call failed
        console.warn('Failed to fetch parcel details, using suggestion data');
        setPropertyData({
          ...DEFAULT_PROPERTY_DATA,
          address: suggestion.fullAddress,
          city: suggestion.city,
          state: suggestion.state,
          zipCode: suggestion.zipCode,
          bedrooms: suggestion.bedrooms || 0,
          bathrooms: suggestion.bathrooms || 0,
          sqft: suggestion.sqft || 0,
        });
        setIsVerified(true);
      }
    } catch (err) {
      console.error('Property details error:', err);
      // Set basic data from suggestion even if detailed fetch fails
      setPropertyData({
        ...DEFAULT_PROPERTY_DATA,
        address: suggestion.fullAddress,
        city: suggestion.city,
        state: suggestion.state,
        zipCode: suggestion.zipCode,
        bedrooms: suggestion.bedrooms || 0,
        bathrooms: suggestion.bathrooms || 0,
        sqft: suggestion.sqft || 0,
      });
      setIsVerified(true);
    } finally {
      setIsLoadingProperty(false);
    }
  }, []);

  return {
    suggestions,
    isSearching,
    isLoadingProperty,
    isVerified,
    propertyData,
    error,
    searchAddresses,
    selectAddress,
    reset,
  };
}

export default usePropertyLookup;
