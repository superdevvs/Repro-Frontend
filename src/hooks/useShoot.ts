import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import { ShootData } from '@/types/shoots';
import { transformShootFromApi } from '@/context/ShootsContext';

const getToken = (sessionToken?: string | null) => {
  const localToken =
    (typeof window !== 'undefined' && (localStorage.getItem('authToken') || localStorage.getItem('token'))) ||
    null;
  return localToken || sessionToken || undefined;
};

const fetchShoot = async (shootId: string | number, token?: string): Promise<ShootData> => {
  const authToken = token || getToken();
  if (!authToken) {
    throw new Error('Missing auth token');
  }

  let res: Response;
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
  } catch (fetchError) {
    // Handle network errors (CORS, connection issues, timeout, etc.)
    console.error('Network error fetching shoot:', fetchError);
    
    if (fetchError instanceof Error) {
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out - please try again');
      }
      if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
        throw new Error('Network error - unable to reach server. Please check your connection.');
      }
      throw new Error(`Network error: ${fetchError.message}`);
    }
    throw new Error('Network error - please check your connection and try again');
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Shoot not found');
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('Unauthorized - please refresh the page');
    }
    // Try to get error message from response
    try {
      const errorData = await res.json();
      const errorMessage = errorData.message || errorData.error || `Failed to fetch shoot (${res.status})`;
      throw new Error(errorMessage);
    } catch (parseError) {
      throw new Error(`Failed to fetch shoot: ${res.status} ${res.statusText}`);
    }
  }

  let json: any;
  try {
    json = await res.json();
  } catch (parseError) {
    console.error('Failed to parse shoot response:', parseError);
    throw new Error('Invalid response from server');
  }
  
  const shootData = json.data || json;
  
  if (!shootData || !shootData.id) {
    throw new Error('Invalid shoot data received from server');
  }
  
  // Transform the API response to ShootData format
  try {
    return transformShootFromApi(shootData);
  } catch (transformError) {
    console.error('Error transforming shoot data:', transformError);
    throw new Error('Failed to process shoot data');
  }
};

export const useShoot = (shootId: string | number | null | undefined, options?: { enabled?: boolean }) => {
  const { session } = useAuth();
  
  return useQuery({
    queryKey: ['shoot', shootId],
    queryFn: () => fetchShoot(shootId!, getToken(session?.accessToken)),
    enabled: Boolean(shootId) && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on 404 (not found) or 401/403 (unauthorized)
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('Unauthorized')) {
          return false;
        }
      }
      // Retry up to 2 times for network errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};
