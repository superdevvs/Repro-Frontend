/**
 * Service pricing utilities for sqft-based variable pricing
 */

export type SqftRange = {
  id?: number;
  sqft_from: number;
  sqft_to: number;
  duration: number | null;
  price: number;
  photographer_pay: number | null;
};

export type ServiceWithPricing = {
  id: string | number;
  name: string;
  price: number | string;
  pricing_type?: 'fixed' | 'variable';
  allow_multiple?: boolean;
  delivery_time?: number | string;
  photographer_pay?: number | string | null;
  sqft_ranges?: SqftRange[];
  [key: string]: any;
};

/**
 * Find the matching sqft range for a given square footage
 */
export function findSqftRange(sqftRanges: SqftRange[], sqft: number): SqftRange | null {
  if (!sqftRanges || sqftRanges.length === 0) return null;
  
  return sqftRanges.find(range => 
    sqft >= range.sqft_from && sqft <= range.sqft_to
  ) || null;
}

/**
 * Calculate the price for a service based on square footage
 * Returns the sqft-based price for variable pricing, or the base price for fixed pricing
 */
export function calculateServicePrice(service: ServiceWithPricing, sqft: number | null | undefined): number {
  const basePrice = typeof service.price === 'string' ? parseFloat(service.price) : service.price;
  
  if (!sqft || service.pricing_type !== 'variable' || !service.sqft_ranges?.length) {
    return basePrice || 0;
  }
  
  const range = findSqftRange(service.sqft_ranges, sqft);
  return range ? range.price : basePrice || 0;
}

/**
 * Calculate the photographer pay for a service based on square footage
 */
export function calculatePhotographerPay(service: ServiceWithPricing, sqft: number | null | undefined): number | null {
  const basePay = service.photographer_pay 
    ? (typeof service.photographer_pay === 'string' ? parseFloat(service.photographer_pay) : service.photographer_pay)
    : null;
  
  if (!sqft || service.pricing_type !== 'variable' || !service.sqft_ranges?.length) {
    return basePay;
  }
  
  const range = findSqftRange(service.sqft_ranges, sqft);
  return range?.photographer_pay ?? basePay;
}

/**
 * Calculate the duration for a service based on square footage
 */
export function calculateServiceDuration(service: ServiceWithPricing, sqft: number | null | undefined): number | null {
  const baseTime = service.delivery_time 
    ? (typeof service.delivery_time === 'string' ? parseInt(service.delivery_time) : service.delivery_time)
    : null;
  
  if (!sqft || service.pricing_type !== 'variable' || !service.sqft_ranges?.length) {
    return baseTime;
  }
  
  const range = findSqftRange(service.sqft_ranges, sqft);
  return range?.duration ?? baseTime;
}

/**
 * Get pricing info for a service at a given sqft
 * Returns an object with calculated price, photographer pay, and duration
 */
export function getServicePricingForSqft(
  service: ServiceWithPricing, 
  sqft: number | null | undefined
): {
  price: number;
  photographerPay: number | null;
  duration: number | null;
  isVariablePricing: boolean;
  matchedRange: SqftRange | null;
} {
  const isVariable = service.pricing_type === 'variable';
  const matchedRange = sqft && isVariable && service.sqft_ranges?.length 
    ? findSqftRange(service.sqft_ranges, sqft) 
    : null;
  
  return {
    price: calculateServicePrice(service, sqft),
    photographerPay: calculatePhotographerPay(service, sqft),
    duration: calculateServiceDuration(service, sqft),
    isVariablePricing: isVariable,
    matchedRange,
  };
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

/**
 * Get price display string for a service
 * Shows the sqft-based price if applicable, otherwise the base price
 */
export function getServicePriceDisplay(service: ServiceWithPricing, sqft: number | null | undefined): string {
  const price = calculateServicePrice(service, sqft);
  return formatPrice(price);
}
