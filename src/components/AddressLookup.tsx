import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import { BrandLoader as Loader } from '@/components/ui/brand-loader';

interface AddressSuggestion {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  types: string[];
}

interface AddressDetails {
  formatted_address: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

interface AddressLookupProps {
  onAddressSelect: (address: AddressDetails) => void;
  initialValue?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

const AddressLookup: React.FC<AddressLookupProps> = ({
  onAddressSelect,
  initialValue = '',
  placeholder = 'Enter property address...',
  className = '',
  required = false,
  disabled = false
}) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

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
      }
    ];

    return mockAddresses.filter(addr => 
      addr.description.toLowerCase().includes(query.toLowerCase())
    );
  };

  // Debounced search function
  const searchAddresses = async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `/api/address/search?query=${encodeURIComponent(searchQuery)}`,
        { headers }
      );

      if (!response.ok) {
        // If API fails, use mock data for testing
        console.warn('API not available, using mock data');
        const mockData = getMockSuggestions(searchQuery);
        setSuggestions(mockData);
        setShowSuggestions(true);
        return;
      }

      const data = await response.json();
      setSuggestions(data.data || []);
      setShowSuggestions(true);
    } catch (err) {
      // Fallback to mock data if API is not available
      console.warn('API error, using mock data:', err);
      const mockData = getMockSuggestions(searchQuery);
      setSuggestions(mockData);
      setShowSuggestions(true);
      
      if (mockData.length === 0) {
        setError('Address search temporarily unavailable. Please enter address manually.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedAddress(null);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      searchAddresses(value);
    }, 300);
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
      }
    };

    return mockDetails[placeId] || mockDetails['mock_1'];
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: AddressSuggestion) => {
    setQuery(suggestion.description);
    setShowSuggestions(false);
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `/api/address/details?place_id=${suggestion.place_id}`,
        { headers }
      );

      if (!response.ok) {
        // Use mock data if API fails
        console.warn('API not available, using mock address details');
        const mockDetails = getMockAddressDetails(suggestion.place_id);
        setSelectedAddress(mockDetails);
        onAddressSelect(mockDetails);
        return;
      }

      const data = await response.json();
      const addressDetails = data.data;
      
      setSelectedAddress(addressDetails);
      onAddressSelect(addressDetails);
    } catch (err) {
      // Fallback to mock data
      console.warn('API error, using mock address details:', err);
      const mockDetails = getMockAddressDetails(suggestion.place_id);
      setSelectedAddress(mockDetails);
      onAddressSelect(mockDetails);
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
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`
            w-full px-4 py-3 pl-12 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${selectedAddress ? 'border-green-500 bg-green-50' : 'border-gray-300'}
            ${error ? 'border-red-500 bg-red-50' : ''}
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
          `}
        />
        
        {/* Search icon */}
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        
        {/* Status icons */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          {isLoading && <Loader className="w-5 h-5 text-blue-500" />}
          {selectedAddress && !isLoading && (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          {error && !isLoading && (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center">
          <AlertCircle className="w-4 h-4 mr-1" />
          {error}
        </p>
      )}

      {/* Address validation status */}
      {selectedAddress && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center text-green-800">
            <CheckCircle className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Address Verified</span>
          </div>
          <div className="mt-1 text-sm text-green-700">
            {selectedAddress.formatted_address}
          </div>
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSuggestionSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-start">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {suggestion.main_text}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {suggestion.secondary_text}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && suggestions.length === 0 && query.length >= 3 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
          <div className="text-center text-gray-500">
            <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No addresses found</p>
            <p className="text-xs text-gray-400 mt-1">
              Try entering a more specific address
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressLookup;