import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { transformShootFromApi, type ApiShoot } from '@/context/shootNormalization';
import { API_BASE_URL } from '@/config/env';
import { blurActiveElement } from '../dialogFocusUtils';
import type { ShootData } from '@/types/shoots';
import type { useToast } from '@/hooks/use-toast';
import {
  ShootServiceMutationError,
  submitShootServiceMutation,
  type ServiceDetachConfirmation,
} from '@/utils/shootServiceMutation';

interface UseShootDetailsModalSaveParams {
  shoot: ShootData | null;
  setShoot: Dispatch<SetStateAction<ShootData | null>>;
  setIsEditMode: Dispatch<SetStateAction<boolean>>;
  refreshShoot: () => Promise<ShootData | null>;
  updateShoot: (shootId: string, updates: Partial<ShootData>, options?: { skipApi?: boolean }) => Promise<void>;
  onShootUpdate?: () => void;
  toast: ReturnType<typeof useToast>['toast'];
  canNotifyClient: boolean;
  canNotifyPhotographer: boolean;
}

type ShootSaveUpdates = Omit<Partial<ShootData>, 'photographer' | 'services'> & {
  photographer?: ShootData['photographer'] | null;
  services?: unknown[];
  service_items?: unknown[];
  service_photographers?: unknown[];
  complimentary_service_options?: Record<string, unknown>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const hasOwn = (value: unknown, key: PropertyKey): boolean =>
  value !== null && value !== undefined && Object.prototype.hasOwnProperty.call(value, key);

const normalizeNullableString = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNullableInteger = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
};

