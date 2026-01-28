import React, { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, Loader2, MapPin, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePropertyLookup, PropertyData, AddressSuggestion } from '@/hooks/usePropertyLookup';

export interface PropertyAddressDetails {
  formatted_address: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  garage_cars?: number;
  garage_sqft?: number;
  yearBuilt?: number;
  lotSize?: string;
  property_details?: Record<string, any>;
}

interface PropertyAddressLookupProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (address: PropertyAddressDetails) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  inputClassName?: string;
}

/**
 * Reusable Property Address Lookup component
 * Uses Bridge API to search addresses and auto-fill property details
 * Matches the exact behavior of PropertyLookup.tsx
 */
const PropertyAddressLookup: React.FC<PropertyAddressLookupProps> = ({
  value,
  onChange,
  onAddressSelect,
  placeholder = 'Start typing an address...',
  className = '',
  disabled = false,
  inputClassName = '',
}) => {
  const {
    suggestions,
    isSearching,
    isLoadingProperty,
    isVerified,
    propertyData,
    error,
    searchAddresses,
    selectAddress,
    reset,
  } = usePropertyLookup();

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localVerified, setLocalVerified] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search as user types
  useEffect(() => {
    if (value && value.length >= 5) {
      searchAddresses(value);
    }
  }, [value, searchAddresses]);

  // Show suggestions when we have them
  useEffect(() => {
    setShowSuggestions(suggestions.length > 0);
  }, [suggestions]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setLocalVerified(false);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: AddressSuggestion) => {
    // Update input value immediately
    onChange(suggestion.streetAddress || suggestion.fullAddress);
    setShowSuggestions(false);

    // Fetch full property details
    await selectAddress(suggestion);
  };

  // When property data is verified, call onAddressSelect
  useEffect(() => {
    if (isVerified && propertyData.address && !localVerified) {
      setLocalVerified(true);
      
      // Convert PropertyData to PropertyAddressDetails format
      const addressDetails: PropertyAddressDetails = {
        formatted_address: propertyData.address,
        address: propertyData.address,
        city: propertyData.city,
        state: propertyData.state,
        zip: propertyData.zipCode,
        bedrooms: propertyData.bedrooms || undefined,
        bathrooms: propertyData.bathrooms || undefined,
        sqft: propertyData.sqft || undefined,
        garage_cars: propertyData.garageCars,
        garage_sqft: propertyData.garageSqft,
        yearBuilt: propertyData.yearBuilt || undefined,
        lotSize: propertyData.lotSize !== 'N/A' ? propertyData.lotSize : undefined,
        property_details: {
          bedrooms: propertyData.bedrooms,
          bathrooms: propertyData.bathrooms,
          sqft: propertyData.sqft,
          yearBuilt: propertyData.yearBuilt,
          lotSize: propertyData.lotSize,
          garage: propertyData.garage,
          garageCars: propertyData.garageCars,
          garageSqft: propertyData.garageSqft,
        },
      };
      
      onAddressSelect(addressDetails);
    }
  }, [isVerified, propertyData, localVerified, onAddressSelect]);

  const isLoading = isSearching || isLoadingProperty;
  const showVerified = localVerified && !isLoading;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled || isLoadingProperty}
          className={cn(
            'pr-10 transition-all duration-300',
            showVerified ? 'border-emerald-500 focus:border-emerald-500' : '',
            error ? 'border-red-500' : '',
            inputClassName
          )}
        />
        
        {/* Status icons */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {isLoading && (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          )}
          {showVerified && !isLoading && (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          )}
          {error && !isLoading && (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
          {!isLoading && !showVerified && !error && (
            <Search className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Verified message */}
      {showVerified && (
        <p className="text-emerald-500 text-xs mt-1 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Address verified and property details auto-filled
        </p>
      )}

      {/* Error message */}
      {error && !isLoading && (
        <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      {/* Helper text */}
      {!showVerified && !error && value.length < 5 && value.length > 0 && (
        <p className="text-muted-foreground text-xs mt-1">
          Type at least 5 characters to search
        </p>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSuggestionSelect(suggestion)}
              className="w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors flex items-start gap-2 border-b border-border/50 last:border-0"
            >
              <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium text-sm truncate">
                  {suggestion.streetAddress}
                </p>
                <p className="text-muted-foreground text-xs truncate">
                  {suggestion.city}, {suggestion.state} {suggestion.zipCode}
                </p>
                {/* Show property preview if available */}
                {(suggestion.bedrooms || suggestion.sqft) && (
                  <p className="text-muted-foreground text-[10px] mt-0.5">
                    {suggestion.bedrooms ? `${suggestion.bedrooms} bed` : ''}
                    {suggestion.bedrooms && suggestion.bathrooms ? ' • ' : ''}
                    {suggestion.bathrooms ? `${suggestion.bathrooms} bath` : ''}
                    {(suggestion.bedrooms || suggestion.bathrooms) && suggestion.sqft ? ' • ' : ''}
                    {suggestion.sqft ? `${suggestion.sqft.toLocaleString()} sqft` : ''}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && suggestions.length === 0 && value.length >= 5 && !isSearching && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg p-3">
          <div className="text-center text-muted-foreground">
            <MapPin className="w-5 h-5 mx-auto mb-1 text-muted-foreground/50" />
            <p className="text-xs">No addresses found</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Try entering a more specific address
            </p>
          </div>
        </div>
      )}

      {/* Loading property details overlay */}
      {isLoadingProperty && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-lg z-50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading property details...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyAddressLookup;
export { PropertyAddressLookup };
