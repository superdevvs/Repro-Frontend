import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { ShootData } from '@/types/shoots';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from 'date-fns';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from '@/components/ui/use-toast';
import { API_BASE_URL } from '@/config/env';
import { shootsData as mockShootsData } from '@/data/shootsData';

interface ShootsContextType {
  shoots: ShootData[];
  addShoot: (shoot: ShootData) => void;
  updateShoot: (shootId: string, updates: Partial<ShootData>) => Promise<void>;
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
  fetchShoots: (signal?: AbortSignal) => Promise<ShootData[]>;
}

const ShootsContext = createContext<ShootsContextType | undefined>(undefined);

const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken') || localStorage.getItem('token');
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
  services?: string[];
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
  media?: ShootData['media'];
  tour_links?: ShootData['tourLinks'];
  files?: ShootData['files'];
  tour_purchased?: unknown;
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
  if (typeof window === 'undefined') return applyFallbackMedia(mockShootsData);
  const storedShoots = localStorage.getItem('shoots');
  const parsed = storedShoots ? JSON.parse(storedShoots) : mockShootsData;
  return applyFallbackMedia(parsed);
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

const transformShootFromApi = (shoot: ApiShoot): ShootData => {
  const client = (shoot.client ?? {}) as NonNullable<ApiShoot['client']>;
  const photographer = (shoot.photographer ?? {}) as NonNullable<ApiShoot['photographer']>;
  const service = (shoot.service ?? {}) as NonNullable<ApiShoot['service']>;
  const address = shoot?.address || '';
  const city = shoot?.city || '';
  const state = shoot?.state || '';
  const zip = shoot?.zip || '';
  const payments: ApiShootPayment[] = Array.isArray(shoot?.payments) ? shoot.payments : [];
  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
  const notes = normalizeNotes(shoot);

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
    editor: shoot.editor
      ? {
          id: shoot.editor.id ? String(shoot.editor.id) : undefined,
          name: shoot.editor.name ?? '',
          avatar: shoot.editor.avatar ?? undefined,
        }
      : undefined,
    services: service.name
      ? [service.name]
      : Array.isArray(shoot.services)
        ? shoot.services
        : [],
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
    completedDate: shoot.completed_date ?? undefined,
    media: shoot.media || undefined,
    tourLinks: shoot.tour_links || undefined,
    files: shoot.files || undefined,
    tourPurchased: shoot.tour_purchased ? Boolean(shoot.tour_purchased) : undefined,
    propertyDetails: (shoot as any).property_details || undefined,
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
  const { user, logout } = useAuth();
  const sessionExpiredRef = useRef(false);
  const clientRole = user?.role;
  const clientName = user?.name;
  const clientCompany = user?.company;
  const clientEmail = user?.email;

  useEffect(() => {
    sessionExpiredRef.current = false;
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

  const fetchShoots = useCallback(async (signal?: AbortSignal): Promise<ShootData[]> => {
    const token = getAuthToken();
    if (!token) {
      handleSessionExpired('Please log in to view the latest shoots.');
      setShoots([]);
      persistShoots([]);
      return [];
    }

    try {
      // For editors, request 'completed' tab to see editing/review shoots
      const tabParam = user?.role === 'editor' ? '?tab=completed' : '';
      const response = await fetch(`${API_BASE_URL}/api/shoots${tabParam}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (response.status === 401 || response.status === 419) {
        handleSessionExpired();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error('Failed to load shoots from server');
      }

      const json = await response.json();
      const records = Array.isArray(json.data) ? json.data : [];
      const mapped = applyFallbackMedia(records.map(transformShootFromApi));
      setShoots(mapped);
      persistShoots(mapped);
      return mapped;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return [];
      }
      console.error('Error fetching shoots:', error);
      if ((error as Error)?.message === 'Unauthorized') {
        return [];
      }
      
      let errorMessage = 'An unexpected error occurred while loading shoots.';
      if (error instanceof Error) {
        if (error.message === 'Failed to load shoots from server') {
          errorMessage = 'Unable to connect to the server. Please check your connection and ensure the backend is running.';
        } else if (error.message.includes('Network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: 'Unable to load shoots',
        description: errorMessage,
        variant: 'destructive',
      });
      const fallback = getStoredShoots();
      setShoots(fallback);
      return fallback;
    }
  }, [persistShoots, handleSessionExpired]);

  useEffect(() => {
    const controller = new AbortController();
    fetchShoots(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [fetchShoots]);

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
    async (shootId: string, updates: Partial<ShootData>) => {
      setShoots(prevShoots => {
        const updatedShoots = prevShoots.map(shoot =>
          shoot.id === shootId ? { ...shoot, ...updates } : shoot,
        );
        persistShoots(updatedShoots);
        return updatedShoots;
      });

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
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 401 || response.status === 419) {
          handleSessionExpired();
          return;
        }

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err?.message || 'Failed to update shoot');
        }
      } catch (error) {
        console.error('Error updating shoot:', error);
        toast({
          title: 'Shoot update failed',
          description:
            error instanceof Error ? error.message : 'An unexpected error occurred while updating the shoot.',
          variant: 'destructive',
        });
      }
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
          const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
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
  };

  return <ShootsContext.Provider value={contextValue}>{children}</ShootsContext.Provider>;
};