const toNullableNumber = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function useShootDetailsModalSave({
  shoot,
  setShoot,
  setIsEditMode,
  refreshShoot,
  updateShoot,
  onShootUpdate,
  toast,
  canNotifyClient,
  canNotifyPhotographer,
}: UseShootDetailsModalSaveParams) {
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const saveChangesInFlight = useRef(false);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Partial<ShootData> | null>(null);
  const [serviceDetachConfirmation, setServiceDetachConfirmation] = useState<ServiceDetachConfirmation | null>(null);
  const [notifyClientOnSave, setNotifyClientOnSave] = useState(true);
  const [notifyPhotographerOnSave, setNotifyPhotographerOnSave] = useState(true);
  const to24Hour = (timeString?: string | null) => {
    if (!timeString) return undefined;
    const match = timeString.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return timeString; // return as-is if already in desired format
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const seconds = match[3] ?? '00';
    const period = match[4]?.toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
  };

  // Handle save changes
  const handleSaveChanges = async (
    updates: ShootSaveUpdates,
    notifyOptions?: { notifyClient?: boolean; notifyPhotographer?: boolean },
    confirmationToken?: string | null,
  ) => {
    if (!shoot) {
      console.error('💾 Cannot save: shoot is null');
      return;
    }
    
    if (!shoot.id) {
      console.error('💾 Cannot save: shoot.id is missing');
      toast({
        title: 'Error',
        description: 'Cannot save: Shoot ID is missing',
        variant: 'destructive',
      });
      return;
    }

    if (saveChangesInFlight.current) {
      return;
    }

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
      console.error('💾 Cannot save: No authentication token');
      toast({
        title: 'Error',
        description: 'Authentication required. Please refresh the page.',
        variant: 'destructive',
      });
      return;
    }

    saveChangesInFlight.current = true;
    setIsSavingChanges(true);
    
    let preservePendingUpdates = false;
    try {
      const payload: Record<string, unknown> = {};
      
      // Map updates to API format (support snake_case from API)
      if (hasOwn(updates, 'scheduledDate')) {
        payload.scheduled_date = normalizeNullableString(updates.scheduledDate);
      }
      if (hasOwn(updates, 'time')) {
        const normalizedTime = normalizeNullableString(updates.time);
        payload.time = normalizedTime ? to24Hour(normalizedTime) ?? normalizedTime : normalizedTime;
      }
      if (hasOwn(updates, 'status')) payload.status = updates.status;
      if (hasOwn(updates, 'workflowStatus')) payload.workflow_status = updates.workflowStatus;
      
      // Location fields
      if (updates.location) {
        if (hasOwn(updates.location, 'address')) payload.address = normalizeNullableString(updates.location.address);
        if (hasOwn(updates.location, 'city')) payload.city = normalizeNullableString(updates.location.city);
        if (hasOwn(updates.location, 'state')) payload.state = normalizeNullableString(updates.location.state);
        if (hasOwn(updates.location, 'zip')) payload.zip = normalizeNullableString(updates.location.zip);
      }

      if (notifyOptions?.notifyClient !== undefined) {
        payload.notify_client = notifyOptions.notifyClient;
      }
      if (notifyOptions?.notifyPhotographer !== undefined) {
        payload.notify_photographer = notifyOptions.notifyPhotographer;
      }
      
      // Client and photographer - ensure IDs are numbers and valid
      if (updates.client?.id !== undefined && updates.client.id !== null) {
        const clientId = typeof updates.client.id === 'string' 
          ? parseInt(updates.client.id, 10) 
          : Number(updates.client.id);
        // Only send if it's a valid number
        if (!isNaN(clientId) && clientId > 0) {
          const currentClientId = shoot.client?.id 
            ? (typeof shoot.client.id === 'string' ? parseInt(String(shoot.client.id), 10) : Number(shoot.client.id))
            : null;
          // Always send if explicitly set, even if same (allows clearing/resetting)
          console.log('💾 Client ID update:', { new: clientId, current: currentClientId, shootClient: shoot.client });
          payload.client_id = clientId;
        } else {
          console.warn('💾 Invalid client_id:', updates.client.id);
        }
      }
      // Handle photographer update - check if it's being cleared (null) or updated
      if (updates.photographer === null) {
        // Explicitly clearing photographer
        console.log('💾 Clearing photographer assignment');
        payload.photographer_id = null;
      } else if (updates.photographer?.id !== undefined && updates.photographer.id !== null) {
        const photographerId = typeof updates.photographer.id === 'string' 
          ? parseInt(updates.photographer.id, 10) 
          : Number(updates.photographer.id);
        // Only send if it's a valid number
        if (!isNaN(photographerId) && photographerId > 0) {
          const currentPhotographerId = shoot.photographer?.id 
            ? (typeof shoot.photographer.id === 'string' ? parseInt(String(shoot.photographer.id), 10) : Number(shoot.photographer.id))
            : null;
          // Always send if explicitly set, even if same (allows clearing/resetting)
          console.log('💾 Photographer ID update:', { 
            new: photographerId, 
            current: currentPhotographerId, 
            shootPhotographer: shoot.photographer,
            updatesPhotographer: updates.photographer
          });
          payload.photographer_id = photographerId;
        } else {
          console.warn('💾 Invalid photographer_id:', updates.photographer.id, 'Type:', typeof updates.photographer.id);
        }
      }
      
      // Service-changing prices are canonical on the server. Admins can opt into
      // one explicit final-order override instead of sending conflicting pieces.
      if (hasOwn(updates, 'adminAdjustedTotalQuote')) {
        payload.admin_adjusted_total_quote = toNullableNumber(updates.adminAdjustedTotalQuote);
      }
      
      // Property details (beds, baths, sqft, access info)
      if (hasOwn(updates, 'propertyDetails')) {
        // Ensure numeric fields are properly converted to numbers
        const propertyDetails: Record<string, unknown> = { ...updates.propertyDetails };

        const bedroomsValue = toNullableInteger(propertyDetails.beds ?? propertyDetails.bedrooms);
        const bathroomsValue = toNullableNumber(propertyDetails.baths ?? propertyDetails.bathrooms);
        const sqftValue = toNullableInteger(propertyDetails.sqft ?? propertyDetails.squareFeet);

        if (bedroomsValue !== undefined) {
          payload.bedrooms = bedroomsValue;
          propertyDetails.beds = bedroomsValue;
          propertyDetails.bedrooms = bedroomsValue;
        }

        if (bathroomsValue !== undefined) {
          payload.bathrooms = bathroomsValue;
          propertyDetails.baths = bathroomsValue;
          propertyDetails.bathrooms = bathroomsValue;
        }

        if (sqftValue !== undefined) {
          payload.sqft = sqftValue;
          propertyDetails.sqft = sqftValue;
          propertyDetails.squareFeet = sqftValue;
        }
        
        // Send the full property_details object (excluding the numeric fields we already sent)
        const cleanPropertyDetails: Record<string, unknown> = {};
        Object.keys(propertyDetails).forEach(key => {
          const value = propertyDetails[key];
          // Skip numeric fields we already sent separately.
          if (key !== 'beds' && key !== 'baths' && key !== 'sqft' && 
              key !== 'bedrooms' && key !== 'bathrooms' && key !== 'squareFeet' &&
              value !== undefined) {
            if (typeof value === 'string') {
              cleanPropertyDetails[key] = normalizeNullableString(value);
            } else {
              cleanPropertyDetails[key] = value;
            }
          }
        });
        
        if (payload.bedrooms !== undefined) {
          cleanPropertyDetails.bedrooms = payload.bedrooms;
          cleanPropertyDetails.beds = payload.bedrooms;
        }
        if (payload.bathrooms !== undefined) {
          cleanPropertyDetails.bathrooms = payload.bathrooms;
          cleanPropertyDetails.baths = payload.bathrooms;
        }
        if (payload.sqft !== undefined) {
          cleanPropertyDetails.sqft = payload.sqft;
          cleanPropertyDetails.squareFeet = payload.sqft;
        }
        payload.property_details = cleanPropertyDetails;
        
        console.log('💾 Property details update:', { 
          bedrooms: payload.bedrooms, 
          bathrooms: payload.bathrooms, 
          sqft: payload.sqft,
          property_details: payload.property_details 
        });
      }
      
      // Services - convert to API format
      if (hasOwn(updates, 'services') && Array.isArray(updates.services)) {
        const servicesPayload = updates.services.map((service) => {
          if (typeof service === 'string') {
            // If it's just a string (service name), we can't update it without ID
            // Return null to skip
            return null;
          }
          const serviceRecord = asRecord(service);
          const rawServiceId = serviceRecord.id ?? serviceRecord.service_id;
          if (rawServiceId !== undefined && rawServiceId !== null) {
            // Ensure service ID is a number
            const serviceId = typeof rawServiceId === 'string'
              ? parseInt(rawServiceId, 10)
              : Number(rawServiceId);
            
            if (!isNaN(serviceId) && serviceId > 0) {
              const serviceData: Record<string, unknown> = {
                id: serviceId,
              };

              if (serviceRecord.quantity !== undefined && serviceRecord.quantity !== null) {
                const quantity = Number(serviceRecord.quantity);
                if (Number.isInteger(quantity) && quantity > 0) {
                  serviceData.quantity = quantity;
                }
              }
              
              // Include price if provided
              if (serviceRecord.price !== undefined && serviceRecord.price !== null) {
                const price = typeof serviceRecord.price === 'string'
                  ? parseFloat(serviceRecord.price)
                  : Number(serviceRecord.price);
                if (!isNaN(price) && price >= 0) {
                  serviceData.price = price;
                }
              }
              
              // Include photographer_pay if provided
              if (serviceRecord.photographer_pay !== undefined && serviceRecord.photographer_pay !== null) {
                const photographerPay = typeof serviceRecord.photographer_pay === 'string'
                  ? parseFloat(serviceRecord.photographer_pay)
                  : Number(serviceRecord.photographer_pay);
                if (!isNaN(photographerPay) && photographerPay >= 0) {
                  serviceData.photographer_pay = photographerPay;
                }
              }

              if (serviceRecord.scheduled_at !== undefined) {
                serviceData.scheduled_at = normalizeNullableString(serviceRecord.scheduled_at);
              }
              if (serviceRecord.photographer_id !== undefined) {
                serviceData.photographer_id = toNullableInteger(serviceRecord.photographer_id);
              }
              if (serviceRecord.editor_id !== undefined) {
                serviceData.editor_id = toNullableInteger(serviceRecord.editor_id);
              }
              if (serviceRecord.is_deliverable !== undefined) {
                serviceData.is_deliverable = Boolean(serviceRecord.is_deliverable);
              }
              
              return serviceData;
            }
          }
          return null;
        }).filter(Boolean);

        payload.services = servicesPayload;
        console.log('💾 Services update:', servicesPayload);
      }

      if (hasOwn(updates, 'service_items') && Array.isArray(updates.service_items)) {
        const serviceItemsPayload = updates.service_items.map((value) => {
          if (!value || typeof value !== 'object') return null;
          const serviceItem = asRecord(value);
          const rawServiceId = serviceItem.service_id ?? serviceItem.id;
          const serviceId = typeof rawServiceId === 'string'
            ? parseInt(rawServiceId, 10)
            : Number(rawServiceId);
          if (!Number.isFinite(serviceId) || serviceId <= 0) return null;

          const itemData: Record<string, unknown> = {
            service_id: serviceId,
          };

          if (serviceItem.quantity !== undefined && serviceItem.quantity !== null) {
            const quantity = Number(serviceItem.quantity);
            if (Number.isInteger(quantity) && quantity > 0) {
              itemData.quantity = quantity;
            }
          }

          if (serviceItem.price !== undefined && serviceItem.price !== null) {
            const price = typeof serviceItem.price === 'string'
              ? parseFloat(serviceItem.price)
              : Number(serviceItem.price);
            if (!Number.isNaN(price) && price >= 0) {
              itemData.price = price;
            }
          }
          if (serviceItem.photographer_pay !== undefined && serviceItem.photographer_pay !== null) {
            const photographerPay = typeof serviceItem.photographer_pay === 'string'
              ? parseFloat(serviceItem.photographer_pay)
              : Number(serviceItem.photographer_pay);
            if (!Number.isNaN(photographerPay) && photographerPay >= 0) {
              itemData.photographer_pay = photographerPay;
            }
          }
          if (serviceItem.scheduled_at !== undefined) {
            itemData.scheduled_at = normalizeNullableString(serviceItem.scheduled_at);
          }
          if (serviceItem.photographer_id !== undefined) {
            itemData.photographer_id = toNullableInteger(serviceItem.photographer_id);
          }
          if (serviceItem.editor_id !== undefined) {
            itemData.editor_id = toNullableInteger(serviceItem.editor_id);
          }
          if (serviceItem.is_deliverable !== undefined) {
            itemData.is_deliverable = Boolean(serviceItem.is_deliverable);
          }
          if (serviceItem.workflow_status !== undefined) {
            itemData.workflow_status = normalizeNullableString(serviceItem.workflow_status);
          }
          if (serviceItem.delivery_status !== undefined) {
            itemData.delivery_status = normalizeNullableString(serviceItem.delivery_status);
          }
          if (serviceItem.force_unlock_delivery !== undefined) {
            itemData.force_unlock_delivery = Boolean(serviceItem.force_unlock_delivery);
          }
          if (serviceItem.unlock_reason !== undefined) {
            itemData.unlock_reason = normalizeNullableString(serviceItem.unlock_reason);
          }

          return itemData;
        }).filter(Boolean);

        payload.service_items = serviceItemsPayload;
        console.log('💾 Service items update:', serviceItemsPayload);
      }

      // Per-service photographer assignments
      if (hasOwn(updates, 'service_photographers') && Array.isArray(updates.service_photographers)) {
        payload.service_photographers = updates.service_photographers;
        console.log('💾 Service photographers update:', payload.service_photographers);
      }

      // A comp return visit is created atomically by the shoot PATCH endpoint.
      // Keep this object separate from ordinary `services` so selecting the same
      // source service again never replaces or reprices its original line.
      if (hasOwn(updates, 'complimentary_service_options')) {
        const complimentaryOptions = asRecord(updates.complimentary_service_options);
        if (Object.keys(complimentaryOptions).length > 0) {
          payload.complimentary_service_options = complimentaryOptions;
        }
      }
      
      // Don't send empty payloads
      if (Object.keys(payload).length === 0) {
        console.log('💾 No changes to save');
        toast({
          title: 'Info',
          description: 'No changes to save',
        });
        setIsEditMode(false);
        return;
      }
      
      console.log('💾 Saving shoot updates:', payload);
      console.log('💾 API URL:', `${API_BASE_URL}/api/shoots/${shoot.id}`);
      console.log('💾 API_BASE_URL:', API_BASE_URL);
      console.log('💾 Shoot ID:', shoot.id);
      console.log('💾 Token present:', !!token);
      console.log('💾 Token length:', token ? token.length : 0);
      
      let responseData: Record<string, unknown>;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        try {
          const result = await submitShootServiceMutation({
            url: `${API_BASE_URL}/api/shoots/${shoot.id}`,
            token,
            payload,
            confirmationToken,
            signal: controller.signal,
          });

          if (result.kind === 'confirmation_required') {
            preservePendingUpdates = true;
            setPendingUpdates(updates as Partial<ShootData>);
            setServiceDetachConfirmation(result.confirmation);
            blurActiveElement();
            setIsSaveConfirmOpen(true);
            return;
          }

          responseData = asRecord(result.data);
          setServiceDetachConfirmation(null);
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (fetchError) {
        console.error('💾 Network error during fetch:', fetchError);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Refresh the shoot to confirm whether the change was saved.');
        }
        throw fetchError;
      }
      
      console.log('💾 Save success response:', responseData);
      
      // Get updated shoot data from response or refresh
      const rawUpdatedShoot = asRecord(responseData.data ?? responseData);
      let updatedShootData: ShootData | null = Object.keys(rawUpdatedShoot).length > 0
        ? rawUpdatedShoot as unknown as ShootData
        : null;

      const shouldTransform = updatedShootData && (
        'scheduled_date' in rawUpdatedShoot ||
        'workflow_status' in rawUpdatedShoot ||
        'base_quote' in rawUpdatedShoot ||
        'services_list' in rawUpdatedShoot
      );

      if (updatedShootData && shouldTransform) {
        try {
          updatedShootData = transformShootFromApi(rawUpdatedShoot as ApiShoot);
        } catch (error) {
          console.warn('💾 Failed to normalize shoot response, using raw data:', error);
        }
      }

      // If response doesn't have valid data, refresh from API using React Query
      if (!updatedShootData || Object.keys(updatedShootData).length === 0 || !updatedShootData.id) {
        console.log('💾 Response missing data, refreshing from API...');
        updatedShootData = await refreshShoot();
      } else {
        // Normalize location if needed (raw responses may omit location wrapper)
        const updatedShootRecord = asRecord(updatedShootData);
        if (!updatedShootData.location && (updatedShootRecord.address || updatedShootRecord.city)) {
          updatedShootData.location = {
            address: optionalString(updatedShootRecord.address) || '',
            city: optionalString(updatedShootRecord.city) || '',
            state: optionalString(updatedShootRecord.state) || '',
            zip: optionalString(updatedShootRecord.zip) || '',
            fullAddress: optionalString(updatedShootRecord.fullAddress)
              || optionalString(updatedShootRecord.address)
              || '',
          };
        }
        // Update local state
        setShoot(updatedShootData);
      }
      
      // Refresh in the background so follow-up reads stay aligned with the server.
      refreshShoot().catch((err) => {
        console.log('💾 Background refetch error (non-critical):', err);
      });
      
      // Update shoot in context to refresh dashboard cards (SYNCHRONOUS - happens immediately)
      // We only pass the fields that changed to avoid triggering unnecessary API calls
      // The context's updateShoot only makes an API call for status, workflowStatus, scheduledDate, or time
      if (updatedShootData && updatedShootData.id) {
        const shootIdStr = String(updatedShootData.id);
        console.log('💾 Updating shoot in context for dashboard refresh:', shootIdStr);
        
        // Pass the entire updated shoot data to context
        // The context's updateShoot updates local state IMMEDIATELY and SYNCHRONOUSLY
        // It may make an API call for status/time fields, but that happens async and errors are suppressed
        // The important part is the synchronous state update, which triggers dashboard re-render
        const contextUpdates: Partial<ShootData> = updatedShootData;
        
        // Update context - this updates local state IMMEDIATELY and SYNCHRONOUSLY
        // The setShoots call in the context happens first, before any async API call
        // This means the dashboard will update right away via React re-render
        updateShoot(shootIdStr, contextUpdates, { skipApi: true }).catch((contextError) => {
          // Silently ignore errors from context's API call - local state is already updated
          console.log('💾 Context updateShoot API call had an error (ignored, state already updated):', contextError);
        });
      } else {
        console.warn('💾 No updated shoot data to update context');
      }
      
      toast({
        title: 'Success',
        description: 'Shoot updated successfully',
      });
      
      setIsEditMode(false);
      
      // Call onShootUpdate callback to refresh parent components (like dashboard)
      // This runs in the background - the context is already updated, so dashboard shows changes immediately
      if (onShootUpdate) {
        console.log('💾 Calling onShootUpdate callback (background, non-blocking)');
        // Use setTimeout to ensure this runs after the current execution context
        // This prevents any errors from blocking the success flow
        setTimeout(() => {
          try {
            onShootUpdate();
          } catch (error) {
            // Silently handle errors - context is already updated, so dashboard already shows changes
            console.log('💾 onShootUpdate callback had an error (non-critical, background sync):', error);
          }
        }, 0);
      }
    } catch (error) {
      console.error('💾 Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update shoot';
      
      // Provide more helpful error messages
      let userMessage = errorMessage;
      if (error instanceof ShootServiceMutationError && (error.status === 401 || error.status === 403)) {
        userMessage = 'You do not have permission to update this shoot.';
      } else if (error instanceof ShootServiceMutationError && error.status === 404) {
        userMessage = 'Shoot not found - it may have been deleted.';
      } else if (error instanceof ShootServiceMutationError && error.status === 422) {
        userMessage = errorMessage;
      } else if (error instanceof ShootServiceMutationError && error.status >= 500) {
        userMessage = 'Server error - please try again later.';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        userMessage = 'Network error - please check your connection and try again. If the problem persists, the changes may have been saved. Please refresh the page to verify.';
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        userMessage = 'Authentication error - please refresh the page and try again.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        userMessage = 'You do not have permission to update this shoot.';
      } else if (errorMessage.includes('404')) {
        userMessage = 'Shoot not found - it may have been deleted.';
      } else if (errorMessage.includes('422') || errorMessage.includes('validation')) {
        userMessage = `Validation error: ${errorMessage}`;
      }
      
      toast({
        title: 'Error',
        description: userMessage,
        variant: 'destructive',
      });
    } finally {
      saveChangesInFlight.current = false;
      setIsSavingChanges(false);
      if (!preservePendingUpdates) {
        setPendingUpdates(null);
      }
    }
  };

  const handleSaveRequest = (updates: Partial<ShootData>) => {
    if (!shoot || isSavingChanges || isSaveConfirmOpen) return;

    setPendingUpdates(updates);
    setServiceDetachConfirmation(null);
    setNotifyClientOnSave(canNotifyClient);
    setNotifyPhotographerOnSave(canNotifyPhotographer);
    blurActiveElement();
    setIsSaveConfirmOpen(true);
  };

  const handleConfirmSave = () => {
    if (!pendingUpdates) {
      setIsSaveConfirmOpen(false);
      return;
    }

    setIsSaveConfirmOpen(false);
    handleSaveChanges(pendingUpdates, {
      notifyClient: notifyClientOnSave,
      notifyPhotographer: notifyPhotographerOnSave,
    }, serviceDetachConfirmation?.token);
  };

  return {
    isSavingChanges,
    isSaveConfirmOpen,
    pendingUpdates,
    serviceDetachConfirmation,
    notifyClientOnSave,
    notifyPhotographerOnSave,
    setIsSaveConfirmOpen,
    setPendingUpdates,
    setServiceDetachConfirmation,
    setNotifyClientOnSave,
    setNotifyPhotographerOnSave,
    handleSaveChanges,
    handleSaveRequest,
    handleConfirmSave,
  };
}
