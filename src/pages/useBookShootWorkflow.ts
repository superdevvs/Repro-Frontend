import React, { useEffect, useRef, useState } from 'react';
import { resolveShootDuration } from '@/utils/shootDuration';
import { useToast } from '@/hooks/use-toast';
import { useShoots } from '@/context/shootsContextState';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import type { Client } from '@/types/clients';
import { initialClientsData } from '@/data/clientsData';
import type { useAuth } from '@/components/auth/AuthProvider';
import type { InternalShootType } from '@/components/booking/ClientPropertyForm';
import type { ShootData } from '@/types/shoots';
import axios from 'axios';
import API_ROUTES from '@/lib/api';
import { bookingTimeToMinutes, normalizeSlotClock } from './bookShootAvailabilityMatch';
import { API_BASE_URL } from '@/config/env';
import { normalizeState, isValidState } from '@/utils/stateUtils';
import { normalizeEmailHealth } from '@/utils/emailHealth';
import {
  BOOKING_FORM_CACHE_KEY,
  createInitialBookingDraftState,
  clearBookingFormCache,
} from '@/utils/bookingDraftReset';
import type {
  CompletedBookingSnapshot,
  PropertyDetailsData,
  ServicePackage,
  ServiceScheduleMap,
} from './bookShootModel';
import { asRecord } from './bookShootModel';
import { isBookingTimeAvailable } from './bookShootAvailability';
import { hydrateBookedServiceSelection, restoreCachedServiceQuantities } from './bookShootServiceSelection';
import { serviceRequiresPhotographer, syncPhotographerRequiredFromCatalog } from '@/utils/photographerAssignment';
import { getShootSchedule } from '@/utils/shootSchedule';
import { parseLocalYmd } from '@/utils/shootLocalDate';
import { formatTimeForDisplay } from '@/utils/availabilityUtils';
import { emptyMultiUnitDraft, hydrateUnitDraft, type MultiUnitDraft } from '@/features/shoot-units/model';
import { format } from 'date-fns';

type BookShootWorkflowOptions = {
  user: ReturnType<typeof useAuth>['user'];
  isClientAccount: boolean;
  clientIdFromUrl: string | null;
  clientNameFromUrl: string | null;
  clientCompanyFromUrl: string | null;
  editShootId: string | null;
  canAdjustBookingAmount: boolean;
};

type EditingScheduleSource = {
  units_revision?: number;
  timezone?: string | null;
  scheduled_at?: string;
  scheduledAt?: string;
  start_time?: string;
  serviceItems?: unknown;
  service_items?: unknown;
  serviceObjects?: unknown;
  services?: unknown;
};

