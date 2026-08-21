import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useLocation } from 'react-router-dom';
import { ShootData } from '@/types/shoots';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from 'date-fns';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from '@/components/ui/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getImpersonatedUserId } from '@/services/api';
import { applyAlternateDate as applyAlternateDateRequest, type ApplyAlternateDateScope } from '@/services/shoots';
import {
  applyFallbackMedia,
  getStoredShoots,
  transformShootFromApi,
  type ApiShoot,
} from './shootNormalization';
import { registerShootListRefresh } from '@/realtime/realtimeRefreshBus';
import {
  ShootsContext,
  type FetchShootsOptions,
  type ShootsContextType,
} from './shootsContextState';

const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken') || localStorage.getItem('token');
};

const buildFetchHeaders = (token: string): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  
  // Add impersonation header if impersonating
  const impersonatedUserId = getImpersonatedUserId();
  if (impersonatedUserId) {
    headers['X-Impersonate-User-Id'] = impersonatedUserId;
  }
  
  return headers;
};

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const parseJsonResponse = async <T,>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return {} as T;
  }

  return JSON.parse(text) as T;
};

type ShootListMeta = {
  current_page?: number;
  last_page?: number;
  count?: number;
  total?: number;
  per_page?: number;
};

type ShootListPayload = {
  data?: ApiShoot[];
  meta?: ShootListMeta;
};

const deduplicateApiShoots = (records: ApiShoot[]): ApiShoot[] =>
  Array.from(
    new Map<ApiShoot['id'], ApiShoot>(
      records.map((record) => [record.id, record]),
    ).values(),
  );

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

const shouldAutoFetchShootsForPath = (path: string) =>
  path === '/dashboard'
  || path === '/accounts'
  || path === '/book-shoot'
  || path === '/accounting'
  || path === '/invoices'
  || path === '/shoot-history'
  || path === '/shoot-calendar'
  || path.startsWith('/accounts/')
  || path.startsWith('/shoots/')
  || path.startsWith('/photographer');

