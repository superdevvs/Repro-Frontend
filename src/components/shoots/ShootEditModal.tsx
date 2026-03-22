import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CalendarIcon, 
  Edit, 
  Loader2, 
  MapPin, 
  User, 
  Clock, 
  Layers,
  Save,
  FileText,
  Camera,
  Home,
  Search,
  Bath,
  BedDouble,
  Ruler
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import API_ROUTES from '@/lib/api';
import AddressLookupField from '@/components/AddressLookupField';
import { getShootPhotographerAssignmentGroups } from '@/utils/shootPhotographerAssignments';
import axios from 'axios';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SqftRange {
  id?: number;
  sqft_from: number;
  sqft_to: number;
  price: number;
  photographer_pay?: number | null;
}

interface Service {
  id: number | string;
  name: string;
  price?: number;
  pricing_type?: 'fixed' | 'variable';
  sqft_ranges?: SqftRange[];
  category?: { id: number | string; name: string } | string;
}

interface Photographer {
  id: string | number;
  name: string;
  avatar?: string;
  email?: string;
  city?: string;
  state?: string;
  address?: string;
  zip?: string;
}

interface PropertyDetails {
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  yearBuilt?: number;
  lotSize?: number;
}

interface ShootDetails {
  id: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  client?: { id: number; name: string; email?: string };
  services?: Service[];
  serviceObjects?: Service[];
  scheduledAt?: string;
  scheduled_at?: string;
  totalQuote?: number;
  shoot_notes?: string;
  shootNotes?: string;
  location?: { address?: string; city?: string; state?: string; zip?: string };
  payment?: { totalQuote?: number };
  photographer_id?: number | string;
  photographer?: { id: number; name: string; email?: string };
  sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  property_details?: PropertyDetails;
}

interface ShootEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  shootId: string | number;
  onSaved?: () => void;
}

type PhotographerPickerContext = {
  categoryKey?: string;
  categoryName?: string;
} | null;

const normalizeCategoryKey = (value?: string) =>
  (value || 'other').trim().toLowerCase().replace(/s$/, '') || 'other';

const mapPhotographerOption = (photographer: any): Photographer => ({
  id: photographer.id?.toString() || '',
  name: photographer.name || 'Unknown',
  avatar: photographer.avatar || photographer.profile_image || photographer.profile_photo_url,
  email: photographer.email || '',
  address: photographer.address || photographer.metadata?.address || photographer.metadata?.homeAddress,
  city: photographer.city || photographer.metadata?.city,
  state: photographer.state || photographer.metadata?.state,
  zip: photographer.zip || photographer.zipcode || photographer.metadata?.zip || photographer.metadata?.zipcode,
});

const loadPhotographerOptions = async (): Promise<Photographer[]> => {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await axios.get(API_ROUTES.people.adminPhotographers, { headers });
    const data = response.data?.data || response.data || [];
    const formatted = Array.isArray(data) ? data.map(mapPhotographerOption) : [];
    if (formatted.length > 0) {
      return formatted;
    }
  } catch (error) {
    console.warn('[ShootEditModal] Admin photographers endpoint failed, falling back to public list:', error);
  }

  try {
    const response = await axios.get(API_ROUTES.people.photographers);
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data.map(mapPhotographerOption) : [];
  } catch (error) {
    console.error('[ShootEditModal] Public photographers endpoint failed:', error);
    return [];
  }
};

const resolveSelectedServiceIds = (serviceSource: any[], servicesCatalog: Service[]) => {
  const ids = new Set<string>();

  serviceSource.forEach((service) => {
    const rawId = service && typeof service === 'object'
      ? service.id || service.service_id
      : undefined;
    const normalizedId = rawId != null ? String(rawId) : '';
    if (normalizedId && servicesCatalog.some((catalogService) => String(catalogService.id) === normalizedId)) {
      ids.add(normalizedId);
      return;
    }

    const rawName = typeof service === 'string'
      ? service
      : service?.name || service?.label;
    const normalizedName = String(rawName || '').trim().toLowerCase();
    if (!normalizedName) return;

    const matchedService = servicesCatalog.find((catalogService) =>
      String(catalogService.name || '').trim().toLowerCase() === normalizedName,
    );
    if (matchedService?.id != null) {
      ids.add(String(matchedService.id));
    }
  });

  return ids;
};