export const useBookShootWorkflow = ({
  user,
  isClientAccount,
  clientIdFromUrl,
  clientNameFromUrl,
  clientCompanyFromUrl,
  editShootId,
  canAdjustBookingAmount,
}: BookShootWorkflowOptions) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingScheduleSource, setEditingScheduleSource] = useState<EditingScheduleSource | null>(null);
  const [editShootLoading, setEditShootLoading] = useState(false);
  const [canRemoveAllServicesForEdit, setCanRemoveAllServicesForEdit] = useState(false);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [client, setClient] = useState(() => {
    if (user && user.role === 'client' && user.metadata) {
      return user.metadata.clientId ?? '';
    }
    return clientIdFromUrl || '';
  });
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('');
  const [photographer, setPhotographer] = useState('');
  const [servicePhotographers, setServicePhotographers] = useState<Record<string, string>>({});
  const [serviceSchedules, setServiceSchedules] = useState<ServiceScheduleMap>({});
  const [selectedServices, setSelectedServices] = useState<ServicePackage[]>([]);
  const [multiUnitDraft, setMultiUnitDraft] = useState<MultiUnitDraft>(emptyMultiUnitDraft);
  const [shootType, setShootType] = useState<InternalShootType>('standard');
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetailsData | null>(null);
  const [propertySqft, setPropertySqft] = useState<number | null>(null);
  const handleSelectedServicesChange = React.useCallback((services: ServicePackage[]) => {
    setSelectedServices(syncPhotographerRequiredFromCatalog(services, packages));
    setServicePhotographers(prev => {
      const currentServiceIds = new Set(services.map(s => s.id));
      const next: Record<string, string> = {};
      for (const [svcId, photogId] of Object.entries(prev)) {
        if (currentServiceIds.has(svcId)) {
          next[svcId] = photogId;
        }
      }
      return next;
    });
    setServiceSchedules(prev => {
      const currentServiceIds = new Set(services.map(s => s.id));
      const next: ServiceScheduleMap = {};
      for (const [svcId, schedule] of Object.entries(prev)) {
        if (currentServiceIds.has(svcId)) {
          next[svcId] = schedule;
        }
      }
      return next;
    });
  }, [packages]);
  React.useEffect(() => {
    if (packages.length === 0 || selectedServices.length === 0) {
      return;
    }
    const synced = syncPhotographerRequiredFromCatalog(selectedServices, packages);
    if (synced.some((service, index) => service.photographer_required !== selectedServices[index].photographer_required)) {
      setSelectedServices(synced);
    }
  }, [packages, selectedServices]);
  const handleShootTypeChange = (nextType: InternalShootType) => {
    setShootType(nextType);
    if (nextType !== 'standard') {
      setBypassPayment(true);
      setAdjustedTotalInput('0.00');
    }
  };
  const [notes, setNotes] = useState('');
  const [companyNotes, setCompanyNotes] = useState('');
  const [photographerNotes, setPhotographerNotes] = useState('');
  const [editorNotes, setEditorNotes] = useState('');
  const [bypassPayment, setBypassPayment] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [adjustedTotalInput, setAdjustedTotalInput] = useState('');
  const [step, setStep] = useState(1);
  const [isComplete, setIsComplete] = useState(false);
  const [completedBooking, setCompletedBooking] = useState<CompletedBookingSnapshot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateLocationDialogOpen, setDuplicateLocationDialogOpen] = useState(false);
  const [createdShootId, setCreatedShootId] = useState<string | number | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [clientPropertyFormKey, setClientPropertyFormKey] = useState(0);
  const { toast } = useToast();
  const { addShoot, shoots } = useShoots();
  const navigate = useNavigate();
  const [photographers, setPhotographersList] = useState<Array<{ id: string; name: string; avatar?: string }>>([]);
  const [availablePhotographerIds, setAvailablePhotographerIds] = useState<string[]>([]);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const to12Hour = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
    const mer = h >= 12 ? 'PM' : 'AM';
    const dh = h % 12 === 0 ? 12 : h % 12;
    return `${dh}:${String(m).padStart(2, '0')} ${mer}`;
  };
  const { fetchShoots } = useShoots();
  const shouldCacheForm = user && ['admin', 'superadmin', 'rep', 'photographer'].includes(user.role);
  const CACHE_KEY = BOOKING_FORM_CACHE_KEY;
  const hasRestoredRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const [hasCachedData, setHasCachedData] = useState(false);
  const clearBookingDraftState = React.useCallback(() => {
    const initial = createInitialBookingDraftState<ServicePackage, ServiceScheduleMap>();
    if (!isClientAccount) {
      setClient(initial.client);
    }
    setAddress(initial.address);
    setCity(initial.city);
    setState(initial.state);
    setZip(initial.zip);
    setDate(initial.date);
    setTime(initial.time);
    setPhotographer(initial.photographer);
    setServicePhotographers(initial.servicePhotographers);
    setServiceSchedules(initial.serviceSchedules);
    setSelectedServices(initial.selectedServices);
    setMultiUnitDraft(emptyMultiUnitDraft());
    setShootType('standard');
    setNotes(initial.notes);
    setCompanyNotes(initial.companyNotes);
    setPhotographerNotes(initial.photographerNotes);
    setEditorNotes(initial.editorNotes);
    setBypassPayment(initial.bypassPayment);
    setSendNotification(initial.sendNotification);
    setAdjustedTotalInput(initial.adjustedTotalInput);
    setStep(initial.step);
    setPropertyDetails(initial.propertyDetails ? asRecord(initial.propertyDetails) : null);
    setPropertySqft(initial.propertySqft);
    setFormErrors(initial.formErrors);
    setHasCachedData(false);
    setClientPropertyFormKey((prev) => prev + 1);
  }, [isClientAccount]);
  useEffect(() => {
    if (!shouldCacheForm) {
      setHasCachedData(false);
      return;
    }
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      setHasCachedData(!!cachedData);
    } catch (error) {
      setHasCachedData(false);
    }
  }, [CACHE_KEY, shouldCacheForm, client, address, city, state, zip, date, time, photographer, selectedServices, notes, companyNotes, photographerNotes, editorNotes, bypassPayment, sendNotification, adjustedTotalInput, step, propertyDetails]);
  useEffect(() => {
    if (!user) return;
    if (!shouldCacheForm || hasRestoredRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    hasRestoredRef.current = true;
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (typeof parsed.client === 'string' && !isClientAccount) {
          setClient(parsed.client);
        }
        if (typeof parsed.address === 'string') setAddress(parsed.address);
        if (typeof parsed.city === 'string') setCity(parsed.city);
        if (typeof parsed.state === 'string') setState(parsed.state);
        if (typeof parsed.zip === 'string') setZip(parsed.zip);
        if (parsed.date) {
          const restoredDate = new Date(parsed.date);
          if (!isNaN(restoredDate.getTime())) {
            setDate(restoredDate);
          }
        }
        if (typeof parsed.time === 'string') setTime(parsed.time);
        if (typeof parsed.photographer === 'string') setPhotographer(parsed.photographer);
        if (parsed.servicePhotographers) setServicePhotographers(parsed.servicePhotographers);
        if (parsed.serviceSchedules) setServiceSchedules(parsed.serviceSchedules);
        if (parsed.selectedServices && Array.isArray(parsed.selectedServices)) {
          setSelectedServices(restoreCachedServiceQuantities(parsed.selectedServices, parsed.bookingQuantityVersion));
        }
        if (parsed.multiUnitDraft?.enabled && Array.isArray(parsed.multiUnitDraft.units) && Array.isArray(parsed.multiUnitDraft.lines)) setMultiUnitDraft(parsed.multiUnitDraft);
        if (typeof parsed.notes === 'string') setNotes(parsed.notes);
        if (typeof parsed.companyNotes === 'string') setCompanyNotes(parsed.companyNotes);
        if (typeof parsed.photographerNotes === 'string') setPhotographerNotes(parsed.photographerNotes);
        if (typeof parsed.editorNotes === 'string') setEditorNotes(parsed.editorNotes);
        if (parsed.bypassPayment !== undefined) setBypassPayment(parsed.bypassPayment);
        if (parsed.sendNotification !== undefined) setSendNotification(parsed.sendNotification);
        if (typeof parsed.adjustedTotalInput === 'string') setAdjustedTotalInput(parsed.adjustedTotalInput);
        if (Object.prototype.hasOwnProperty.call(parsed, 'propertyDetails')) {
          setPropertyDetails(parsed.propertyDetails);
        }
        if (parsed.propertySqft !== undefined && parsed.propertySqft !== null) {
          setPropertySqft(Number(parsed.propertySqft));
        } else if (parsed.propertyDetails) {
          const derivedSqft =
            parsed.propertyDetails?.sqft ??
            parsed.propertyDetails?.livingArea ??
            null;
          setPropertySqft(derivedSqft ? Number(derivedSqft) : null);
        }
        setClientPropertyFormKey((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Error restoring form data from cache:', error);
    }
    setTimeout(() => {
      isInitialMountRef.current = false;
    }, 1000);
  }, [CACHE_KEY, user, shouldCacheForm, isClientAccount]);
  useEffect(() => {
    if (!shouldCacheForm || !user) return;
    if (isInitialMountRef.current) return;
    try {
      const formData = {
        multiUnitDraft,
        client,
        address,
        city,
        state,
        zip,
        date: date ? date.toISOString() : null,
        time,
        photographer,
        servicePhotographers,
        serviceSchedules,
        selectedServices,
        bookingQuantityVersion: 1,
        notes,
        companyNotes,
        photographerNotes,
        editorNotes,
        bypassPayment,
        sendNotification,
        adjustedTotalInput: canAdjustBookingAmount ? adjustedTotalInput : '',
        step,
        propertyDetails,
        propertySqft,
      };
      const isDraftEmpty =
        !multiUnitDraft.enabled &&
        (!client || isClientAccount) &&
        !address &&
        !city &&
        !state &&
        !zip &&
        !date &&
        !time &&
        !photographer &&
        Object.keys(servicePhotographers).length === 0 &&
        Object.keys(serviceSchedules).length === 0 &&
        selectedServices.length === 0 &&
        !notes &&
        !companyNotes &&
        !photographerNotes &&
        !editorNotes &&
        !bypassPayment &&
        sendNotification &&
        !adjustedTotalInput &&
        step === 1 &&
        !propertyDetails &&
        (propertySqft === null || propertySqft === undefined);
      if (isDraftEmpty) {
        localStorage.removeItem(CACHE_KEY);
        setHasCachedData(false);
        return;
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(formData));
      setHasCachedData(true);
    } catch (error) {
      console.error('Error saving form data to cache:', error);
    }
  }, [
    multiUnitDraft,
    CACHE_KEY,
    shouldCacheForm,
    user,
    isClientAccount,
    canAdjustBookingAmount,
    client,
    address,
    city,
    state,
    zip,
    date,
    time,
    photographer,
    servicePhotographers,
    serviceSchedules,
    selectedServices,
    notes,
    companyNotes,
    photographerNotes,
    editorNotes,
    bypassPayment,
    sendNotification,
    adjustedTotalInput,
    step,
    propertyDetails,
    propertySqft,
  ]);
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error("No auth token found in localStorage");
        }
        const response = await axios.get(`${API_BASE_URL}/api/admin/clients`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const clientsData = (Array.isArray(response.data?.data) ? response.data.data : []).map((value: unknown) => {
          const client = asRecord(value);
          let repName: string | undefined = undefined;
          if (client.rep) {
            const rep = asRecord(client.rep);
            if (typeof rep.name === 'string') {
              repName = rep.name;
            } else if (typeof client.rep === 'string') {
              repName = client.rep;
            }
          }
          const metadata = asRecord(client.metadata);
          const metadataRepName =
            typeof metadata.accountRep === 'string'
              ? metadata.accountRep
              : typeof metadata.rep === 'string'
                ? metadata.rep
                : undefined;
          const createdByNameRaw = client.created_by_name || client.createdBy || '';
          const createdByName = typeof createdByNameRaw === 'string' ? createdByNameRaw : '';
          const canUseCreatedBy = createdByName && createdByName.toLowerCase() !== 'superadmin';
          if (!repName) {
            repName =
              metadataRepName ||
              (typeof client.accountRep === 'string' ? client.accountRep : undefined) ||
              (typeof client.rep_name === 'string' ? client.rep_name : undefined) ||
              (typeof client.sales_rep === 'string' ? client.sales_rep : undefined) ||
              (typeof client.salesRep === 'string' ? client.salesRep : undefined) ||
              (canUseCreatedBy ? createdByName : undefined);
          }
          return {
            ...client,
            id: String(client.id ?? ''),
            email_health: normalizeEmailHealth(client.email_health),
            companyNotes: client.companyNotes ?? client.company_notes ?? '',
            shootCcEmails: client.shootCcEmails ?? client.shoot_cc_emails ?? [],
            shoot_cc_emails: client.shoot_cc_emails ?? client.shootCcEmails ?? [],
            clientDiscountType: client.clientDiscountType ?? client.client_discount_type ?? null,
            client_discount_type: client.client_discount_type ?? client.clientDiscountType ?? null,
            clientDiscountValue: client.clientDiscountValue ?? client.client_discount_value ?? null,
            client_discount_value: client.client_discount_value ?? client.clientDiscountValue ?? null,
            service_groups: Array.isArray(client.service_groups)
              ? client.service_groups.map((value: unknown) => {
                  const group = asRecord(value);
                  return {
                    id: String(group.id ?? ''),
                    name: String(group.name ?? ''),
                    description: String(group.description ?? ''),
                  };
                })
              : [],
            service_group_ids: Array.isArray(client.service_group_ids)
              ? client.service_group_ids.map((id: unknown) => String(id))
              : [],
            rep: repName,
            repObject: client.rep,
          };
        });
        setClients(clientsData);
      } catch (error) {
        console.error("Error fetching clients:", error);
        toast({
          title: "Failed to load clients",
          description: "There was an error loading clients from the server.",
          variant: "destructive"
        });
      }
    };
    if (!isClientAccount) {
      fetchClients();
    }
  }, [isClientAccount, toast]);
  useEffect(() => {
    const fetchPhotographers = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await axios.get(API_ROUTES.people.adminPhotographers, { headers });
        const data = response.data?.data || response.data || [];
        const formatted = Array.isArray(data) ? data.map((value: unknown) => {
          const photographer = asRecord(value);
          return {
            ...photographer,
            id: String(photographer.id ?? ''),
            name: String(photographer.name || 'Unknown'),
            avatar: String(photographer.avatar || photographer.profile_image || photographer.profile_photo_url || ''),
          };
        }) : [];
        if (formatted.length > 0) {
          setPhotographersList(formatted);
          console.debug('[BookShoot] Loaded photographers from admin endpoint:', formatted.length);
          return;
        }
      } catch (error) {
        console.warn('Admin photographers endpoint failed, falling back to public list:', error);
      }
      try {
        const res2 = await axios.get(API_ROUTES.people.photographers);
        const data2 = res2.data?.data || res2.data || [];
        const formatted2 = Array.isArray(data2) ? data2.map((value: unknown) => {
          const photographer = asRecord(value);
          return {
            ...photographer,
            id: String(photographer.id ?? ''),
            name: String(photographer.name || 'Unknown'),
            avatar: String(photographer.avatar || photographer.profile_image || photographer.profile_photo_url || ''),
          };
        }) : [];
        setPhotographersList(formatted2);
        console.debug('[BookShoot] Loaded photographers from public endpoint:', formatted2.length);
      } catch (err2) {
        console.error('Public photographers endpoint also failed:', err2);
        setPhotographersList([]);
      }
    };
    fetchPhotographers();
  }, []);
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setPackagesLoading(true);
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/services`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const packageData: ServicePackage[] = (Array.isArray(response.data?.data) ? response.data.data : []).map((value: unknown) => {
          const pkg = asRecord(value);
          const category = asRecord(pkg.category);
          return {
            id: String(pkg.id ?? ''),
            name: String(pkg.name ?? ''),
            description: String(pkg.description ?? ''),
            price: Number(pkg.price ?? 0),
            delivery_time: pkg.delivery_time == null ? null : Number(pkg.delivery_time),
            shoot_duration_minutes: pkg.shoot_duration_minutes == null ? null : Number(pkg.shoot_duration_minutes),
            duration_minutes: pkg.duration_minutes == null ? null : Number(pkg.duration_minutes),
            booking_duration_default_minutes: pkg.booking_duration_default_minutes == null ? null : Number(pkg.booking_duration_default_minutes),
            booking_duration_min_minutes: pkg.booking_duration_min_minutes == null ? null : Number(pkg.booking_duration_min_minutes),
            booking_duration_max_minutes: pkg.booking_duration_max_minutes == null ? null : Number(pkg.booking_duration_max_minutes),
            booking_duration_defaults: pkg.booking_duration_defaults as ServicePackage['booking_duration_defaults'],
            pricing_type: pkg.pricing_type === 'variable' ? 'variable' : 'fixed',
            allow_multiple: Boolean(pkg.allow_multiple),
            photographer_required: serviceRequiresPhotographer({
              photographer_required: pkg.photographer_required as boolean | null | undefined,
            }),
            photographer_pay: pkg.photographer_pay === null || pkg.photographer_pay === undefined
              ? null
              : Number(pkg.photographer_pay),
            exclude_from_sales_commission: Boolean(pkg.exclude_from_sales_commission),
            sqft_ranges: Array.isArray(pkg.sqft_ranges) ? pkg.sqft_ranges : Array.isArray(pkg.sqftRanges) ? pkg.sqftRanges : [],
            category: pkg.category ? { id: String(category.id ?? ''), name: String(category.name ?? 'Other') } : undefined,
            service_groups: Array.isArray(pkg.service_groups)
              ? pkg.service_groups.map((groupValue: unknown) => {
                  const group = asRecord(groupValue);
                  return { id: String(group.id ?? ''), name: String(group.name ?? ''), description: String(group.description ?? '') };
                })
              : [],
            service_group_ids: Array.isArray(pkg.service_group_ids)
              ? pkg.service_group_ids.map((id: unknown) => String(id))
              : [],
          };
        });
        setPackages(packageData);
      } catch (error) {
        console.error("Error fetching packages:", error);
        toast({
          title: "Failed to load packages",
          description: "There was an error loading available services.",
          variant: "destructive"
        });
      } finally {
        setPackagesLoading(false);
      }
    };
    fetchPackages();
  }, [toast]);
  useEffect(() => {
    const fetchAvailable = async () => {
      setAvailabilityChecked(false);
      if (isClientAccount || String(user?.role ?? '').toLowerCase() === 'client') {
        // The client picker is hydrated by the privacy-safe `/for-booking` request in
        // `useSchedulingFormController`. Do not probe the protected per-photographer
        // availability endpoint here; keep the base list available for that picker.
        setAvailablePhotographerIds((photographers ?? []).map((p) => String(p.id)));
        setAvailabilityChecked(true);
        return;
      }
      if (!date || !time) { setAvailablePhotographerIds([]); setAvailabilityChecked(true); return; }
      const bookingStartMinutes = bookingTimeToMinutes(time);
      if (bookingStartMinutes === null) {
        // Unknown time shape — keep full list (fail open) instead of blanking the picker.
        console.warn('[Availability] Unrecognized time format; keeping full photographer list', time);
        setAvailablePhotographerIds((photographers ?? []).map((p) => String(p.id)));
        setAvailabilityChecked(true);
        return;
      }
      const hh = String(Math.floor(bookingStartMinutes / 60)).padStart(2, '0');
      const mm = String(bookingStartMinutes % 60).padStart(2, '0');
      const start_time = `${hh}:${mm}`;
      // Local civil date (date-fns format) — avoid UTC day-shift from toISOString()/Date-only parsing.
      const fmtDate = format(date instanceof Date ? date : new Date(date), 'yyyy-MM-dd');
      console.debug('[Availability] Checking within-window coverage', { fmtDate, start_time, totalPhotographers: photographers?.length || 0 });
      try {
        if (!photographers || photographers.length === 0) { setAvailablePhotographerIds([]); return; }
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const allTimesSet = new Set<string>();
        // Prefer one bulk-index call over N /availability/check posts (those 500 on cache ownership).
        const photographerIds = photographers.map((p) => Number(p.id)).filter(Number.isFinite);
        const res = await fetch(API_ROUTES.photographerAvailability.bulkIndex, {
          method: "POST",
          headers,
          body: JSON.stringify({
            photographer_ids: photographerIds,
            from_date: fmtDate,
            to_date: fmtDate,
          }),
        });
        if (!res.ok) {
          console.warn('[Availability] bulkIndex failed; keeping full photographer list', res.status);
          setAvailablePhotographerIds(photographers.map((p) => String(p.id)));
          return;
        }
        const json = await res.json();
        const byPhotographer = asRecord(json?.data);
        const dayName = new Date(`${fmtDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const ids = photographers.filter((p) => {
          const rawSlots = byPhotographer[String(p.id)] ?? byPhotographer[p.id as unknown as string] ?? [];
          const rows = (Array.isArray(rawSlots) ? rawSlots : []).map(asRecord);
          const specific = rows.filter((r) => String(r?.date ?? '').slice(0, 10) === fmtDate);
          const weekly = rows.filter((r) => !r?.date && String(r?.day_of_week ?? '').toLowerCase() === dayName);
          const relevant = specific.length > 0 ? specific : weekly;
          relevant.forEach((r) => {
            if ((r?.status ?? 'available') === 'available') {
              const norm = normalizeSlotClock(r?.start_time);
              if (norm) allTimesSet.add(norm);
            }
          });
          return isBookingTimeAvailable(start_time, relevant);
        }).map((p) => String(p.id));
        setAvailablePhotographerIds(ids);
        console.debug('[Availability] Available photographer IDs (bulk):', ids);
        const role = user?.role;
        if (role === 'client' && date && time && ids.length === 0) {
          const alternatives = Array.from(allTimesSet).filter(t => t !== start_time).sort();
          const top = alternatives.slice(0, 4).map(to12Hour).join(', ');
          const desc = top
            ? `No one at ${to12Hour(start_time)}. Other times today: ${top}`
            : 'No photographers available at the selected time. You can proceed without selecting a photographer.';
          toast({ title: 'No photographers available', description: desc });
        }
      } catch (error) {
        console.warn('[Availability] bulk availability failed; keeping full photographer list', error);
        setAvailablePhotographerIds((photographers ?? []).map((p) => String(p.id)));
      } finally {
        setAvailabilityChecked(true);
      }
    };
    fetchAvailable();
  }, [date, time, photographers, toast, user?.role, isClientAccount]);
  useEffect(() => {
    if (clientIdFromUrl && clientNameFromUrl) {
      setClient(clientIdFromUrl);
      toast({
        title: "Client Selected",
        description: `${decodeURIComponent(clientNameFromUrl)}${clientCompanyFromUrl ? ` (${decodeURIComponent(clientCompanyFromUrl)})` : ''} has been selected for this shoot.`,
        variant: "default",
      });
    }
  }, [clientIdFromUrl, clientNameFromUrl, clientCompanyFromUrl, toast]);
  useEffect(() => {
    const fetchShootForEdit = async () => {
      if (!editShootId) return;
      setEditShootLoading(true);
      setIsEditMode(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/shoots/${editShootId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const shootData = response.data?.data || response.data;
        setEditingScheduleSource(shootData || null);
        if (shootData) {
          setMultiUnitDraft(hydrateUnitDraft(shootData));
          setCanRemoveAllServicesForEdit(Boolean(
            shootData.canRemoveAllServices ?? shootData.can_remove_all_services,
          ));
          setClient(shootData.client_id?.toString() || shootData.client?.id?.toString() || '');
          setAddress(shootData.address || shootData.location?.address || '');
          setCity(shootData.city || shootData.location?.city || '');
          setState(shootData.state || shootData.location?.state || '');
          setZip(shootData.zip || shootData.location?.zip || '');
          setNotes(shootData.shoot_notes || shootData.notes || '');
          setCompanyNotes(shootData.company_notes || '');
          setPhotographerNotes(shootData.photographer_notes || '');
          setEditorNotes(shootData.editor_notes || '');
          if (shootData.photographer_id) {
            setPhotographer(shootData.photographer_id.toString());
          }
          const orderSchedule = getShootSchedule(shootData);
          if (orderSchedule.date) setDate(parseLocalYmd(orderSchedule.date));
          if (orderSchedule.time) setTime(formatTimeForDisplay(orderSchedule.time));
          if (shootData.services && Array.isArray(shootData.services) && packages.length > 0) {
            const matchedServices = hydrateBookedServiceSelection(packages, shootData);
            // An empty service list is a valid Admin/Super Admin edit state and
            // must replace any cached/new-booking selection instead of leaving a
            // phantom service selected locally.
            setSelectedServices(matchedServices);
            const svcPhotographers: Record<string, string> = {};
            const svcSchedules: ServiceScheduleMap = {};
            const serviceRows = Array.isArray(shootData.serviceItems)
              ? shootData.serviceItems
              : Array.isArray(shootData.service_items)
                ? shootData.service_items
                : shootData.services;
            for (const svc of serviceRows) {
              const svcId = (svc.service_id || svc.serviceId || svc.id)?.toString();
              const svcPhotographerId = (svc.photographer_id || svc.resolved_photographer_id)?.toString();
              if (svcId && svcPhotographerId) {
                svcPhotographers[svcId] = svcPhotographerId;
              }
              const scheduledValue = svc.scheduled_at || svc.scheduledAt;
              if (svcId && Number(svc.duration_minutes) > 0) {
                svcSchedules[svcId] = { duration_minutes: resolveShootDuration(svc.duration_minutes) };
              }
              if (svcId && scheduledValue) {
                const serviceSchedule = getShootSchedule({
                  scheduled_at: scheduledValue,
                  timezone: shootData.timezone,
                });
                if (serviceSchedule.date && serviceSchedule.time) {
                  svcSchedules[svcId] = {
                    ...svcSchedules[svcId],
                    date: serviceSchedule.date,
                    time: serviceSchedule.time,
                  };
                }
              }
            }
            if (Object.keys(svcPhotographers).length > 0) {
              setServicePhotographers(svcPhotographers);
            }
            if (Object.keys(svcSchedules).length > 0) {
              setServiceSchedules(svcSchedules);
            }
          }
          toast({
            title: "Editing Shoot Request",
            description: `Modifying shoot at ${shootData.address || shootData.location?.address || 'unknown address'}`,
          });
        }
      } catch (error) {
        setCanRemoveAllServicesForEdit(false);
        console.error('Error fetching shoot for edit:', error);
        toast({
          title: "Error loading shoot",
          description: "Could not load the shoot data for editing.",
          variant: "destructive",
        });
      } finally {
        setEditShootLoading(false);
      }
    };
    if (!packagesLoading && editShootId) {
      fetchShootForEdit();
    }
  }, [editShootId, packagesLoading, packages, toast]);
  return {
    multiUnitDraft, setMultiUnitDraft,
    isEditMode, setIsEditMode, editingScheduleSource, editShootLoading, canRemoveAllServicesForEdit, packages, setPackages, packagesLoading,
    setPackagesLoading, clients, setClients, client, setClient, address, setAddress,
    city, setCity, state, setState, zip, setZip, date, setDate, time, setTime,
    photographer, setPhotographer, servicePhotographers, setServicePhotographers,
    serviceSchedules, setServiceSchedules, selectedServices, setSelectedServices,
    shootType, setShootType, propertyDetails, setPropertyDetails, propertySqft,
    setPropertySqft, handleSelectedServicesChange, handleShootTypeChange, notes, setNotes,
    companyNotes, setCompanyNotes, photographerNotes, setPhotographerNotes, editorNotes,
    setEditorNotes, bypassPayment, setBypassPayment, sendNotification, setSendNotification,
    adjustedTotalInput, setAdjustedTotalInput, step, setStep, isComplete, setIsComplete,
    completedBooking, setCompletedBooking, isSubmitting, setIsSubmitting,
    duplicateLocationDialogOpen, setDuplicateLocationDialogOpen, createdShootId,
    setCreatedShootId, formErrors, setFormErrors, clientPropertyFormKey,
    setClientPropertyFormKey, toast, addShoot, shoots, navigate, photographers,
    setPhotographersList, availablePhotographerIds, setAvailablePhotographerIds,
    availabilityChecked, setAvailabilityChecked, to12Hour, fetchShoots, shouldCacheForm,
    CACHE_KEY, hasCachedData, clearBookingDraftState,
    setHasCachedData,
  };
};

export type BookShootWorkflow = ReturnType<typeof useBookShootWorkflow>;
