import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import axios from 'axios';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { useMediaQuery } from '@/hooks/use-media-query';
import { API_BASE_URL } from '@/config/env';
import API_ROUTES from '@/lib/api';
import type { AddressDetails } from '@/utils/addressLookup';
import type { ServiceSelectionOption } from '@/components/booking/ServiceSelectionDialog';
import { getDayAvailability, type DayAvailability } from '@/utils/availabilityProvider';
import { isTimeOutsideDayAvailability, extractStartTimeScheduleError } from '@/utils/editPickerBounds';
import { getShootPhotographerAssignmentGroups } from '@/utils/shootPhotographerAssignments';
import { calculatePricingBreakdown, type PricingDiscountType } from '@/utils/pricing';
import { buildWallClockIso } from '@/utils/wallClockDateTime';
import { formatTimeForDisplay } from '@/utils/availabilityUtils';
import { getShootInvoiceAdjustmentTotal } from '@/utils/shootServiceItems';
import {
  addInvoiceAdjustmentToCatalogTotal,
  getShootEditCatalogServiceEntries,
  getShootEditCatalogServiceId,
} from './shootEditInvoiceAdjustments';
import { buildTimeOptions, normalizeTimeValue } from './shootEditTimeHelpers';
import { extractLookupPropertyDetails, formatDateForInputValue, formatTimeForInputValue, loadPhotographerOptions, mapPhotographerOption, normalizeCategoryKey, resolveSelectedServiceIds, type Photographer, type AvailabilitySlot, type MobileEditPanel, type PhotographerAvailabilityMap, type PhotographerPickerContext, type PropertyDetails, type SelectedServiceSource, type Service, type ServiceApiRange, type ServiceApiRecord, type ServiceScheduleFields, type ShootDetails, type ShootEditModalProps } from './shootEditModalTypes';
export function useShootEditModalController({
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
  const shootDetailsRef = useRef<ShootDetails | null>(null);
  const photographersRef = useRef<Photographer[]>([]);
  const [photographerPickerOpen, setPhotographerPickerOpen] = useState(false);
  const [photographerPickerContext, setPhotographerPickerContext] = useState<PhotographerPickerContext>(null);
  const [pickerPhotographerId, setPickerPhotographerId] = useState('');
  const [photographerSearchQuery, setPhotographerSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'availability'>('distance');
  const [showAllPhotographers, setShowAllPhotographers] = useState(false);
  const [expandedServiceScheduleId, setExpandedServiceScheduleId] = useState<string | null>(null);
  const [servicesEditorOpen, setServicesEditorOpen] = useState(false);
  const userRole = user?.role?.toLowerCase() || '';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isRep = userRole === 'rep' || userRole === 'salesrep';
  const isAdminOrRep = isAdmin || isRep;
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>('10:00');
  const [alternateDate, setAlternateDate] = useState<string>('');
  const [alternateTime, setAlternateTime] = useState<string>('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [serviceSchedules, setServiceSchedules] = useState<Record<string, ServiceScheduleFields>>({});
  const [photographerId, setPhotographerId] = useState<string>('');
  const [perCategoryPhotographers, setPerCategoryPhotographers] = useState<Record<string, string>>({});
  const [photographerAvailability, setPhotographerAvailability] = useState<PhotographerAvailabilityMap>({});
  const [isLoadingPhotographerAvailability, setIsLoadingPhotographerAvailability] = useState(false);
  const [editDayAvailability, setEditDayAvailability] = useState<DayAvailability | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [shootNotes, setShootNotes] = useState(''); // All: client, admin, rep
  const [companyNotes, setCompanyNotes] = useState(''); // Admin only
  const [photographerNotes, setPhotographerNotes] = useState(''); // Admin and rep
  const [editorNotes, setEditorNotes] = useState(''); // Admin and rep
  const showInternalNotes = isAdminOrRep;
  const [companyNotesOpen, setCompanyNotesOpen] = useState(false);
  const [photographerNotesOpen, setPhotographerNotesOpen] = useState(false);
  const [editorNotesOpen, setEditorNotesOpen] = useState(false);
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);
  const [propertySqft, setPropertySqft] = useState<number | null>(null);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobileEditPanel>('details');
  const isDesktopLayout = useMediaQuery('(min-width: 768px)');
  useEffect(() => { shootDetailsRef.current = shootDetails; }, [shootDetails]);
  useEffect(() => { photographersRef.current = photographers; }, [photographers]);
  useEffect(() => {
    if (isOpen) {
      setActiveMobilePanel('details');
    }
  }, [isOpen, shootId]);
  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen || !shootId) return;
      setIsLoading(true);
      setSelectedServiceIds(new Set());
      setServiceSchedules({});
      setPerCategoryPhotographers({});
      setPhotographerId('');
      setExpandedServiceScheduleId(null);
      setServicesEditorOpen(false);
      setAlternateDate('');
      setAlternateTime('');
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const [shootResponse, servicesResponse, photographersData] = await Promise.all([
          fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_BASE_URL}/api/services`),
          loadPhotographerOptions(),
        ]);
        const servicesData = servicesResponse.data?.data || [];
        const mappedServices = servicesData.map((s: ServiceApiRecord) => ({
          id: s.id?.toString() || s.id,
          name: s.name,
          price: Number(s.price || 0),
          pricing_type: s.pricing_type || 'fixed',
          category: s.category ? { id: s.category.id, name: s.category.name } : undefined,
          sqft_ranges: (s.sqft_ranges || s.sqftRanges || []).map((r: ServiceApiRange) => ({
            ...r,
            sqft_from: Number(r.sqft_from) || 0,
            sqft_to: Number(r.sqft_to) || 0,
            price: Number(r.price) || 0,
            photographer_pay: r.photographer_pay != null ? Number(r.photographer_pay) : null,
          })),
        }));
        setAvailableServices(mappedServices);
        setPhotographers(photographersData);
        if (shootResponse.ok) {
          const data = await shootResponse.json();
          const shoot = data.data || data;
          setShootDetails(shoot);
          setAddress(shoot.address || shoot.location?.address || '');
          setCity(shoot.city || shoot.location?.city || '');
          setState(shoot.state || shoot.location?.state || '');
          setZip(shoot.zip || shoot.location?.zip || '');
          setShootNotes(shoot.shoot_notes || shoot.shootNotes || '');
          setCompanyNotes(shoot.company_notes || shoot.companyNotes || '');
          setPhotographerNotes(shoot.photographer_notes || shoot.photographerNotes || '');
          setEditorNotes(shoot.editor_notes || shoot.editorNotes || '');
          const photoId = shoot.photographer_id || shoot.photographer?.id;
          setPhotographerId(photoId ? photoId.toString() : '');
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
          setPropertyDetails(
            extractLookupPropertyDetails({
              ...shoot,
              sqft: sqft ? Number(sqft) : undefined,
              bedrooms: shoot.bedrooms || shoot.property_details?.bedrooms,
              bathrooms: shoot.bathrooms || shoot.property_details?.bathrooms,
              property_details: shoot.property_details,
            })
          );
          const dateStr = shoot.scheduled_date || shoot.scheduledDate;
          if (dateStr) {
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
          const rawAlternateDate =
            shoot.alternate_scheduled_date || shoot.alternateScheduledDate || '';
          setAlternateDate(rawAlternateDate ? String(rawAlternateDate).split(/[T\s]/)[0] : '');
          setAlternateTime(normalizeTimeValue(shoot.alternate_time || shoot.alternateTime) || '');
          const rawTaxPercent = shoot.tax_percent ?? shoot.taxPercent ?? shoot.payment?.taxRate ?? 0;
          setTaxPercent(Number(rawTaxPercent) || 0);
          const serviceSource = getShootEditCatalogServiceEntries(shoot);
          if (serviceSource.length > 0) {
            const ids = resolveSelectedServiceIds(serviceSource, mappedServices);
            setSelectedServiceIds(ids);
            const rawServiceItems = Array.isArray(shoot.serviceItems)
              ? shoot.serviceItems
              : Array.isArray(shoot.service_items)
                ? shoot.service_items
                : [];
            const scheduleByServiceId = new Map<string, ServiceScheduleFields>();
            rawServiceItems.forEach((item: Record<string, unknown>) => {
              const serviceId = getShootEditCatalogServiceId(item);
              if (!serviceId) return;
              const scheduledAt = item.scheduled_at ?? item.scheduledAt;
              const date = formatDateForInputValue(scheduledAt);
              const time = formatTimeForInputValue(scheduledAt);
              if (date || time) {
                scheduleByServiceId.set(String(serviceId), { date, time });
              }
            });
            const orderScheduledAt = shoot.start_time || shoot.scheduled_at || shoot.scheduledAt || shoot.scheduled_date || shoot.scheduledDate;
            const fallbackSchedule = {
              date: formatDateForInputValue(orderScheduledAt),
              time: normalizedTime || formatTimeForInputValue(orderScheduledAt) || '10:00',
            };
            const nextServiceSchedules: Record<string, ServiceScheduleFields> = {};
            serviceSource.forEach((service: SelectedServiceSource & Record<string, unknown>) => {
              if (!service || typeof service !== 'object') return;
              const normalizedServiceId = getShootEditCatalogServiceId(service);
              if (!normalizedServiceId) return;
              const directScheduledAt = service.scheduled_at ?? service.scheduledAt;
              nextServiceSchedules[normalizedServiceId] =
                scheduleByServiceId.get(normalizedServiceId) || {
                  date: formatDateForInputValue(directScheduledAt) || fallbackSchedule.date,
                  time: formatTimeForInputValue(directScheduledAt) || fallbackSchedule.time,
                };
            });
            setServiceSchedules(nextServiceSchedules);
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
      } catch (error: unknown) {
        console.error('Error fetching data:', error);
        if (!shootDetailsRef.current) {
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to load shoot details.',
            variant: 'destructive',
          });
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isOpen, shootId, toast]);
  const clearAddressDerivedState = React.useCallback(() => {
    setCity('');
    setState('');
    setZip('');
    setPropertySqft(null);
    setPropertyDetails(null);
  }, []);
  const handleAddressSelect = (details: AddressDetails) => {
    if (details) {
      setAddress(details.address || '');
      setCity(details.city || '');
      setState(details.state || '');
      setZip(details.zip || '');
      const nextPropertyDetails = extractLookupPropertyDetails(details);
      setPropertySqft(nextPropertyDetails.sqft ? Number(nextPropertyDetails.sqft) : null);
      setPropertyDetails(nextPropertyDetails);
    }
  };
  const getServicePrice = React.useCallback((service: Service): number => {
    if (service.pricing_type === 'variable' && propertySqft && service.sqft_ranges?.length) {
      const matchingRange = service.sqft_ranges.find(
        range => propertySqft >= range.sqft_from && propertySqft <= range.sqft_to
      );
      if (matchingRange) {
        return Number(matchingRange.price) || 0;
      }
    }
    return Number(service.price) || 0;
  }, [propertySqft]);
  const hasVariablePricingWithoutSqft = React.useMemo(() => {
    if (!selectedServiceIds.size) return false;
    return Array.from(selectedServiceIds).some((id) => {
      const service = availableServices.find((s) => s.id?.toString() === id);
      return Boolean(service?.pricing_type === 'variable' && service.sqft_ranges?.length && !propertySqft);
    });
  }, [selectedServiceIds, availableServices, propertySqft]);
  useEffect(() => {
    if (!shootDetails || selectedServiceIds.size > 0 || availableServices.length === 0) return;
    const serviceSource = getShootEditCatalogServiceEntries(shootDetails);
    if (!serviceSource.length) return;
    const ids = resolveSelectedServiceIds(serviceSource, availableServices);
    if (ids.size > 0) {
      setSelectedServiceIds(ids);
    }
  }, [availableServices, selectedServiceIds.size, shootDetails]);
  const clientName = shootDetails?.client?.name || 'Unknown Client';
  const invoiceAdjustmentTotal = useMemo(
    () => getShootInvoiceAdjustmentTotal(shootDetails),
    [shootDetails],
  );
  const clientEmail = shootDetails?.client?.email || '';
  const clientPhone = shootDetails?.client?.phonenumber || shootDetails?.client?.phone || '';
  const clientVerified = Boolean(
    shootDetails?.client?.email_verified ?? shootDetails?.client?.emailVerified,
  );
  const activeDiscountType = (shootDetails?.discount_type ??
    shootDetails?.discountType ??
    shootDetails?.payment?.discount_type ??
    shootDetails?.payment?.discountType ??
    shootDetails?.client?.client_discount_type ??
    shootDetails?.client?.clientDiscountType ??
    null) as PricingDiscountType;
  const activeDiscountValue = Number(
    shootDetails?.discount_value ??
      shootDetails?.discountValue ??
      shootDetails?.payment?.discount_value ??
      shootDetails?.payment?.discountValue ??
      shootDetails?.client?.client_discount_value ??
      shootDetails?.client?.clientDiscountValue ??
      0,
  ) || 0;
  const photographerEmail =
    shootDetails?.photographer?.email ||
    photographers.find((photographer) => String(photographer.id) === String(photographerId || shootDetails?.photographer?.id))?.email ||
    '';
  const availableServiceCategoryGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; services: Service[]; serviceIds: string[] }>();
    availableServices.forEach((service) => {
      const serviceId = String(service.id);
      const categoryName =
        typeof service.category === 'string'
          ? service.category
          : service.category?.name || 'Other';
      const key = normalizeCategoryKey(categoryName);
      const existing = groups.get(key);
      if (existing) {
        existing.services.push(service);
        existing.serviceIds.push(serviceId);
      } else {
        groups.set(key, {
          key,
          name: categoryName,
          services: [service],
          serviceIds: [serviceId],
        });
      }
    });
    return Array.from(groups.values());
  }, [availableServices]);
  const selectedServiceCategoryGroups = useMemo(
    () =>
      availableServiceCategoryGroups
        .map((group) => ({
          ...group,
          serviceIds: group.serviceIds.filter((serviceId) => selectedServiceIds.has(serviceId)),
        }))
        .filter((group) => group.serviceIds.length > 0),
    [availableServiceCategoryGroups, selectedServiceIds],
  );
  const hasMultiplePhotographerCategories = selectedServiceCategoryGroups.length > 1;
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
    const query = photographerSearchQuery.trim().toLowerCase();
    const searched = query
      ? photographers.filter((photographer) =>
          photographer.name.toLowerCase().includes(query) ||
          String(photographer.email || '').toLowerCase().includes(query) ||
          String(photographer.city || '').toLowerCase().includes(query) ||
          String(photographer.state || '').toLowerCase().includes(query),
        )
      : photographers;
    const filtered = showAllPhotographers
      ? searched
      : searched.filter((photographer) => (photographerAvailability[String(photographer.id)] || []).length > 0);
    return [...filtered].sort((first, second) => {
      if (sortBy === 'availability') {
        return (photographerAvailability[String(second.id)] || []).length - (photographerAvailability[String(first.id)] || []).length;
      }
      const firstDistance = typeof first.distance === 'number' ? first.distance : Number.POSITIVE_INFINITY;
      const secondDistance = typeof second.distance === 'number' ? second.distance : Number.POSITIVE_INFINITY;
      return firstDistance - secondDistance;
    });
  }, [photographerSearchQuery, photographers, photographerAvailability, showAllPhotographers, sortBy]);
  const formatPhotographerLocationLabel = (photographer?: Photographer | null) => {
    if (!photographer) return '';
    const parts = [photographer.address, photographer.city, photographer.state, photographer.zip]
      .filter(Boolean)
      .map((part) => String(part).trim())
      .filter(Boolean);
    return parts.join(', ');
  };
  useEffect(() => {
    const availabilityDateValue = scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : '';
    if (!isOpen || photographers.length === 0 || !availabilityDateValue) {
      setPhotographerAvailability({});
      return;
    }
    const abortController = new AbortController();
    const fetchAvailability = async () => {
      setIsLoadingPhotographerAvailability(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const requestAddress = address || shootDetails?.address || '';
        const requestCity = city || shootDetails?.city || '';
        const requestState = state || shootDetails?.state || '';
        const requestZip = zip || shootDetails?.zip || '';
        const response = await fetch(API_ROUTES.photographerAvailability.forBooking, {
          method: 'POST',
          headers,
          signal: abortController.signal,
          body: JSON.stringify({
            date: availabilityDateValue,
            time: scheduledTime || undefined,
            shoot_address: requestAddress,
            shoot_city: requestCity,
            shoot_state: requestState,
            shoot_zip: requestZip || '',
            photographer_ids: photographersRef.current.map((photographer) => Number(photographer.id)).filter(Number.isFinite),
          }),
        });
        if (!response.ok) throw new Error('Failed to fetch photographer availability');
        const json = await response.json() as { data?: Array<Partial<Photographer> & {
          net_available_slots?: AvailabilitySlot[];
          availability_slots?: AvailabilitySlot[];
          unavailable_slots?: AvailabilitySlot[];
          booked_slots?: Array<AvailabilitySlot & { status?: string; shoot_id?: number }>;
          shoots_count_today?: number;
          distance_from?: 'home' | 'previous_shoot';
          previous_shoot_id?: number;
        }> };
        const enrichedPhotographers = Array.isArray(json.data) ? json.data : [];
        const nextAvailability: PhotographerAvailabilityMap = {};
        const enrichedById = new Map(enrichedPhotographers.map((item) => [String(item.id), item]));
        setPhotographers((current) => current.map((photographer) => {
          const enriched = enrichedById.get(String(photographer.id));
          if (!enriched) return photographer;
          const parsedDistance = typeof enriched.distance === 'number'
            ? enriched.distance
            : enriched.distance
              ? Number.parseFloat(String(enriched.distance))
              : undefined;
          const netAvailableSlots = enriched.net_available_slots || enriched.availability_slots || [];
          nextAvailability[String(photographer.id)] = netAvailableSlots.map((slot) => ({
            start_time: slot.start_time,
            end_time: slot.end_time,
          }));
          return {
            ...photographer,
            distance: Number.isFinite(parsedDistance as number) ? parsedDistance : undefined,
            distanceFrom: enriched.distance_from,
            previousShootId: enriched.previous_shoot_id,
            availabilitySlots: enriched.availability_slots || [],
            unavailableSlots: enriched.unavailable_slots || [],
            bookedSlots: enriched.booked_slots || [],
            netAvailableSlots,
            shootsCountToday: enriched.shoots_count_today,
          };
        }));
        setPhotographerAvailability(nextAvailability);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('[ShootEditModal] Failed to load photographer availability:', error);
        setPhotographerAvailability({});
      } finally {
        setIsLoadingPhotographerAvailability(false);
      }
    };
    fetchAvailability();
    return () => abortController.abort();
  }, [isOpen, photographers.length, scheduledDate, scheduledTime, address, city, state, zip, shootDetails]);
  useEffect(() => {
    if (!isOpen || !photographerId || photographerId === 'unassigned' || !scheduledDate) {
      setEditDayAvailability(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const result = await getDayAvailability(photographerId, scheduledDate, controller.signal);
        setEditDayAvailability(result.day);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setEditDayAvailability(null);
      }
    })();
    return () => controller.abort();
  }, [isOpen, photographerId, scheduledDate]);
  useEffect(() => {
    setScheduleError(null);
  }, [scheduledTime, scheduledDate, photographerId]);
  const isEditTimeDisabled = React.useCallback(
    (value: string): boolean => isTimeOutsideDayAvailability(editDayAvailability, value),
    [editDayAvailability],
  );
  const openPhotographerPicker = (context: PhotographerPickerContext) => {
    const singleCategory = selectedServiceCategoryGroups[0];
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
      if (selectedServiceCategoryGroups.length <= 1 && (!photographerId || photographerId === 'unassigned')) {
        setPhotographerId(pickerPhotographerId);
      }
    } else {
      setPhotographerId(pickerPhotographerId);
      if (selectedServiceCategoryGroups.length === 1) {
        setPerCategoryPhotographers((prev) => ({
          ...prev,
          [selectedServiceCategoryGroups[0].key]: pickerPhotographerId,
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
      if (selectedServiceCategoryGroups.length <= 1) {
        setPhotographerId('');
      }
    } else {
      setPhotographerId('');
      if (selectedServiceCategoryGroups.length === 1) {
        const nextAssignments = { ...perCategoryPhotographers };
        delete nextAssignments[selectedServiceCategoryGroups[0].key];
        setPerCategoryPhotographers(nextAssignments);
      }
    }
    closePhotographerPicker();
  };
  const buildApprovalPayload = () => {
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
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const scheduledAt = new Date(scheduledDate);
    scheduledAt.setHours(hours, minutes, 0, 0);
    const servicesTotal = Array.from(selectedServiceIds).reduce((sum, id) => {
      const service = availableServices.find(s => s.id?.toString() === id);
      return sum + (service ? getServicePrice(service) : 0);
    }, 0);
    const normalizedTaxRate = taxPercent > 1 ? taxPercent / 100 : taxPercent;
    const pricing = calculatePricingBreakdown({
      serviceSubtotal: servicesTotal,
      discountType: activeDiscountType,
      discountValue: activeDiscountValue,
      taxRate: normalizedTaxRate,
    });
    const serviceItemsPayload = Array.from(selectedServiceIds).map(id => {
      const service = availableServices.find(s => s.id?.toString() === id);
      const serviceSchedule = serviceSchedules[id] || {
        date: format(scheduledAt, 'yyyy-MM-dd'),
        time: scheduledTime,
      };
      const serviceScheduledAt = buildScheduledAtIso(
        serviceSchedule.date || format(scheduledAt, 'yyyy-MM-dd'),
        serviceSchedule.time || scheduledTime,
      ) || scheduledAt.toISOString();
      const catName = service
        ? typeof service.category === 'string'
          ? service.category
          : service.category?.name || 'Other'
        : 'Other';
      const categoryPhotographerId = perCategoryPhotographers[catName.trim().toLowerCase().replace(/s$/, '')];
      return {
        service_id: Number(id),
        quantity: 1,
        price: service ? getServicePrice(service) : undefined,
        scheduled_at: serviceScheduledAt,
        photographer_id:
          categoryPhotographerId && categoryPhotographerId !== 'unassigned'
            ? Number(categoryPhotographerId)
            : photographerId && photographerId !== 'unassigned'
              ? Number(photographerId)
              : undefined,
      };
    });
    const payload: Record<string, unknown> = {
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      scheduled_at: scheduledAt.toISOString(),
      alternate_scheduled_date: alternateDate || null,
      alternate_time: alternateDate && alternateTime ? alternateTime : null,
      shoot_notes: shootNotes.trim(),
      services: serviceItemsPayload.map((item) => ({
        id: item.service_id,
        quantity: item.quantity,
        price: item.price,
        scheduled_at: item.scheduled_at,
      })),
      service_items: serviceItemsPayload,
      base_quote: pricing.discountedSubtotal,
      discount_type: pricing.discountType,
      discount_value: pricing.discountValue,
      discount_amount: pricing.discountAmount,
      tax_amount: pricing.taxAmount,
      total_quote: addInvoiceAdjustmentToCatalogTotal(
        pricing.totalQuote,
        invoiceAdjustmentTotal,
      ),
    };
    if (isAdminOrRep && photographerId && photographerId !== 'unassigned') {
      payload.photographer_id = Number(photographerId);
    }
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
    if (showInternalNotes) {
      if (companyNotes.trim()) payload.company_notes = companyNotes.trim();
      if (photographerNotes.trim()) payload.photographer_notes = photographerNotes.trim();
      if (editorNotes.trim()) payload.editor_notes = editorNotes.trim();
    }
    const mergedPropertyDetails = propertyDetails
      ? {
          ...propertyDetails,
          sqft: propertySqft ?? propertyDetails.sqft ?? undefined,
          squareFeet: propertySqft ?? propertyDetails.squareFeet ?? propertyDetails.sqft ?? undefined,
        }
      : null;
    if (propertySqft !== null && propertySqft !== undefined) {
      payload.sqft = propertySqft;
    }
    if (propertyDetails?.bedrooms !== null && propertyDetails?.bedrooms !== undefined) {
      payload.bedrooms = propertyDetails.bedrooms;
    }
    if (propertyDetails?.bathrooms !== null && propertyDetails?.bathrooms !== undefined) {
      payload.bathrooms = propertyDetails.bathrooms;
    }
    if (mergedPropertyDetails && Object.keys(mergedPropertyDetails).length > 0) {
      payload.property_details = mergedPropertyDetails;
    }
    return payload;
  };
  const canNotifyClient = Boolean(clientEmail);
  const notificationPhotographerId = photographerId || shootDetails?.photographer?.id;
  const canNotifyPhotographer = Boolean(
    photographerEmail
      && (
        !shootDetails?.client?.id
        || String(notificationPhotographerId) !== String(shootDetails?.client?.id)
      )
  );
  const submitApproval = async ({
    notifyClient,
    notifyPhotographer,
    silent,
  }: {
    notifyClient: boolean;
    notifyPhotographer: boolean;
    silent: boolean;
  }) => {
    if (isSubmitting || isLoading) return;
    const payload = buildApprovalPayload();
    if (!payload) return;
    setScheduleError(null);
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const approvalPayload = {
        ...payload,
        notify_client: notifyClient,
        notify_photographer: notifyPhotographer,
      };
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(approvalPayload),
      });
      if (!response.ok) {
        let errorBody: { message?: string; errors?: Record<string, string[] | string> } | null = null;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = null;
        }
        const scheduleBoundError = extractStartTimeScheduleError(response.status, errorBody);
        if (scheduleBoundError) {
          setScheduleError(scheduleBoundError);
          return;
        }
        throw new Error(errorBody?.message || 'Failed to approve shoot');
      }
      toast({
        title: 'Shoot approved',
        description: silent
          ? 'The shoot request has been approved without sending notifications.'
          : 'The shoot request has been approved successfully.',
      });
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Error approving shoot:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve shoot. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleApprove = () =>
    submitApproval({
      notifyClient: canNotifyClient,
      notifyPhotographer: canNotifyPhotographer,
      silent: false,
    });
  const handleApproveWithoutNotification = () =>
    submitApproval({
      notifyClient: false,
      notifyPhotographer: false,
      silent: true,
    });
  const [timeOptions, setTimeOptions] = useState<{ value: string; label: string }[]>(() =>
    buildTimeOptions(scheduledTime),
  );
  const minSelectableDate = useMemo(
    () => format(new Date(), 'yyyy-MM-dd'),
    [],
  );
  const scheduledDateInputValue = useMemo(
    () => (scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : ''),
    [scheduledDate],
  );
  const defaultServiceSchedule = useMemo<ServiceScheduleFields>(
    () => ({
      date: scheduledDateInputValue,
      time: scheduledTime || '10:00',
    }),
    [scheduledDateInputValue, scheduledTime],
  );
  const selectedServiceRows = useMemo(
    () =>
      Array.from(selectedServiceIds)
        .map((id) => {
          const service = availableServices.find((candidate) => candidate.id?.toString() === id);
          return service ? { id, service } : null;
        })
        .filter((row): row is { id: string; service: Service } => Boolean(row)),
    [availableServices, selectedServiceIds],
  );
  useEffect(() => {
    if (selectedServiceIds.size === 0) {
      setServiceSchedules({});
      setExpandedServiceScheduleId(null);
      return;
    }
    setServiceSchedules((current) => {
      let changed = false;
      const next: Record<string, ServiceScheduleFields> = {};
      selectedServiceIds.forEach((id) => {
        next[id] = current[id] || defaultServiceSchedule;
        if (!current[id]) changed = true;
      });
      Object.keys(current).forEach((id) => {
        if (!selectedServiceIds.has(id)) changed = true;
      });
      return changed ? next : current;
    });
  }, [defaultServiceSchedule, selectedServiceIds]);
  useEffect(() => {
    if (expandedServiceScheduleId && !selectedServiceIds.has(expandedServiceScheduleId)) {
      setExpandedServiceScheduleId(null);
    }
  }, [expandedServiceScheduleId, selectedServiceIds]);
  const updateServiceSchedule = (
    serviceId: string,
    field: keyof ServiceScheduleFields,
    value: string,
  ) => {
    setServiceSchedules((current) => ({
      ...current,
      [serviceId]: {
        ...(current[serviceId] || defaultServiceSchedule),
        [field]: value,
      },
    }));
  };
  const getServiceScheduleDateLabel = (dateValue?: string) => {
    if (!dateValue) return '';
    const parsedDate = new Date(`${dateValue}T12:00:00`);
    return Number.isNaN(parsedDate.getTime()) ? dateValue : format(parsedDate, 'dd MMM yyyy');
  };
  const getServiceScheduleTimeLabel = (timeValue?: string) => {
    if (!timeValue) return '';
    return formatTimeForDisplay(timeValue);
  };
  const getServiceScheduleSummary = (schedule: ServiceScheduleFields) => {
    const dateLabel = getServiceScheduleDateLabel(schedule.date);
    const timeLabel = getServiceScheduleTimeLabel(schedule.time || scheduledTime);
    if (!dateLabel && !timeLabel) return 'Select schedule';
    if (!dateLabel) return timeLabel;
    if (!timeLabel) return dateLabel;
    return `${dateLabel} · ${timeLabel}`;
  };
  const sortedServiceScheduleRows = useMemo(
    () =>
      [...selectedServiceRows].sort((first, second) => {
        const firstSchedule = serviceSchedules[first.id] || defaultServiceSchedule;
        const secondSchedule = serviceSchedules[second.id] || defaultServiceSchedule;
        const firstDateTime = buildWallClockIso(firstSchedule.date, firstSchedule.time || scheduledTime);
        const secondDateTime = buildWallClockIso(secondSchedule.date, secondSchedule.time || scheduledTime);
        const firstTime = firstDateTime ? new Date(firstDateTime).getTime() : 0;
        const secondTime = secondDateTime ? new Date(secondDateTime).getTime() : 0;
        if (firstTime !== secondTime) return firstTime - secondTime;
        return first.service.name.localeCompare(second.service.name);
      }),
    [defaultServiceSchedule, scheduledTime, selectedServiceRows, serviceSchedules],
  );
  const selectedServicesPricing = useMemo(() => {
    const servicesTotal = hasVariablePricingWithoutSqft
      ? 0
      : Array.from(selectedServiceIds).reduce((sum, id) => {
        const service = availableServices.find((candidate) => candidate.id?.toString() === id);
        return sum + (service ? getServicePrice(service) : 0);
      }, 0);
    const normalizedTaxRate = taxPercent > 1 ? taxPercent / 100 : taxPercent;
    const pricing = calculatePricingBreakdown({
      serviceSubtotal: servicesTotal,
      discountType: activeDiscountType,
      discountValue: activeDiscountValue,
      taxRate: normalizedTaxRate,
    });
    const discountLabel = pricing.discountType === 'fixed'
      ? `Discount ($${pricing.discountValue?.toFixed?.(2) ?? Number(pricing.discountValue || 0).toFixed(2)})`
      : `Discount (${Number(pricing.discountValue || 0)}%)`;
    return {
      servicesTotal,
      pricing: {
        ...pricing,
        totalQuote: addInvoiceAdjustmentToCatalogTotal(
          pricing.totalQuote,
          invoiceAdjustmentTotal,
        ),
      },
      discountLabel,
    };
  }, [
    activeDiscountType,
    activeDiscountValue,
    availableServices,
    hasVariablePricingWithoutSqft,
    invoiceAdjustmentTotal,
    selectedServiceIds,
    taxPercent,
    getServicePrice,
  ]);
  const serviceSelectionOptions = useMemo<ServiceSelectionOption[]>(
    () =>
      availableServices.map((service) => ({
        ...service,
        id: String(service.id),
        description: (service as { description?: string }).description || '',
        price: getServicePrice(service),
      })),
    [availableServices, getServicePrice],
  );
  const selectedServiceSelectionOptions = useMemo<ServiceSelectionOption[]>(
    () =>
      selectedServiceRows.map(({ id, service }) => ({
        ...service,
        id,
        description: (service as { description?: string }).description || '',
        price: getServicePrice(service),
      })),
    [getServicePrice, selectedServiceRows],
  );
  const handleSelectedServicesChange = (services: ServiceSelectionOption[]) => {
    setSelectedServiceIds(new Set(services.map((service) => String(service.id))));
  };
  const buildScheduledAtIso = (dateValue?: string, timeValue?: string): string | null => {
    return buildWallClockIso(dateValue, timeValue);
  };
  return { isOpen, onClose, shootId, onSaved, toast, user, isSubmitting, setIsSubmitting, isLoading, setIsLoading, shootDetails, setShootDetails, availableServices, setAvailableServices, photographers, setPhotographers, photographerPickerOpen, setPhotographerPickerOpen, photographerPickerContext, setPhotographerPickerContext, pickerPhotographerId, setPickerPhotographerId, photographerSearchQuery, setPhotographerSearchQuery, sortBy, setSortBy, showAllPhotographers, setShowAllPhotographers, expandedServiceScheduleId, setExpandedServiceScheduleId, servicesEditorOpen, setServicesEditorOpen, userRole, isAdmin, isRep, isAdminOrRep, address, setAddress, city, setCity, state, setState, zip, setZip, scheduledDate, setScheduledDate, scheduledTime, setScheduledTime, alternateDate, setAlternateDate, alternateTime, setAlternateTime, selectedServiceIds, setSelectedServiceIds, serviceSchedules, setServiceSchedules, photographerId, setPhotographerId, perCategoryPhotographers, setPerCategoryPhotographers, photographerAvailability, setPhotographerAvailability, isLoadingPhotographerAvailability, setIsLoadingPhotographerAvailability, editDayAvailability, setEditDayAvailability, scheduleError, setScheduleError, shootNotes, setShootNotes, companyNotes, setCompanyNotes, photographerNotes, setPhotographerNotes, editorNotes, setEditorNotes, showInternalNotes, companyNotesOpen, setCompanyNotesOpen, photographerNotesOpen, setPhotographerNotesOpen, editorNotesOpen, setEditorNotesOpen, propertyDetails, setPropertyDetails, propertySqft, setPropertySqft, taxPercent, setTaxPercent, activeMobilePanel, setActiveMobilePanel, isDesktopLayout, clearAddressDerivedState, handleAddressSelect, getServicePrice, hasVariablePricingWithoutSqft, clientName, clientEmail, clientPhone, clientVerified, activeDiscountType, activeDiscountValue, photographerEmail, availableServiceCategoryGroups, selectedServiceCategoryGroups, hasMultiplePhotographerCategories, resolvePhotographerDetails, filteredPhotographers, formatPhotographerLocationLabel, isEditTimeDisabled, openPhotographerPicker, closePhotographerPicker, handleConfirmPhotographerPicker, handleClearPhotographerPicker, buildApprovalPayload, canNotifyClient, notificationPhotographerId, canNotifyPhotographer, submitApproval, handleApprove, handleApproveWithoutNotification, normalizeTimeValue, buildTimeOptions, timeOptions, setTimeOptions, minSelectableDate, scheduledDateInputValue, defaultServiceSchedule, selectedServiceRows, updateServiceSchedule, getServiceScheduleDateLabel, getServiceScheduleTimeLabel, getServiceScheduleSummary, sortedServiceScheduleRows, selectedServicesPricing, serviceSelectionOptions, selectedServiceSelectionOptions, handleSelectedServicesChange, buildScheduledAtIso };
}