export const ShootsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shoots, setShoots] = useState<ShootData[]>(getStoredShoots);
  const [paginationMeta, setPaginationMeta] = useState<ShootsContextType['paginationMeta']>();
  const { user, logout, isImpersonating } = useAuth();
  const location = useLocation();
  const sessionExpiredRef = useRef(false);
  const locationRef = useRef(location.pathname);
  const fetchInFlightRef = useRef(false);
  const autoFetchKeyRef = useRef<string | null>(null);
  const autoFetchControllerRef = useRef<AbortController | null>(null);
  const clientRole = user?.role;
  const clientUserId = user?.id ? String(user.id) : null;
  const clientName = user?.name;
  const clientCompany = user?.company;
  const clientEmail = user?.email;

  // Keep locationRef in sync without triggering re-fetches
  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    sessionExpiredRef.current = false;
    // Clear cached shoots when user changes (e.g., during impersonation)
    // This ensures fresh data is fetched for the new user context
    setShoots([]);
    localStorage.removeItem('shoots');
  }, [user?.id]);

  const handleSessionExpired = useCallback(
    (description?: string) => {
      if (sessionExpiredRef.current) return;
      // Don't show session expired on login page or if user never logged in
      if (locationRef.current === '/' || !clientUserId) return;
      // During impersonation, 401s can happen transiently when the user
      // context is switching.  Never log the admin out because of them.
      if (isImpersonating || localStorage.getItem('originalUser')) return;
      sessionExpiredRef.current = true;
      toast({
        title: 'Session expired',
        description: description || 'Please sign in again to continue.',
        variant: 'destructive',
      });
      logout();
    },
    [clientUserId, isImpersonating, logout],
  );

  const persistShoots = useCallback((items: ShootData[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('shoots', JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('shoots:updated'));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleShootsUpdated = () => {
      setShoots(getStoredShoots());
    };
    window.addEventListener('shoots:updated', handleShootsUpdated);
    return () => window.removeEventListener('shoots:updated', handleShootsUpdated);
  }, []);

  const fetchShoots = useCallback(async (
    signal?: AbortSignal,
    page = 1,
    perPage = 25,
    options?: FetchShootsOptions,
  ): Promise<ShootData[]> => {
    const token = getAuthToken();
    const includeFiles = options?.includeFiles ?? true;
    if (!token) {
      handleSessionExpired('Please log in to view the latest shoots.');
      setShoots([]);
      persistShoots([]);
      return [];
    }

    if (!clientRole) {
      return [];
    }

    // Dedup guard: skip if another fetch is already in flight (unless it has an AbortSignal, meaning it's a fresh controlled fetch)
    if (fetchInFlightRef.current && !signal) {
      return [];
    }

    fetchInFlightRef.current = true;
    try {
      // For admins/superadmins, fetch from both 'scheduled' and 'completed' tabs to get all non-delivered shoots
      // For photographers, fetch from both tabs to see all shoots until delivered
      // For editors, fetch scheduled + completed + delivered to see assigned edits across the pipeline
      // For others, use 'scheduled' tab (default)
      const isAdmin = clientRole === 'admin' || clientRole === 'superadmin';
      const isEditor = clientRole === 'editor';
      const isEditingManager = clientRole === 'editing_manager';
      const isPhotographer = clientRole === 'photographer';
      
      let allShoots: ShootData[] = [];
      
      if (isAdmin || isPhotographer || isEditor || isEditingManager) {
        const headers = buildFetchHeaders(token);
        if (isEditor || isPhotographer || isEditingManager) {
          const [scheduledResponse, completedResponse, deliveredResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/shoots?tab=scheduled&page=${page}&per_page=${perPage}&include_files=${includeFiles ? 'true' : 'false'}`, {
              headers,
              signal,
            }),
            fetch(`${API_BASE_URL}/api/shoots?tab=completed&page=${page}&per_page=${perPage}&include_files=${includeFiles ? 'true' : 'false'}`, {
              headers,
              signal,
            }),
            fetch(`${API_BASE_URL}/api/shoots?tab=delivered&page=${page}&per_page=${perPage}&include_files=${includeFiles ? 'true' : 'false'}`, {
              headers,
              signal,
            }),
          ]);

          if (scheduledResponse.status === 401 || scheduledResponse.status === 419 ||
              completedResponse.status === 401 || completedResponse.status === 419 ||
              deliveredResponse.status === 401 || deliveredResponse.status === 419) {
            handleSessionExpired();
            setShoots([]);
            persistShoots([]);
            return [];
          }

          if (!scheduledResponse.ok || !completedResponse.ok || !deliveredResponse.ok) {
            throw new Error('Failed to load shoots from server');
          }

          const scheduledJson = await parseJsonResponse<ShootListPayload>(scheduledResponse);
          const completedJson = await parseJsonResponse<ShootListPayload>(completedResponse);
          const deliveredJson = await parseJsonResponse<ShootListPayload>(deliveredResponse);

          const scheduledRecords = Array.isArray(scheduledJson.data) ? scheduledJson.data : [];
          const completedRecords = Array.isArray(completedJson.data) ? completedJson.data : [];
          const deliveredRecords = Array.isArray(deliveredJson.data) ? deliveredJson.data : [];

          const combinedRecords = [...scheduledRecords, ...completedRecords, ...deliveredRecords];
          const uniqueRecords = deduplicateApiShoots(combinedRecords);

          allShoots = applyFallbackMedia(uniqueRecords.map(transformShootFromApi));

          if (scheduledJson.meta || completedJson.meta || deliveredJson.meta) {
            const totalCount = (scheduledJson.meta?.count || 0) + (completedJson.meta?.count || 0) + (deliveredJson.meta?.count || 0);
            setPaginationMeta({
              currentPage: page,
              lastPage: Math.max(
                scheduledJson.meta?.last_page || 1,
                completedJson.meta?.last_page || 1,
                deliveredJson.meta?.last_page || 1,
              ),
              total: totalCount,
              perPage: perPage,
            });
          }
        } else {
          // Fetch from both tabs and combine to show all shoots until delivered
          const [scheduledResponse, completedResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/shoots?tab=scheduled&page=${page}&per_page=${perPage}&include_files=${includeFiles ? 'true' : 'false'}`, {
              headers,
              signal,
            }),
            fetch(`${API_BASE_URL}/api/shoots?tab=completed&page=${page}&per_page=${perPage}&include_files=${includeFiles ? 'true' : 'false'}`, {
              headers,
              signal,
            }),
          ]);

          if (scheduledResponse.status === 401 || scheduledResponse.status === 419 || 
              completedResponse.status === 401 || completedResponse.status === 419) {
            handleSessionExpired();
            setShoots([]);
            persistShoots([]);
            return [];
          }

          if (!scheduledResponse.ok || !completedResponse.ok) {
            throw new Error('Failed to load shoots from server');
          }

          const scheduledJson = await parseJsonResponse<ShootListPayload>(scheduledResponse);
          const completedJson = await parseJsonResponse<ShootListPayload>(completedResponse);
          
          const scheduledRecords = Array.isArray(scheduledJson.data) ? scheduledJson.data : [];
          const completedRecords = Array.isArray(completedJson.data) ? completedJson.data : [];
          
          // Combine and deduplicate by ID
          const combinedRecords = [...scheduledRecords, ...completedRecords];
          const uniqueRecords = deduplicateApiShoots(combinedRecords);
          
          allShoots = applyFallbackMedia(uniqueRecords.map(transformShootFromApi));
          
          // Update pagination meta from combined results
          if (scheduledJson.meta || completedJson.meta) {
            const totalCount = (scheduledJson.meta?.count || 0) + (completedJson.meta?.count || 0);
            setPaginationMeta({
              currentPage: page,
              lastPage: Math.max(scheduledJson.meta?.last_page || 1, completedJson.meta?.last_page || 1),
              total: totalCount,
              perPage: perPage,
            });
          }
        }
      } else if (clientRole === 'client') {
        // For clients: fetch from multiple tabs to get all their shoots (scheduled, completed, delivered)
        const headers = buildFetchHeaders(token);
        const deliveredPerPage = Math.max(perPage, 250);
        const clientTabRequests = [
          {
            tab: 'scheduled' as const,
            requestPage: page,
            requestPerPage: perPage,
          },
          {
            tab: 'completed' as const,
            requestPage: page,
            requestPerPage: perPage,
          },
          {
            tab: 'delivered' as const,
            requestPage: 1,
            requestPerPage: deliveredPerPage,
          },
        ];
        const clientTabResponses = await Promise.all(
          clientTabRequests.map(async ({ tab, requestPage, requestPerPage }) => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/shoots?tab=${tab}&page=${requestPage}&per_page=${requestPerPage}&include_files=${includeFiles ? 'true' : 'false'}`, {
                headers,
                signal,
              });
              return { tab, response };
            } catch (error) {
              return { tab, error };
            }
          }),
        );

        if (
          signal?.aborted ||
          clientTabResponses.every((result) => 'error' in result && isAbortError(result.error))
        ) {
          return [];
        }

        if (clientTabResponses.some((result) =>
          'response' in result && (result.response.status === 401 || result.response.status === 419)
        )) {
          handleSessionExpired();
          setShoots([]);
          persistShoots([]);
          return [];
        }

        const successfulClientTabResponses = clientTabResponses.filter(
          (result): result is { tab: 'scheduled' | 'completed' | 'delivered'; response: Response } =>
            'response' in result && result.response.ok,
        );

        if (successfulClientTabResponses.length === 0) {
          throw new Error('Failed to load shoots from server');
        }

        const failedClientTabs = clientTabResponses
          .filter((result) => !('response' in result) || !result.response.ok)
          .map((result) => result.tab);
        if (failedClientTabs.length > 0) {
          console.warn('Some client shoot tabs failed to load:', failedClientTabs);
        }

        const clientTabJsonEntries = await Promise.all(
          successfulClientTabResponses.map(async ({ tab, response }) => [
            tab,
            await parseJsonResponse<ShootListPayload>(response),
          ] as const),
        );
        const clientTabJson = Object.fromEntries(clientTabJsonEntries) as Partial<
          Record<'scheduled' | 'completed' | 'delivered', ShootListPayload>
        >;

        const scheduledJson = clientTabJson.scheduled ?? {};
        const completedJson = clientTabJson.completed ?? {};
        const deliveredJson = clientTabJson.delivered ?? {};
        
        const scheduledRecords = Array.isArray(scheduledJson.data) ? scheduledJson.data : [];
        const completedRecords = Array.isArray(completedJson.data) ? completedJson.data : [];
        const deliveredRecords = Array.isArray(deliveredJson.data) ? deliveredJson.data : [];
        
        // Combine and deduplicate by ID
        const combinedRecords = [...scheduledRecords, ...completedRecords, ...deliveredRecords];
        const uniqueRecords = deduplicateApiShoots(combinedRecords);
        
        allShoots = applyFallbackMedia(uniqueRecords.map(transformShootFromApi));
        
        // Update pagination meta from combined results
        const totalCount = (scheduledJson.meta?.count || 0) + (completedJson.meta?.count || 0) + (deliveredJson.meta?.count || 0);
        setPaginationMeta({
          currentPage: page,
          lastPage: Math.max(
            scheduledJson.meta?.last_page || 1, 
            completedJson.meta?.last_page || 1,
            deliveredJson.meta?.last_page || 1
          ),
          total: totalCount,
          perPage: perPage,
        });
      } else {
        // For other roles (salesRep, etc.), use default scheduled tab
        const headers = buildFetchHeaders(token);
        const response = await fetch(`${API_BASE_URL}/api/shoots?page=${page}&per_page=${perPage}&include_files=${includeFiles ? 'true' : 'false'}`, {
          headers,
          signal,
        });

        if (response.status === 401 || response.status === 419) {
          handleSessionExpired();
          setShoots([]);
          persistShoots([]);
          return [];
        }

        if (!response.ok) {
          // Try to get error message from response
          let errorMessage = 'Failed to load shoots from server';
          let errorData = null;
          try {
            errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {
            // If response is not JSON, use status text
            errorMessage = response.statusText || errorMessage;
          }
          console.error('API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            data: errorData,
            url: `${API_BASE_URL}/api/shoots?page=${page}&per_page=${perPage}`,
          });
          throw new Error(errorMessage);
        }

        const json = await parseJsonResponse<ShootListPayload>(response);
        const records = Array.isArray(json.data) ? json.data : [];
        allShoots = applyFallbackMedia(records.map(transformShootFromApi));
        
        // Update pagination meta if present
        if (json.meta) {
          setPaginationMeta({
            currentPage: json.meta.current_page || 1,
            lastPage: json.meta.last_page || 1,
            total: json.meta.count || json.meta.total || 0,
            perPage: json.meta.per_page || perPage,
          });
        }
      }
      
      setShoots(allShoots);
      persistShoots(allShoots);
      return allShoots;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return [];
      }
      console.error('Error fetching shoots:', error);
      if ((error as Error)?.message === 'Unauthorized') {
        setShoots([]);
        persistShoots([]);
        return [];
      }
      
      // Don't fall back to mock data - return empty array
      // Mock data is not filtered by account and could leak data
      let errorMessage = 'An unexpected error occurred while loading shoots.';
      if (error instanceof Error) {
        if (error.message === 'Failed to load shoots from server') {
          errorMessage = 'Unable to connect to the server. Please check your connection and ensure the backend is running.';
        } else if (error.message.includes('Network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        }
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setShoots([]);
      persistShoots([]);
      return [];
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [clientRole, handleSessionExpired, persistShoots]);

  const refreshShoots = useCallback(async (): Promise<void> => {
    if (!shouldAutoFetchShootsForPath(locationRef.current)) {
      return;
    }
    await fetchShoots(undefined, 1, 25, { includeFiles: false });
  }, [fetchShoots]);

  // Hydrate each authenticated user/role once. The key is set before starting
  // the request so React StrictMode's development effect replay cannot launch
  // a second scheduled/completed/delivered request set.
  useEffect(() => {
    if (!clientUserId || !clientRole) {
      autoFetchControllerRef.current?.abort();
      autoFetchControllerRef.current = null;
      autoFetchKeyRef.current = null;
      return;
    }
    if (!shouldAutoFetchShootsForPath(location.pathname)) {
      return;
    }

    const autoFetchKey = `${clientUserId}:${clientRole}`;
    if (autoFetchKeyRef.current === autoFetchKey) {
      return;
    }

    autoFetchControllerRef.current?.abort();
    const controller = new AbortController();
    autoFetchControllerRef.current = controller;
    autoFetchKeyRef.current = autoFetchKey;
    fetchShoots(controller.signal, 1, 25, { includeFiles: false }).catch(() => undefined);
  }, [clientRole, clientUserId, fetchShoots, location.pathname]);

  useEffect(() => {
    if (!user?.id) return;
    return registerShootListRefresh(refreshShoots);
  }, [refreshShoots, user?.id]);

  const uniquePhotographers = useMemo(() => {
    const photographersMap = new Map<
      string,
      { name: string; shootCount: number; avatar?: string }
    >();
    shoots.forEach(shoot => {
      if (shoot.photographer && shoot.photographer.name) {
        const name = shoot.photographer.name;
        const existingPhotographer = photographersMap.get(name);
        if (existingPhotographer) {
          photographersMap.set(name, {
            ...existingPhotographer,
            shootCount: existingPhotographer.shootCount + 1,
          });
        } else {
          photographersMap.set(name, {
            name,
            avatar: shoot.photographer.avatar,
            shootCount: 1,
          });
        }
      }
    });
    return Array.from(photographersMap.values());
  }, [shoots]);

  const uniqueEditors = useMemo(() => {
    const editorsMap = new Map<string, { name: string; shootCount: number; avatar?: string }>();
    shoots.forEach(shoot => {
      if (shoot.editor && shoot.editor.name) {
        const name = shoot.editor.name;
        const existingEditor = editorsMap.get(name);
        if (existingEditor) {
          editorsMap.set(name, {
            ...existingEditor,
            shootCount: existingEditor.shootCount + 1,
          });
        } else {
          editorsMap.set(name, {
            name,
            avatar: shoot.editor.avatar,
            shootCount: 1,
          });
        }
      }
    });
    return Array.from(editorsMap.values());
  }, [shoots]);

  const uniqueClients = useMemo(() => {
    const clientsMap = new Map<
      string,
      { name: string; email?: string; company?: string; phone?: string; shootCount: number }
    >();
    shoots.forEach(shoot => {
      if (shoot.client && shoot.client.name) {
        const name = shoot.client.name;
        const existingClient = clientsMap.get(name);
        if (existingClient) {
          clientsMap.set(name, {
            ...existingClient,
            shootCount: existingClient.shootCount + 1,
          });
        } else {
          clientsMap.set(name, {
            name,
            email: shoot.client.email,
            company: shoot.client.company,
            phone: shoot.client.phone,
            shootCount: 1,
          });
        }
      }
    });
    return Array.from(clientsMap.values());
  }, [shoots]);

  const addShoot = useCallback(
    (shoot: ShootData) => {
      setShoots(prevShoots => {
        const updated = [...prevShoots, shoot];
        persistShoots(updated);
        return updated;
      });
    },
    [persistShoots],
  );

  const updateShoot = useCallback(
    async (shootId: string, updates: Partial<ShootData>, options?: { skipApi?: boolean }) => {
      setShoots(prevShoots => {
        const updatedShoots = prevShoots.map(shoot => {
          // Compare IDs as strings to handle number/string mismatches
          const shootIdStr = String(shoot.id);
          const updateIdStr = String(shootId);
          
          if (shootIdStr === updateIdStr) {
            console.log('🔄 Updating shoot in context:', shootIdStr, updates);
            // Deep merge nested objects (client, photographer, location, etc.)
            const merged: ShootData = { ...shoot };
            
            // Merge nested objects properly
            if (updates.client) {
              merged.client = {
                ...shoot.client,
                ...updates.client,
                rep: updates.client.rep ?? updates.rep ?? shoot.client?.rep ?? shoot.rep ?? null,
              };
            }
            if (updates.photographer) {
              merged.photographer = updates.photographer; // Replace entire photographer object
            }
            if (updates.location) {
              merged.location = { ...shoot.location, ...updates.location };
            }
            if (updates.payment) {
              merged.payment = { ...shoot.payment, ...updates.payment };
            }
            if (updates.propertyDetails) {
              merged.propertyDetails = { ...shoot.propertyDetails, ...updates.propertyDetails };
            }
            if (updates.services) {
              merged.services = updates.services;
            }
            
            // Merge top-level fields (this will override nested objects if they're in updates)
            const final = { ...merged, ...updates };
            console.log('🔄 Updated shoot:', final.id, { 
              client: final.client?.name, 
              photographer: final.photographer?.name,
              status: final.status 
            });
            return final;
          }
          return shoot;
        });
        persistShoots(updatedShoots);
        console.log('🔄 Context shoots updated, total shoots:', updatedShoots.length);
        return updatedShoots;
      });

      if (options?.skipApi) {
        return;
      }

      const token = getAuthToken();
      if (!token) {
      handleSessionExpired();
      return;
      }

      const payload: Record<string, unknown> = {};
      if (updates.status) {
        // Normalize hold_on to on_hold for backend validation
        payload.status = updates.status === 'hold_on' ? 'on_hold' : updates.status;
      }
      if (updates.workflowStatus) {
        // Normalize hold_on to on_hold for backend validation
        payload.workflow_status = updates.workflowStatus === 'hold_on' ? 'on_hold' : updates.workflowStatus;
      }
      if (updates.scheduledDate) payload.scheduled_date = updates.scheduledDate;
      if (updates.time) payload.time = updates.time;

      if (Object.keys(payload).length === 0) {
        // No API call needed - local state already updated above
        return;
      }

      // Make API call in background - don't block or show errors since local state is already updated
      // This is just for syncing with server, but the UI already shows the updated data
      const headers = buildFetchHeaders(token);
      headers['Content-Type'] = 'application/json';
      fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (response.status === 401 || response.status === 419) {
            handleSessionExpired();
            return;
          }
          if (!response.ok) {
            // Silently handle errors - local state is already updated
            console.log('Context updateShoot API call failed (non-critical, state already updated):', response.status);
          }
        })
        .catch((error) => {
          // Silently handle all errors - local state was already updated above
          // The UI already reflects the changes, so we don't need to show errors
          console.log('Context updateShoot API call error (ignored, state already updated):', error);
        });
    },
    [persistShoots, handleSessionExpired],
  );

  const applyAlternateDate = useCallback(
    async (shootId: string, scope: ApplyAlternateDateScope = 'main'): Promise<ShootData> => {
      // POST to the apply endpoint and unwrap the raw shoot resource.
      const resource = await applyAlternateDateRequest(shootId, scope);
      // Normalize the returned resource with the same transformer the fetch path uses.
      const normalized = transformShootFromApi(resource as ApiShoot);
      // Merge into local state without a second round-trip (skipApi avoids re-POSTing).
      await updateShoot(shootId, normalized, { skipApi: true });
      return normalized;
    },
    [updateShoot],
  );

  const deleteShoot = useCallback(
    (shootId: string) => {
      setShoots(prevShoots => {
        const next = prevShoots.filter(shoot => shoot.id !== shootId);
        persistShoots(next);
        return next;
      });

      const token = getAuthToken();
      if (!token) {
        return;
      }

      (async () => {
        try {
          const headers = buildFetchHeaders(token);
          const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
            method: 'DELETE',
            headers,
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err?.message || 'Failed to delete shoot');
          }
        } catch (error) {
          console.error('Error deleting shoot:', error);
          toast({
            title: 'Unable to delete shoot',
            description:
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred while deleting the shoot.',
            variant: 'destructive',
          });
        }
      })();
    },
    [persistShoots],
  );

  const getClientShootsByStatus = useCallback(
    (status: string): ShootData[] => {
      if (clientRole === 'client') {
      return shoots.filter(
        shoot =>
          shoot.status === status &&
            (shoot.client.name === clientName ||
              shoot.client.company === clientCompany ||
              shoot.client.email === clientEmail),
      );
    }

    return shoots.filter(shoot => shoot.status === status);
    },
    [shoots, clientRole, clientName, clientCompany, clientEmail],
  );

  const getUniquePhotographers = useCallback(
    () => uniquePhotographers.map(entry => ({ ...entry })),
    [uniquePhotographers],
  );

  const getUniqueEditors = useCallback(
    () => uniqueEditors.map(entry => ({ ...entry })),
    [uniqueEditors],
  );

  const getUniqueClients = useCallback(
    () => uniqueClients.map(entry => ({ ...entry })),
    [uniqueClients],
  );

  const createNewShoot = useCallback((shootData: Partial<ShootData>) => {
    const newShoot: ShootData = {
      id: uuidv4(),
      scheduledDate: shootData.scheduledDate || format(new Date(), 'yyyy-MM-dd'),
      time: shootData.time || '10:00',
      client: {
        name: shootData.client?.name || 'New Client',
        email: shootData.client?.email || 'client@example.com',
        company: shootData.client?.company || '',
        totalShoots: shootData.client?.totalShoots || 0,
      },
      location: {
        address: shootData.location?.address || '123 Main St',
        address2: shootData.location?.address2 || '',
        city: shootData.location?.city || 'Cityville',
        state: shootData.location?.state || 'CA',
        zip: shootData.location?.zip || '90210',
        fullAddress: shootData.location?.fullAddress || '123 Main St, Cityville, CA 90210',
      },
      photographer: {
        name: shootData.photographer?.name || 'Unassigned',
      },
      services: shootData.services || ['Photography'],
      payment: shootData.payment || {
        baseQuote: 350,
        taxRate: 0.085,
        taxAmount: 29.75,
        totalQuote: 379.75,
        totalPaid: 0,
      },
      status: shootData.status || 'scheduled',
      workflowStatus: shootData.workflowStatus || 'booked',
      notes: shootData.notes || {
        shootNotes: 'New shoot created',
      },
      createdBy: shootData.createdBy || 'System',
      completedDate: shootData.completedDate,
      media: shootData.media,
      tourLinks: shootData.tourLinks,
      files: shootData.files,
      adminIssueNotes: shootData.adminIssueNotes,
      isFlagged: shootData.isFlagged || false,
      issuesResolvedAt: shootData.issuesResolvedAt,
      issuesResolvedBy: shootData.issuesResolvedBy,
      submittedForReviewAt: shootData.submittedForReviewAt,
      tourPurchased: shootData.tourPurchased,
    };

    addShoot(newShoot);
  }, [addShoot]);

  const seedUpcomingShoots = useCallback((count: number) => {
    const newShoots = Array.from({ length: count }).map((_, index) => {
      const baseDate = addDays(new Date(), index);
      return {
        scheduledDate: format(baseDate, 'yyyy-MM-dd'),
        time: '09:00',
        status: 'scheduled',
        client: {
          name: `Seed Client ${index + 1}`,
          email: `client${index + 1}@example.com`,
          totalShoots: 1,
        },
        location: {
          address: `${100 + index} Market St`,
          city: 'Austin',
          state: 'TX',
          zip: '73301',
          fullAddress: `${100 + index} Market St, Austin, TX 73301`,
        },
      } as Partial<ShootData>;
    });

    newShoots.forEach(shoot => createNewShoot(shoot));
  }, [createNewShoot]);

  const contextValue = useMemo<ShootsContextType>(() => ({
      shoots,
      addShoot,
      updateShoot,
      applyAlternateDate,
      deleteShoot,
      getClientShootsByStatus,
      getUniquePhotographers,
      getUniqueEditors,
      getUniqueClients,
      fetchShoots,
      paginationMeta,
    }), [
      addShoot,
      applyAlternateDate,
      deleteShoot,
      fetchShoots,
      getClientShootsByStatus,
      getUniqueClients,
      getUniqueEditors,
      getUniquePhotographers,
      paginationMeta,
      shoots,
      updateShoot,
    ]);

  return <ShootsContext.Provider value={contextValue}>{children}</ShootsContext.Provider>;
};
