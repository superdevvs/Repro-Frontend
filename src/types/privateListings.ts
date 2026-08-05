export interface PrivateListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;
  heroImage?: string;
  scheduledDate?: string;
  completedDate?: string;
  client: { name: string; email?: string };
  photographer?: { name: string };
  services: string[];
  status: string;
  payment?: { totalPaid?: number; totalQuote?: number };
  tourLinks?: Record<string, unknown>;
  floorplans?: Array<Record<string, unknown> | string>;
  isPrivateListing: boolean;
  isListingHidden: boolean;
  listing_type?: 'for_sale' | 'for_rent';
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  price?: number;
  mls_number?: string;
  latitude?: number;
  longitude?: number;
  coordsSource?: 'api' | 'cache' | 'geocode';
}
