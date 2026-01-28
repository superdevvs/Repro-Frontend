import React, {
  createContext,
  useContext,
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
import { shootsData as mockShootsData } from '@/data/shootsData';
import { getImpersonatedUserId } from '@/services/api';
import { registerShootListRefresh } from '@/realtime/realtimeRefreshBus';

interface ShootsContextType {
  shoots: ShootData[];
  addShoot: (shoot: ShootData) => void;
  updateShoot: (shootId: string, updates: Partial<ShootData>, options?: { skipApi?: boolean }) => Promise<void>;
  deleteShoot: (shootId: string) => void;
  getClientShootsByStatus: (status: string) => ShootData[];
  getUniquePhotographers: () => { name: string; shootCount: number; avatar?: string }[];
  getUniqueEditors: () => { name: string; shootCount: number; avatar?: string }[];
  getUniqueClients: () => {
    name: string;
    email?: string;
    company?: string;
    phone?: string;
    shootCount: number;
  }[];
  fetchShoots: (signal?: AbortSignal, page?: number, perPage?: number, options?: FetchShootsOptions) => Promise<ShootData[]>;
  paginationMeta?: {
    currentPage: number;
    lastPage: number;
    total: number;
    perPage: number;
  };
}

const ShootsContext = createContext<ShootsContextType | undefined>(undefined);

type FetchShootsOptions = {
  includeFiles?: boolean;
};

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

const cloneMedia = (media?: ShootData['media']): ShootData['media'] | undefined => {
  if (!media) return undefined;
  return {
    ...media,
    images: media.images ? media.images.map(image => ({ ...image })) : undefined,
    videos: media.videos ? media.videos.map(video => ({ ...video })) : undefined,
    files: media.files ? media.files.map(file => ({ ...file })) : undefined,
    photos: media.photos ? [...media.photos] : undefined,
    slideshows: media.slideshows ? media.slideshows.map(show => ({ ...show })) : undefined,
  };
};

const FALLBACK_MEDIA_TEMPLATES: ShootData['media'][] = mockShootsData
    .map(shoot => shoot.media)
    .filter((media): media is NonNullable<ShootData['media']> => Boolean(media?.images?.length))
    .slice(0, 10);
const fallbackMediaGroups = FALLBACK_MEDIA_TEMPLATES;

type ApiNotePayload = {
  shootNotes?: string;
  photographerNotes?: string;
  companyNotes?: string;
  editingNotes?: string;
};

type ApiShootPayment = {
  amount?: unknown;
  paid_at?: string;
};

type ApiShoot = {
  id?: string | number;
  scheduled_date?: string;
  time?: string;
  client?: {
    id?: string | number;
    name?: string;
    email?: string;
    company_name?: string;
    phonenumber?: string;
    total_shoots?: number;
  } | null;
  client_shoots_count?: number;
  photographer?: {
    id?: string | number;
    name?: string;
    avatar?: string;
  } | null;
  editor?: {
    id?: string | number;
    name?: string;
    avatar?: string;
  } | null;
  service?: {
    name?: string;
  } | null;
  services?: Array<string | { name?: string; label?: string; service_name?: string }>;
  services_list?: string[];
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  payments?: ApiShootPayment[];
  base_quote?: unknown;
  tax_rate?: unknown;
  tax_amount?: unknown;
  total_quote?: unknown;
  total_paid?: unknown;
  payment_type?: string;
  status?: string;
  workflow_status?: string;
  notes?: string | ApiNotePayload | null;
  shoot_notes?: string;
  photographer_notes?: string;
  company_notes?: string;
  editor_notes?: string;
  admin_issue_notes?: string;
  is_flagged?: boolean;
  issues_resolved_at?: string;
  issues_resolved_by?: string | number;
  submitted_for_review_at?: string;
  created_by?: string;
  completed_date?: string;
  completed_at?: string;
  editing_completed_at?: string;
  admin_verified_at?: string;
  expected_final_count?: number;
  expected_raw_count?: number;
  raw_photo_count?: number;
  edited_photo_count?: number;
  extra_photo_count?: number;
  media?: ShootData['media'];
  tour_links?: ShootData['tourLinks'];
  files?: ShootData['files'];
  tour_purchased?: unknown;
  is_private_listing?: boolean;
  isPrivateListing?: boolean;
  [key: string]: unknown;
};

const isCompletedShoot = (shoot: ShootData): boolean => {
  const status = shoot.status?.toLowerCase();
  return Boolean(shoot.completedDate) || status === 'completed' || status === 'delivered' || status === 'finalized';
};

const isUpcomingShoot = (shoot: ShootData): boolean => {
  if (!shoot?.scheduledDate) return false;
  const scheduledTime = Date.parse(shoot.scheduledDate);
  if (Number.isNaN(scheduledTime)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !isCompletedShoot(shoot) && scheduledTime >= today.getTime();
};

const getDateValue = (shoot: ShootData): number => {
  const primary = Date.parse(shoot.scheduledDate ?? '');
  if (!Number.isNaN(primary)) return primary;
  const secondary = Date.parse(shoot.completedDate ?? '');
  if (!Number.isNaN(secondary)) return secondary;
  return Number.MAX_SAFE_INTEGER;
};

const applyFallbackMedia = (items: ShootData[]): ShootData[] => {
  if (!fallbackMediaGroups.length) {
    return items;
  }

  const upcomingNeeds = items
    .map((shoot, index) => ({ shoot, index }))
    .filter(({ shoot }) => isUpcomingShoot(shoot) && !(shoot.media?.images?.length))
    .sort((a, b) => getDateValue(a.shoot) - getDateValue(b.shoot))
    .slice(0, fallbackMediaGroups.length);

  const augmented = [...items];
  let mediaIndex = 0;

  upcomingNeeds.forEach(({ index }) => {
    if (mediaIndex >= fallbackMediaGroups.length) return;
    const template = fallbackMediaGroups[mediaIndex];
    augmented[index] = { ...augmented[index], media: cloneMedia(template) };
    mediaIndex += 1;
  });

  if (mediaIndex < fallbackMediaGroups.length) {
    const remainingSlots = fallbackMediaGroups.length - mediaIndex;
    const completedNeeds = items
      .map((shoot, index) => ({ shoot, index }))
      .filter(({ shoot }) => isCompletedShoot(shoot) && !(shoot.media?.images?.length))
      .sort((a, b) => getDateValue(b.shoot) - getDateValue(a.shoot))
      .slice(0, remainingSlots);

    completedNeeds.forEach(({ index }) => {
      if (mediaIndex >= fallbackMediaGroups.length) return;
      const template = fallbackMediaGroups[mediaIndex];
      augmented[index] = { ...augmented[index], media: cloneMedia(template) };
      mediaIndex += 1;
    });
  }

  return augmented;
};

const getStoredShoots = (): ShootData[] => {
  // Don't use mock data - only use stored shoots from API
  // Mock data is not filtered by account and could leak data
  if (typeof window === 'undefined') return [];
  const storedShoots = localStorage.getItem('shoots');
  if (!storedShoots) return [];
  try {
    const parsed = JSON.parse(storedShoots);
    // Only return if it's an array (from API), not mock data
    if (Array.isArray(parsed) && parsed.length > 0) {
      return applyFallbackMedia(parsed);
    }
  } catch (e) {
    console.error('Failed to parse stored shoots:', e);
  }
  return [];
};

const normalizeNotes = (shoot: ApiShoot) => {
  const noteValue = shoot?.notes;
  if (typeof noteValue === 'string') {
    return {
      shootNotes: noteValue,
      photographerNotes: undefined,
      companyNotes: undefined,
      editingNotes: undefined,
    };
  }

  const structuredNotes: ApiNotePayload =
    typeof noteValue === 'object' && noteValue !== null ? (noteValue as ApiNotePayload) : {};

  return {
    shootNotes: shoot?.shoot_notes ?? structuredNotes.shootNotes ?? undefined,
    photographerNotes: shoot?.photographer_notes ?? structuredNotes.photographerNotes ?? undefined,
    companyNotes: shoot?.company_notes ?? structuredNotes.companyNotes ?? undefined,
    editingNotes: shoot?.editor_notes ?? structuredNotes.editingNotes ?? undefined,
  };
};

export const transformShootFromApi = (shoot: ApiShoot): ShootData => {
  const client = (shoot.client ?? {}) as NonNullable<ApiShoot['client']>;
  const photographer = (shoot.photographer ?? {}) as NonNullable<ApiShoot['photographer']>;
  const service = (shoot.service ?? {}) as NonNullable<ApiShoot['service']>;
  const editorId = (() => {
    const editorObjId = (shoot.editor as any)?.id;
    if (editorObjId) return String(editorObjId);
    if ((shoot as any).editor_id) return String((shoot as any).editor_id);
    if ((shoot as any).editorId) return String((shoot as any).editorId);
    return undefined;
  })();
  const address = shoot?.address || '';
  const city = shoot?.city || '';
  const state = shoot?.state || '';
  const zip = shoot?.zip || '';
  const payments: ApiShootPayment[] = Array.isArray(shoot?.payments) ? shoot.payments : [];
  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
  const notes = normalizeNotes(shoot);
  const completedDate =
    shoot.completed_at ||
    shoot.editing_completed_at ||
    shoot.admin_verified_at ||
    shoot.completed_date;
  const isPrivateListing =
    typeof (shoot as any).is_private_listing === 'boolean'
      ? Boolean((shoot as any).is_private_listing)
      : Boolean((shoot as any).isPrivateListing);

  const normalizedServices = (() => {
    if (Array.isArray(shoot.services_list) && shoot.services_list.length > 0) {
      return shoot.services_list.filter(Boolean);
    }
    if (Array.isArray(shoot.services)) {
      const names = shoot.services
        .map((serviceItem) => {
          if (typeof serviceItem === 'string') {
            return serviceItem;
          }
          if (serviceItem && typeof serviceItem === 'object') {
            return (
              serviceItem.name ||
              serviceItem.label ||
              serviceItem.service_name ||
              ''
            );
          }
          return '';
        })
        .filter(Boolean) as string[];
      if (names.length > 0) {
        return names;
      }
    }
    if (service.name) {
      return [service.name];
    }
    return [] as string[];
  })();

  return {
    id: String(shoot.id),
    scheduledDate: shoot.scheduled_date || '',
    time: shoot.time || '',
    client: {
      id: client.id ? String(client.id) : undefined,
      name: client.name || 'Client',
      email: client.email || '',
      company: client.company_name || undefined,
      phone: client.phonenumber || undefined,
      totalShoots: client.total_shoots ?? shoot.client_shoots_count ?? 0,
    },
    location: {
      address,
      address2: shoot.address2 || undefined,
      city,
      state,
      zip,
      fullAddress,
    },
    photographer: {
      id: photographer.id ? String(photographer.id) : undefined,
      name: photographer.name || 'Unassigned',
      avatar: photographer.avatar || undefined,
    },
    editor: shoot.editor || editorId
      ? {
          id: editorId,
          name: (shoot.editor as any)?.name ?? '',
          avatar: (shoot.editor as any)?.avatar ?? undefined,
        }
      : undefined,
    editorId,
    services: normalizedServices,
    payment: {
      baseQuote: toNumber(shoot.base_quote),
      taxRate: toNumber(shoot.tax_rate),
      taxAmount: toNumber(shoot.tax_amount),
      totalQuote: toNumber(shoot.total_quote),
      totalPaid:
        toNumber(shoot.total_paid) ||
        payments.reduce((sum: number, payment) => sum + toNumber(payment.amount), 0),
      lastPaymentDate: payments[0]?.paid_at ?? undefined,
      lastPaymentType: shoot.payment_type ?? undefined,
    },
    status: shoot.status || 'booked',
    workflowStatus: shoot.workflow_status || undefined,
    notes,
    adminIssueNotes: shoot.admin_issue_notes ?? undefined,
    isFlagged: Boolean(shoot.is_flagged),
    issuesResolvedAt: shoot.issues_resolved_at ?? undefined,
    issuesResolvedBy: shoot.issues_resolved_by ? String(shoot.issues_resolved_by) : undefined,
    submittedForReviewAt: shoot.submitted_for_review_at ?? undefined,
    createdBy: shoot.created_by || 'System',
    completedDate: completedDate ?? undefined,
    expectedFinalCount: toNumber(shoot.expected_final_count),
    expectedRawCount: toNumber(shoot.expected_raw_count),
    rawPhotoCount: toNumber(shoot.raw_photo_count),
    editedPhotoCount: toNumber(shoot.edited_photo_count),
    extraPhotoCount: toNumber(shoot.extra_photo_count),
    media: shoot.media || undefined,
    tourLinks: shoot.tour_links || undefined,
    iguideTourUrl: (shoot as any).iguide_tour_url || undefined,
    iguideFloorplans: (shoot as any).iguide_floorplans || undefined,
    iguidePropertyId: (shoot as any).iguide_property_id || undefined,
    iguideLastSyncedAt: (shoot as any).iguide_last_synced_at || undefined,
    files: shoot.files || undefined,
    tourPurchased: shoot.tour_purchased ? Boolean(shoot.tour_purchased) : undefined,
    isPrivateListing,
    propertyDetails: (shoot as any).property_details || undefined,
    cancellationRequestedAt: (shoot as any).cancellationRequestedAt || (shoot as any).cancellation_requested_at || undefined,
    cancellationReason: (shoot as any).cancellationReason || (shoot as any).cancellation_reason || undefined,
    mmmStatus: (shoot as any).mmm_status || undefined,
    mmmOrderNumber: (shoot as any).mmm_order_number || undefined,
    mmmBuyerCookie: (shoot as any).mmm_buyer_cookie || undefined,
    mmmRedirectUrl: (shoot as any).mmm_redirect_url || undefined,
    mmmLastPunchoutAt: (shoot as any).mmm_last_punchout_at || undefined,
    mmmLastOrderAt: (shoot as any).mmm_last_order_at || undefined,
    mmmLastError: (shoot as any).mmm_last_error || undefined,
  };
};

// eslint-disable-next-line react-refresh/only-export-components
export const useShoots = () => {
  const context = useContext(ShootsContext);
  if (!context) {
    throw new Error('useShoots must be used within a ShootsProvider');
  }
  return context;
};

export const ShootsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shoots, setShoots] = useState<ShootData[]>(getStoredShoots);
  const [paginationMeta, setPaginationMeta] = useState<ShootsContextType['paginationMeta']>();
  const { user, logout } = useAuth();
  const location = useLocation();
  const sessionExpiredRef = useRef(false);
  const clientRole = user?.role;
  const clientName = user?.name;
  const clientCompany = user?.company;
  const clientEmail = user?.email;

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
      sessionExpiredRef.current = true;
      toast({
        title: 'Session expired',
        description: description || 'Please sign in again to continue.',
        variant: 'destructive',
      });
      logout();
    },
    [logout],
  );

  const persistShoots = useCallback((items: ShootData[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('shoots', JSON.stringify(items));
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

    try {
      // For admins/superadmins, fetch from both 'scheduled' and 'completed' tabs to get all non-delivered shoots
      // For photographers, fetch from both tabs to see all shoots until delivered
      // For editors, fetch scheduled + completed + delivered to see assigned edits across the pipeline
      // For others, use 'scheduled' tab (default)
      const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
      const isEditor = user?.role === 'editor';
      const isPhotographer = user?.role === 'photographer';
      
      let allShoots: ShootData[] = [];
      
      if (isAdmin || isPhotographer || isEditor) {
        const headers = buildFetchHeaders(token);
        if (isEditor) {
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

          const scheduledJson = await scheduledResponse.json();
          const completedJson = await completedResponse.json();
          const deliveredJson = await deliveredResponse.json();

          const scheduledRecords = Array.isArray(scheduledJson.data) ? scheduledJson.data : [];
          const completedRecords = Array.isArray(completedJson.data) ? completedJson.data : [];
          const deliveredRecords = Array.isArray(deliveredJson.data) ? deliveredJson.data : [];

          const combinedRecords = [...scheduledRecords, ...completedRecords, ...deliveredRecords];
          const uniqueRecords = Array.from(
            new Map(combinedRecords.map((record: any) => [record.id, record])).values()
          );

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

          const scheduledJson = await scheduledResponse.json();
          const completedJson = await completedResponse.json();
          
          const scheduledRecords = Array.isArray(scheduledJson.data) ? scheduledJson.data : [];
          const completedRecords = Array.isArray(completedJson.data) ? completedJson.data : [];
          
          // Combine and deduplicate by ID
          const combinedRecords = [...scheduledRecords, ...completedRecords];
          const uniqueRecords = Array.from(
            new Map(combinedRecords.map((record: any) => [record.id, record])).values()
          );
          
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
        const deliveredPerPage = Math.max(perPage, 100);
        const deliveredSince = format(addDays(new Date(), -30), 'yyyy-MM-dd');
        const [scheduledResponse, completedResponse, deliveredResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/shoots?tab=scheduled&page=${page}&per_page=${perPage}&include_files=${includeFiles ? 'true' : 'false'}`, {
            headers,
            signal,
          }),
          fetch(`${API_BASE_URL}/api/shoots?tab=completed&page=${page}&per_page=${perPage}&include_files=${includeFiles ? 'true' : 'false'}`, {
            headers,
            signal,
          }),
          fetch(`${API_BASE_URL}/api/shoots?tab=delivered&page=1&per_page=${deliveredPerPage}&include_files=${includeFiles ? 'true' : 'false'}&date_from=${deliveredSince}`, {
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

        const scheduledJson = await scheduledResponse.json();
        const completedJson = await completedResponse.json();
        const deliveredJson = await deliveredResponse.json();
        
        const scheduledRecords = Array.isArray(scheduledJson.data) ? scheduledJson.data : [];
        const completedRecords = Array.isArray(completedJson.data) ? completedJson.data : [];
        const deliveredRecords = Array.isArray(deliveredJson.data) ? deliveredJson.data : [];
        
        // Combine and deduplicate by ID
        const combinedRecords = [...scheduledRecords, ...completedRecords, ...deliveredRecords];
        const uniqueRecords = Array.from(
          new Map(combinedRecords.map((record: any) => [record.id, record])).values()
        );
        
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

        const json = await response.json();
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
    }
  }, [handleSessionExpired, persistShoots, user?.role]);

  const refreshShoots = useCallback(async (): Promise<void> => {
    const isDashboardRoute = location.pathname === '/dashboard';
    const isAccountsRoute = location.pathname.startsWith('/accounts');
    const shouldUseLightweight = (isDashboardRoute || isAccountsRoute) && user?.role !== 'client';
    if (shouldUseLightweight) {
      await fetchShoots(undefined, 1, 25, { includeFiles: false });
      return;
    }
    await fetchShoots();
  }, [fetchShoots, location.pathname, user?.role]);

  // Optimize: Only fetch shoots when necessary
  useEffect(() => {
    const controller = new AbortController();
    const isDashboardRoute = location.pathname === '/dashboard';
    const isAccountsRoute = location.pathname.startsWith('/accounts');
    const shouldUseLightweight = (isDashboardRoute || isAccountsRoute) && user?.role !== 'client';

    if (shouldUseLightweight) {
      fetchShoots(controller.signal, 1, 25, { includeFiles: false }).catch(() => undefined);
    } else {
      fetchShoots(controller.signal).catch(() => undefined);
    }

    return () => controller.abort();
  }, [fetchShoots, location.pathname, user?.role]);

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
              merged.client = updates.client; // Replace entire client object
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

  const createNewShoot = (shootData: Partial<ShootData>) => {
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
  };

  const seedUpcomingShoots = (count: number) => {
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
  };

  const contextValue: ShootsContextType = {
    shoots,
    addShoot,
    updateShoot,
    deleteShoot,
    getClientShootsByStatus,
    getUniquePhotographers,
    getUniqueEditors,
    getUniqueClients,
    fetchShoots,
    paginationMeta,
  };

  return <ShootsContext.Provider value={contextValue}>{children}</ShootsContext.Provider>;
};

