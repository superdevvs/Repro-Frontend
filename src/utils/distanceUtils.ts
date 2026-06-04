/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
import { API_BASE_URL } from '@/config/env';

type Coordinates = { lat: number; lon: number };

type GeocodeCacheEntry = {
  value: Coordinates | null;
  expiresAt: number;
};

const GEOCODE_SUCCESS_TTL_MS = 1000 * 60 * 60 * 12;
const GEOCODE_FAILURE_TTL_MS = 1000 * 60 * 5;
const geocodeCache = new Map<string, GeocodeCacheEntry>();
const geocodeInflight = new Map<string, Promise<Coordinates | null>>();

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Resolve an address through the backend geocoder and its shared cache.
 */
export async function getCoordinatesFromAddress(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<{ lat: number; lon: number } | null> {
  const query = `${address}, ${city}, ${state} ${zip}`.replace(/\s+/g, ' ').trim();
  if (!query) return null;

  const now = Date.now();
  const cached = geocodeCache.get(query);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const existingRequest = geocodeInflight.get(query);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async (): Promise<Coordinates | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/address/geocode`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, city, state, zip }),
      });

      if (!response.ok) {
        geocodeCache.set(query, { value: null, expiresAt: now + GEOCODE_FAILURE_TTL_MS });
        return null;
      }

      const data = await response.json();
      const latitude = Number(data?.data?.latitude);
      const longitude = Number(data?.data?.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        const coordinates = {
          lat: latitude,
          lon: longitude,
        };
        geocodeCache.set(query, { value: coordinates, expiresAt: now + GEOCODE_SUCCESS_TTL_MS });
        return coordinates;
      }

      geocodeCache.set(query, { value: null, expiresAt: now + GEOCODE_FAILURE_TTL_MS });
      return null;
    } catch (error) {
      console.error('Error geocoding address:', error);
      geocodeCache.set(query, { value: null, expiresAt: now + GEOCODE_FAILURE_TTL_MS });
      return null;
    }
  })();

  geocodeInflight.set(query, request);
  try {
    return await request;
  } finally {
    geocodeInflight.delete(query);
  }
}