export function ShootEditModal({
  isOpen,
  onClose,
  shootId,
  onSaved,
}: ShootEditModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shootDetails, setShootDetails] = useState<ShootDetails | null>(null);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [photographerPickerOpen, setPhotographerPickerOpen] = useState(false);
  const [photographerPickerContext, setPhotographerPickerContext] = useState<PhotographerPickerContext>(null);
  const [pickerPhotographerId, setPickerPhotographerId] = useState('');
  const [photographerSearchQuery, setPhotographerSearchQuery] = useState('');
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Record<string, any> | null>(null);
  const [notifyClientOnSave, setNotifyClientOnSave] = useState(true);
  const [notifyPhotographerOnSave, setNotifyPhotographerOnSave] = useState(true);
  
  // Role checks
  const userRole = user?.role?.toLowerCase() || '';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isRep = userRole === 'rep' || userRole === 'salesrep';
  const isClient = userRole === 'client';
  const isAdminOrRep = isAdmin || isRep;
  
  // Editable fields
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>('10:00');
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [photographerId, setPhotographerId] = useState<string>('');
  const [perCategoryPhotographers, setPerCategoryPhotographers] = useState<Record<string, string>>({});
  
  // Notes fields (role-based visibility)
  const [shootNotes, setShootNotes] = useState(''); // All: client, admin, rep
  const [companyNotes, setCompanyNotes] = useState(''); // Admin only
  const [photographerNotes, setPhotographerNotes] = useState(''); // Admin and rep
  const [editorNotes, setEditorNotes] = useState(''); // Admin and rep
  const showInternalNotes = isAdminOrRep;
  const [companyNotesOpen, setCompanyNotesOpen] = useState(false);
  const [photographerNotesOpen, setPhotographerNotesOpen] = useState(false);
  const [editorNotesOpen, setEditorNotesOpen] = useState(false);
  
  // Property details
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);
  const [propertySqft, setPropertySqft] = useState<number | null>(null);
  const [isLookingUpProperty, setIsLookingUpProperty] = useState(false);
  const [taxPercent, setTaxPercent] = useState<number>(0);

  // Fetch shoot details, services, and photographers when modal opens
  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen || !shootId) return;
      
      setIsLoading(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        // Fetch shoot details, services, and photographers in parallel
        const [shootResponse, servicesResponse, photographersData] = await Promise.all([
          fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_BASE_URL}/api/services`),
          loadPhotographerOptions(),
        ]);
        
        // Process services with sqft_ranges
        const servicesData = servicesResponse.data?.data || [];
        const mappedServices = servicesData.map((s: any) => ({
          id: s.id?.toString() || s.id,
          name: s.name,
          price: Number(s.price || 0),
          pricing_type: s.pricing_type || 'fixed',
          category: s.category ? { id: s.category.id, name: s.category.name } : undefined,
          sqft_ranges: (s.sqft_ranges || s.sqftRanges || []).map((r: any) => ({
            ...r,
            sqft_from: Number(r.sqft_from) || 0,
            sqft_to: Number(r.sqft_to) || 0,
            price: Number(r.price) || 0,
            photographer_pay: r.photographer_pay != null ? Number(r.photographer_pay) : null,
          })),
        }));
        setAvailableServices(mappedServices);
        
        // Process photographers
        setPhotographers(photographersData);
        
        // Process shoot details
        if (shootResponse.ok) {
          const data = await shootResponse.json();
          const shoot = data.data || data;
          setShootDetails(shoot);
          
          // Initialize editable fields
          setAddress(shoot.address || shoot.location?.address || '');
          setCity(shoot.city || shoot.location?.city || '');
          setState(shoot.state || shoot.location?.state || '');
          setZip(shoot.zip || shoot.location?.zip || '');
          
          // Set all notes fields
          setShootNotes(shoot.shoot_notes || shoot.shootNotes || '');
          setCompanyNotes(shoot.company_notes || shoot.companyNotes || '');
          setPhotographerNotes(shoot.photographer_notes || shoot.photographerNotes || '');
          setEditorNotes(shoot.editor_notes || shoot.editorNotes || '');
          
          // Set photographer
          const photoId = shoot.photographer_id || shoot.photographer?.id;
          setPhotographerId(photoId ? photoId.toString() : '');
          
          // Set property details
          const sqft =
            shoot.sqft ||
            shoot.squareFeet ||
            shoot.square_feet ||
            shoot.property_details?.sqft ||
            shoot.property_details?.squareFeet ||
            shoot.property_details?.square_feet ||
            shoot.property_details?.livingArea ||
            shoot.property_details?.living_area ||
            null;
          setPropertySqft(sqft ? Number(sqft) : null);
          setPropertyDetails({
            bedrooms: shoot.bedrooms || shoot.property_details?.bedrooms,
            bathrooms: shoot.bathrooms || shoot.property_details?.bathrooms,
            sqft: sqft ? Number(sqft) : undefined,
          });
          
          // Set date/time
          const dateStr = shoot.scheduled_date || shoot.scheduledDate;
          if (dateStr) {
            // Extract just the date portion (YYYY-MM-DD) in case it includes time
            const dateOnly = dateStr.split(/[T\s]/)[0];
            const date = new Date(`${dateOnly}T12:00:00`);
            if (!isNaN(date.getTime())) {
              setScheduledDate(date);
            }
          } else {
            const scheduledAt = shoot.start_time || shoot.scheduled_at || shoot.scheduledAt;
            if (scheduledAt) {
              const date = new Date(scheduledAt);
              if (!isNaN(date.getTime())) {
                setScheduledDate(date);
              }
            }
          }

          const normalizedTime =
            normalizeTimeValue(
              shoot.time_label ||
                shoot.timeLabel ||
                shoot.time ||
                shoot.scheduled_time ||
                shoot.scheduledTime
            ) || null;

          if (normalizedTime) {
            setScheduledTime(normalizedTime);
            setTimeOptions(buildTimeOptions(normalizedTime));
          }
          
          // Set tax percent
          const rawTaxPercent = shoot.tax_percent ?? shoot.taxPercent ?? shoot.payment?.taxRate ?? 0;
          setTaxPercent(Number(rawTaxPercent) || 0);

          // Set selected services
          const serviceSource = Array.isArray(shoot.serviceObjects) && shoot.serviceObjects.length > 0
            ? shoot.serviceObjects
            : Array.isArray(shoot.services)
            ? shoot.services
            : [];

          if (serviceSource.length > 0) {
            const ids = resolveSelectedServiceIds(serviceSource, mappedServices);
            setSelectedServiceIds(ids);

            // Initialize per-category photographer assignments from shoot services
            const catPhotogMap: Record<string, string> = {};
            const assignmentGroups = getShootPhotographerAssignmentGroups({
              serviceObjects: Array.isArray(shoot.serviceObjects) ? shoot.serviceObjects : undefined,
              services: Array.isArray(shoot.services) ? shoot.services : [],
              photographer: shoot.photographer
                ? {
                    id: shoot.photographer.id,
                    name: shoot.photographer.name,
                    email: shoot.photographer.email,
                  }
                : { name: 'Unassigned' },
            });

            for (const group of assignmentGroups.groups) {
              const photographerId = group.photographer?.id;
              if (photographerId != null && !catPhotogMap[group.key]) {
                catPhotogMap[group.key] = String(photographerId);
              }
            }
            setPerCategoryPhotographers(catPhotogMap);
          }
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        // Only show error if we don't already have shoot details loaded
        if (!shootDetails) {
          toast({
            title: 'Error',
            description: error?.message || 'Failed to load shoot details.',
            variant: 'destructive',
          });
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, shootId]);

  // Handle address selection from AddressLookupField
  const handleAddressSelect = (details: any) => {
    if (details) {
      setAddress(details.address || '');
      setCity(details.city || '');
      setState(details.state || '');
      setZip(details.zip || '');
      
      // Update property details from lookup
      const sqft =
        details.sqft ||
        details.squareFeet ||
        details.square_feet ||
        details.property_details?.sqft ||
        details.property_details?.squareFeet ||
        details.property_details?.square_feet ||
        details.property_details?.livingArea ||
        details.property_details?.living_area;
      if (sqft) {
        setPropertySqft(Number(sqft));
      }
      setPropertyDetails({
        bedrooms: details.bedrooms || details.property_details?.bedrooms || details.property_details?.beds,
        bathrooms: details.bathrooms || details.property_details?.bathrooms || details.property_details?.baths,
        sqft: sqft ? Number(sqft) : undefined,
      });
    }
  };

  // Get service price based on sqft
  const getServicePrice = (service: Service): number => {
    if (service.pricing_type === 'variable' && propertySqft && service.sqft_ranges?.length) {
      const matchingRange = service.sqft_ranges.find(
        range => propertySqft >= range.sqft_from && propertySqft <= range.sqft_to
      );
      if (matchingRange) {
        return Number(matchingRange.price) || 0;
      }
    }
    return Number(service.price) || 0;
  };

  const hasVariablePricingWithoutSqft = React.useMemo(() => {
    if (!selectedServiceIds.size) return false;
    return Array.from(selectedServiceIds).some((id) => {
      const service = availableServices.find((s) => s.id?.toString() === id);
      return Boolean(service?.pricing_type === 'variable' && service.sqft_ranges?.length && !propertySqft);
    });
  }, [selectedServiceIds, availableServices, propertySqft]);

  useEffect(() => {
    if (!shootDetails || selectedServiceIds.size > 0 || availableServices.length === 0) return;
    const serviceSource = Array.isArray(shootDetails.serviceObjects) && shootDetails.serviceObjects.length > 0
      ? shootDetails.serviceObjects
      : Array.isArray(shootDetails.services)
      ? shootDetails.services
      : [];

    if (!serviceSource.length) return;

    const ids = resolveSelectedServiceIds(serviceSource, availableServices);
    if (ids.size > 0) {
      setSelectedServiceIds(ids);
    }
  }, [availableServices, selectedServiceIds.size, shootDetails]);

  const clientName = shootDetails?.client?.name || 'Unknown Client';
  const clientEmail = shootDetails?.client?.email || '';
  const photographerEmail =
    shootDetails?.photographer?.email ||
    photographers.find((photographer) => String(photographer.id) === String(photographerId || shootDetails?.photographer?.id))?.email ||
    '';

  const serviceCategoryGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; serviceIds: string[] }>();

    Array.from(selectedServiceIds).forEach((serviceId) => {
      const service = availableServices.find((item) => String(item.id) === String(serviceId));
      if (!service) return;
      const categoryName =
        typeof service.category === 'string'
          ? service.category
          : service.category?.name || 'Other';
      const key = normalizeCategoryKey(categoryName);
      const existing = groups.get(key);
      if (existing) {
        existing.serviceIds.push(String(serviceId));
      } else {
        groups.set(key, { key, name: categoryName, serviceIds: [String(serviceId)] });
      }
    });

    return Array.from(groups.values());
  }, [availableServices, selectedServiceIds]);

  const hasMultiplePhotographerCategories = serviceCategoryGroups.length > 1;

  const resolvePhotographerDetails = (value?: string | number | null) => {
    if (value === null || value === undefined || value === '') return null;
    const normalizedId = String(value);
    return (
      photographers.find((photographer) => String(photographer.id) === normalizedId) ||
      (shootDetails?.photographer && String(shootDetails.photographer.id) === normalizedId
        ? mapPhotographerOption(shootDetails.photographer)
        : null)
    );
  };

  const filteredPhotographers = useMemo(() => {
    if (!photographerSearchQuery.trim()) return photographers;
    const query = photographerSearchQuery.trim().toLowerCase();
    return photographers.filter((photographer) =>
      photographer.name.toLowerCase().includes(query) ||
      String(photographer.email || '').toLowerCase().includes(query) ||
      String(photographer.city || '').toLowerCase().includes(query) ||
      String(photographer.state || '').toLowerCase().includes(query),
    );
  }, [photographerSearchQuery, photographers]);

  const openPhotographerPicker = (context: PhotographerPickerContext) => {
    const singleCategory = serviceCategoryGroups[0];
    const initialId = context?.categoryKey
      ? perCategoryPhotographers[context.categoryKey] || photographerId || ''
      : singleCategory
      ? perCategoryPhotographers[singleCategory.key] || photographerId || ''
      : photographerId || '';
    setPhotographerPickerContext(context);
    setPickerPhotographerId(initialId && initialId !== 'unassigned' ? initialId : '');
    setPhotographerSearchQuery('');
    setPhotographerPickerOpen(true);
  };

  const closePhotographerPicker = () => {
    setPhotographerPickerOpen(false);
    setPhotographerPickerContext(null);
    setPickerPhotographerId('');
    setPhotographerSearchQuery('');
  };

  const handleConfirmPhotographerPicker = () => {
    if (!pickerPhotographerId) return;

    if (photographerPickerContext?.categoryKey) {
      setPerCategoryPhotographers((prev) => ({
        ...prev,
        [photographerPickerContext.categoryKey as string]: pickerPhotographerId,
      }));
      if (!photographerId || photographerId === 'unassigned') {
        setPhotographerId(pickerPhotographerId);
      }
    } else {
      setPhotographerId(pickerPhotographerId);
      if (serviceCategoryGroups.length === 1) {
        setPerCategoryPhotographers((prev) => ({
          ...prev,
          [serviceCategoryGroups[0].key]: pickerPhotographerId,
        }));
      }
    }

    closePhotographerPicker();
  };

  const handleClearPhotographerPicker = () => {
    if (photographerPickerContext?.categoryKey) {
      const nextAssignments = { ...perCategoryPhotographers };
      delete nextAssignments[photographerPickerContext.categoryKey];
      setPerCategoryPhotographers(nextAssignments);
      if (serviceCategoryGroups.length <= 1) {
        setPhotographerId('');
      }
    } else {
      setPhotographerId('');
      if (serviceCategoryGroups.length === 1) {
        const nextAssignments = { ...perCategoryPhotographers };
        delete nextAssignments[serviceCategoryGroups[0].key];
        setPerCategoryPhotographers(nextAssignments);
      }
    }
    closePhotographerPicker();
  };

  const buildSavePayload = () => {
    if (!address.trim()) {
      toast({
        title: 'Address required',
        description: 'Please enter a property address.',
        variant: 'destructive',
      });
      return null;
    }

    if (!scheduledDate) {
      toast({
        title: 'Date required',
        description: 'Please select a scheduled date.',
        variant: 'destructive',
      });
      return null;
    }

    if (selectedServiceIds.size === 0) {
      toast({
        title: 'Services required',
        description: 'Please select at least one service.',
        variant: 'destructive',
      });
      return null;
    }
    // Combine date and time
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const scheduledAt = new Date(scheduledDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    // Calculate totals for the payload
    const servicesTotal = Array.from(selectedServiceIds).reduce((sum, id) => {
      const service = availableServices.find(s => s.id?.toString() === id);
      return sum + (service ? getServicePrice(service) : 0);
    }, 0);
    const normalizedTaxRate = taxPercent > 1 ? taxPercent / 100 : taxPercent;
    const calculatedTax = Number((servicesTotal * normalizedTaxRate).toFixed(2));

    const payload: Record<string, any> = {
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      scheduled_at: scheduledAt.toISOString(),
      shoot_notes: shootNotes.trim(),
      services: Array.from(selectedServiceIds).map(id => {
        const service = availableServices.find(s => s.id?.toString() === id);
        return { 
          id: Number(id), 
          quantity: 1,
          price: service ? getServicePrice(service) : undefined
        };
      }),
      base_quote: Number(servicesTotal.toFixed(2)),
      tax_amount: calculatedTax,
      total_quote: Number((servicesTotal + calculatedTax).toFixed(2)),
    };

    // Add photographer if selected (admin/rep only)
    if (isAdminOrRep && photographerId && photographerId !== 'unassigned') {
      payload.photographer_id = Number(photographerId);
    }

    // Add per-service photographer assignments
    const normCatKey = (name: string) => name.trim().toLowerCase().replace(/s$/, '');
    if (Object.keys(perCategoryPhotographers).length > 0) {
      const servicePhotographerAssignments: Array<{ service_id: number; photographer_id: number }> = [];
      for (const svcId of selectedServiceIds) {
        const service = availableServices.find(s => s.id?.toString() === svcId);
        if (!service) continue;
        const catName = typeof service.category === 'string' ? service.category : service.category?.name || 'Other';
        const catKey = normCatKey(catName);
        const photogId = perCategoryPhotographers[catKey];
        if (photogId && photogId !== 'unassigned') {
          servicePhotographerAssignments.push({
            service_id: Number(svcId),
            photographer_id: Number(photogId),
          });
        }
      }
      if (servicePhotographerAssignments.length > 0) {
        payload.service_photographers = servicePhotographerAssignments;
      }
    }

    // Add role-based notes
    if (showInternalNotes) {
      if (companyNotes.trim()) payload.company_notes = companyNotes.trim();
      if (photographerNotes.trim()) payload.photographer_notes = photographerNotes.trim();
      if (editorNotes.trim()) payload.editor_notes = editorNotes.trim();
    }

    // Add property details
    if (propertySqft) {
      payload.sqft = propertySqft;
    }
    if (propertyDetails?.bedrooms) {
      payload.bedrooms = propertyDetails.bedrooms;
    }
    if (propertyDetails?.bathrooms) {
      payload.bathrooms = propertyDetails.bathrooms;
    }

    return payload;
  };

  const canNotifyClient = Boolean(clientEmail);
  const canNotifyPhotographer = Boolean(
    photographerEmail && (!shootDetails?.client?.id || shootDetails?.photographer?.id !== shootDetails?.client?.id)
  );

  const handleSaveRequest = () => {
    if (isSubmitting || isLoading || isSaveConfirmOpen) return;
    const payload = buildSavePayload();
    if (!payload) return;

    setPendingPayload(payload);
    setNotifyClientOnSave(canNotifyClient);
    setNotifyPhotographerOnSave(canNotifyPhotographer);
    setIsSaveConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!pendingPayload) {
      setIsSaveConfirmOpen(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const payload = {
        ...pendingPayload,
        notify_client: notifyClientOnSave,
        notify_photographer: notifyPhotographerOnSave,
      };

      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update shoot');
      }

      toast({
        title: 'Shoot updated',
        description: 'The shoot request has been updated successfully.',
      });

      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Error updating shoot:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update shoot. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setIsSaveConfirmOpen(false);
      setPendingPayload(null);
    }
  };

  const toggleService = (serviceId: string) => {
    const newSet = new Set(selectedServiceIds);
    if (newSet.has(serviceId)) {
      newSet.delete(serviceId);
    } else {
      newSet.add(serviceId);
    }
    setSelectedServiceIds(newSet);
  };

  const normalizeTimeValue = (raw?: string | null): string | null => {
    if (!raw) return null;
    const value = raw.trim();
    if (!value) return null;

    const ampmMatch = value.match(/^(\d{1,2}):(\d{2})\s*([APap][Mm])$/);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = parseInt(ampmMatch[2], 10);
      const suffix = ampmMatch[3].toLowerCase();
      if (suffix === 'pm' && hours !== 12) hours += 12;
      if (suffix === 'am' && hours === 12) hours = 0;
      if (minutes >= 0 && minutes < 60 && hours >= 0 && hours < 24) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }

    const hhmmMatch = value.match(/^(\d{1,2}):(\d{2})(:\d{2})?$/);
    if (hhmmMatch) {
      const hours = parseInt(hhmmMatch[1], 10);
      const minutes = parseInt(hhmmMatch[2], 10);
      if (minutes >= 0 && minutes < 60 && hours >= 0 && hours < 24) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }

    return null;
  };

  const buildTimeOptions = React.useCallback(
    (ensure?: string | null) => {
      const options: { value: string; label: string }[] = [];
      for (let h = 5; h < 23; h++) {
        for (const m of ['00', '30']) {
          const hour = h.toString().padStart(2, '0');
          const period = h >= 12 ? 'PM' : 'AM';
          const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
          options.push({
            value: `${hour}:${m}`,
            label: `${displayHour}:${m} ${period}`,
          });
        }
      }
      if (ensure && !options.find((o) => o.value === ensure)) {
        const [h, m] = ensure.split(':').map((v) => parseInt(v, 10));
        if (!Number.isNaN(h) && !Number.isNaN(m)) {
          const period = h >= 12 ? 'PM' : 'AM';
          const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
          options.push({
            value: ensure,
            label: `${displayHour}:${m.toString().padStart(2, '0')} ${period}`,
          });
          options.sort((a, b) => a.value.localeCompare(b.value));
        }
      }
      return options;
    },
    [],
  );

  const [timeOptions, setTimeOptions] = useState<{ value: string; label: string }[]>(() =>
    buildTimeOptions(scheduledTime),
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] md:max-w-[1100px] lg:max-w-[1200px] max-h-[85vh] text-slate-900 dark:text-slate-100">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10">
              <Edit className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <DialogTitle className="text-xl">Modify Shoot Request</DialogTitle>
              <DialogDescription className="mt-1">
                Edit the shoot details below
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-3 gap-4 py-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Column 1 - Client & Address */}
            <div className="space-y-3">
              {/* Client Info (read-only) */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-blue-500" />
                  <p className="font-semibold text-sm">Client</p>
                </div>
                <p className="font-medium">{clientName}</p>
                {clientEmail && (
                  <p className="text-sm text-muted-foreground">{clientEmail}</p>
                )}
              </div>

              {/* Address */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-xs">Property Address</p>
                </div>
                
                <AddressLookupField
                  value={address}
                  onChange={setAddress}
                  onAddressSelect={handleAddressSelect}
                  placeholder="Search address..."
                />

                <div className="grid grid-cols-3 gap-1.5">
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="ST"
                    className="h-8 text-xs"
                    maxLength={2}
                  />
                  <Input
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="ZIP"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Property Details */}
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Property Details</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] flex items-center gap-1">
                      <BedDouble className="h-3 w-3" /> Beds
                    </Label>
                    <Input
                      type="number"
                      value={propertyDetails?.bedrooms || ''}
                      onChange={(e) => setPropertyDetails(prev => ({ 
                        ...prev, 
                        bedrooms: e.target.value ? Number(e.target.value) : undefined 
                      }))}
                      placeholder="0"
                      className="h-7 text-xs"
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] flex items-center gap-1">
                      <Bath className="h-3 w-3" /> Baths
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={propertyDetails?.bathrooms || ''}
                      onChange={(e) => setPropertyDetails(prev => ({ 
                        ...prev, 
                        bathrooms: e.target.value ? Number(e.target.value) : undefined 
                      }))}
                      placeholder="0"
                      className="h-7 text-xs"
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] flex items-center gap-1">
                      <Ruler className="h-3 w-3" /> Sqft
                    </Label>
                    <Input
                      type="number"
                      value={propertySqft || ''}
                      onChange={(e) => setPropertySqft(e.target.value ? Number(e.target.value) : null)}
                      placeholder="0"
                      className="h-7 text-xs"
                      min={0}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Column 2 - Schedule & Notes */}
            <div className="space-y-3">
              {/* Schedule */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold text-xs">Schedule</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal h-8 text-xs',
                            !scheduledDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3 w-3" />
                          {scheduledDate ? format(scheduledDate, 'MMM d') : 'Select'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px]">Time</Label>
                    <Select value={scheduledTime} onValueChange={setScheduledTime}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Photographer — per-category or single */}
                {isAdminOrRep && (() => {
                  if (hasMultiplePhotographerCategories) {
                    return (
                      <div className="space-y-2">
                        <Label className="text-[10px]">Photographers (per category)</Label>
                        {serviceCategoryGroups.map((group) => {
                          const selectedPhotographer = resolvePhotographerDetails(
                            perCategoryPhotographers[group.key] || photographerId,
                          );

                          return (
                            <div
                              key={group.key}
                              className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5"
                            >
                              <div className="min-w-0 space-y-1 text-xs">
                                <div className="text-[9px] font-medium uppercase text-muted-foreground">
                                  {group.name}
                                </div>
                                <div className="font-medium">
                                  {selectedPhotographer?.name || 'Unassigned'}
                                </div>
                                {selectedPhotographer?.email && (
                                  <div className="truncate text-muted-foreground">
                                    {selectedPhotographer.email}
                                  </div>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0 text-xs"
                                onClick={() =>
                                  openPhotographerPicker({
                                    categoryKey: group.key,
                                    categoryName: group.name,
                                  })
                                }
                              >
                                {selectedPhotographer ? 'Edit photographer' : 'Select photographer'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  const selectedPhotographer = resolvePhotographerDetails(photographerId);

                  return (
                    <div className="space-y-2">
                      <Label className="text-[10px]">Photographer</Label>
                      <div className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5">
                        <div className="min-w-0 space-y-1 text-xs">
                          <div className="font-medium">
                            {selectedPhotographer?.name || 'Unassigned'}
                          </div>
                          {selectedPhotographer?.email && (
                            <div className="truncate text-muted-foreground">
                              {selectedPhotographer.email}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 text-xs"
                          onClick={() => openPhotographerPicker(null)}
                        >
                          {selectedPhotographer ? 'Edit photographer' : 'Select photographer'}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Shoot Notes */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" />
                  <Label className="text-xs font-semibold">Shoot Notes</Label>
                </div>
                <Textarea
                  value={shootNotes}
                  onChange={(e) => setShootNotes(e.target.value)}
                  placeholder="Access codes, instructions..."
                  rows={2}
                  className="resize-none text-xs"
                />
              </div>

              {/* Internal Notes (Admin/Rep) */}
              {showInternalNotes && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <Label className="text-xs font-semibold">Company Notes</Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setCompanyNotesOpen((v) => !v)}
                      >
                        {companyNotesOpen ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    {companyNotesOpen && (
                      <Textarea
                        value={companyNotes}
                        onChange={(e) => setCompanyNotes(e.target.value)}
                        placeholder="Internal notes..."
                        rows={2}
                        className="resize-none text-xs"
                      />
                    )}
                  </div>

                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-500" />
                        <Label className="text-xs font-semibold">Photographer Notes</Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setPhotographerNotesOpen((v) => !v)}
                      >
                        {photographerNotesOpen ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    {photographerNotesOpen && (
                      <Textarea
                        value={photographerNotes}
                        onChange={(e) => setPhotographerNotes(e.target.value)}
                        placeholder="Notes for the photographer"
                        rows={2}
                        className="resize-none text-xs"
                      />
                    )}
                  </div>

                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-500" />
                        <Label className="text-xs font-semibold">Editor Notes</Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditorNotesOpen((v) => !v)}
                      >
                        {editorNotesOpen ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    {editorNotesOpen && (
                      <Textarea
                        value={editorNotes}
                        onChange={(e) => setEditorNotes(e.target.value)}
                        placeholder="Notes for the editor"
                        rows={2}
                        className="resize-none text-xs"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Column 3 - Services */}
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 space-y-2 h-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-violet-500" />
                    <p className="font-semibold text-xs">Services *</p>
                  </div>
                  {propertySqft && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {propertySqft.toLocaleString()} sqft
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {availableServices.map((service) => {
                    const serviceId = service.id?.toString();
                    const isSelected = selectedServiceIds.has(serviceId);
                    const price = getServicePrice(service);
                    const isVariablePricing = service.pricing_type === 'variable' && service.sqft_ranges?.length;
                    const showVariablePlaceholder = isVariablePricing && !propertySqft;
                    return (
                      <div
                        key={serviceId}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors",
                          isSelected 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() => toggleService(serviceId)}
                      >
                        <div className="flex items-center gap-1.5">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleService(serviceId)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs font-medium">{service.name}</span>
                        </div>
                        <span className={cn(
                          "text-xs font-medium",
                          isVariablePricing && propertySqft ? "text-emerald-600" : "text-muted-foreground"
                        )}>
                          {showVariablePlaceholder ? 'Varies' : `$${price.toFixed(0)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {selectedServiceIds.size > 0 && (() => {
                  const servicesTotal = hasVariablePricingWithoutSqft
                    ? 0
                    : Array.from(selectedServiceIds).reduce((sum, id) => {
                        const service = availableServices.find((s) => s.id?.toString() === id);
                        return sum + (service ? getServicePrice(service) : 0);
                      }, 0);
                  const normalizedTaxRate = taxPercent > 1 ? taxPercent / 100 : taxPercent;
                  const calculatedTax = Number((servicesTotal * normalizedTaxRate).toFixed(2));
                  const total = servicesTotal + calculatedTax;
                  return (
                    <div className="pt-2 border-t mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Selected:</span>
                        <span className="font-semibold">{selectedServiceIds.size} service(s)</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Base:</span>
                        <span className={cn(
                          "font-semibold",
                          hasVariablePricingWithoutSqft ? "text-amber-600" : ""
                        )}>
                          {hasVariablePricingWithoutSqft ? 'TBD' : `$${servicesTotal.toFixed(2)}`}
                        </span>
                      </div>
                      {!hasVariablePricingWithoutSqft && taxPercent > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Tax ({taxPercent > 1 ? taxPercent : (taxPercent * 100).toFixed(1)}%):</span>
                          <span className="font-medium">${calculatedTax.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">Total:</span>
                        <span className={cn(
                          hasVariablePricingWithoutSqft ? "text-amber-600" : "text-emerald-600"
                        )}>
                          {hasVariablePricingWithoutSqft ? 'TBD' : `$${total.toFixed(2)}`}
                        </span>
                      </div>
                      {hasVariablePricingWithoutSqft && (
                        <p className="text-[10px] text-muted-foreground">
                          Sqft required for accurate variable pricing.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveRequest} 
            disabled={isSubmitting || isLoading} 
            className="bg-blue-600 hover:bg-blue-700 min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>

        <Dialog open={photographerPickerOpen} onOpenChange={(open) => {
          if (!open) {
            closePhotographerPicker();
          }
        }}>
          <DialogContent className="sm:max-w-2xl w-full">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-100 dark:border-slate-800">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <DialogHeader>
                    <DialogTitle className="text-lg text-slate-900 dark:text-slate-100">
                      {photographerPickerContext?.categoryName
                        ? `Select Photographer for ${photographerPickerContext.categoryName}`
                        : 'Select Photographer'}
                    </DialogTitle>
                    <DialogDescription>
                      {photographerPickerContext?.categoryName
                        ? `Choose a photographer for ${photographerPickerContext.categoryName} services`
                        : 'Choose a photographer for this requested shoot'}
                    </DialogDescription>
                  </DialogHeader>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search photographers..."
                    value={photographerSearchQuery}
                    onChange={(e) => setPhotographerSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                <div className="pt-3 max-h-[48vh] overflow-y-auto pr-2">
                  {filteredPhotographers.length > 0 ? (
                    <div className="grid gap-4">
                      {filteredPhotographers.map((photographer) => (
                        <button
                          type="button"
                          key={photographer.id}
                          onClick={() => setPickerPhotographerId(String(photographer.id))}
                          className={cn(
                            'w-full rounded-2xl border p-4 text-left transition-all',
                            pickerPhotographerId === String(photographer.id)
                              ? 'border-blue-300 bg-blue-50/70 dark:border-blue-700 dark:bg-blue-950/40'
                              : 'border-gray-100 bg-gray-50 dark:border-slate-700 dark:bg-slate-800',
                            'hover:border-blue-200 dark:hover:border-blue-800',
                          )}
                        >
                          <div className="flex items-start gap-4">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={photographer.avatar} alt={photographer.name} />
                              <AvatarFallback>{photographer.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {photographer.name}
                                  </div>
                                  {photographer.email && (
                                    <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                      {photographer.email}
                                    </div>
                                  )}
                                </div>
                                {pickerPhotographerId === String(photographer.id) && (
                                  <span className="text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-300">
                                    Selected
                                  </span>
                                )}
                              </div>
                              {(photographer.city || photographer.state) && (
                                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  {[photographer.city, photographer.state].filter(Boolean).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      No photographers available.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-between gap-2 border-t pt-4">
                <Button variant="outline" onClick={handleClearPhotographerPicker}>
                  Leave unassigned
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={closePhotographerPicker}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfirmPhotographerPicker} disabled={!pickerPhotographerId}>
                    Use selection
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>

      <Dialog
        open={isSaveConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSaveConfirmOpen(false);
            setPendingPayload(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Confirm update</DialogTitle>
            <DialogDescription>
              Choose who should receive update notifications for this shoot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Client</p>
                <p className="text-xs text-muted-foreground">{clientEmail || 'No client email on file'}</p>
              </div>
              <Checkbox
                checked={notifyClientOnSave}
                onCheckedChange={(value) => setNotifyClientOnSave(Boolean(value))}
                disabled={!canNotifyClient}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Photographer</p>
                <p className="text-xs text-muted-foreground">
                  {photographerEmail || 'No photographer email on file'}
                </p>
              </div>
              <Checkbox
                checked={notifyPhotographerOnSave}
                onCheckedChange={(value) => setNotifyPhotographerOnSave(Boolean(value))}
                disabled={!canNotifyPhotographer}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsSaveConfirmOpen(false);
                setPendingPayload(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmSave} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
