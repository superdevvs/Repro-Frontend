import React, { useEffect, useRef, useState } from 'react';
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
import { asRecord, toDateInputValue } from './bookShootModel';

type BookShootWorkflowOptions = {
  user: ReturnType<typeof useAuth>['user'];
  isClientAccount: boolean;
  clientIdFromUrl: string | null;
  clientNameFromUrl: string | null;
  clientCompanyFromUrl: string | null;
  editShootId: string | null;
  canAdjustBookingAmount: boolean;
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
  const [editShootLoading, setEditShootLoading] = useState(false);
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
  const [shootType, setShootType] = useState<InternalShootType>('standard');
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetailsData | null>(null);
  const [propertySqft, setPropertySqft] = useState<number | null>(null);
  const handleSelectedServicesChange = (services: ServicePackage[]) => {
    setSelectedServices(services);
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
  };
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
          setSelectedServices(parsed.selectedServices);
        }
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
            pricing_type: pkg.pricing_type === 'variable' ? 'variable' : 'fixed',
            allow_multiple: Boolean(pkg.allow_multiple),
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
      const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) { setAvailablePhotographerIds([]); setAvailabilityChecked(true); return; }
      let hhNum = parseInt(match[1], 10);
      const mmNum = parseInt(match[2], 10);
      const mer = match[3].toUpperCase();
      if (mer === 'PM' && hhNum !== 12) hhNum += 12;
      if (mer === 'AM' && hhNum === 12) hhNum = 0;
      const hh = String(hhNum).padStart(2, '0');
      const mm = String(mmNum).padStart(2, '0');
      const start_time = `${hh}:${mm}`;
      const d = new Date(date);
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const day = String(d.getDate()).padStart(2,'0');
      const fmtDate = `${y}-${m}-${day}`;
      console.debug('[Availability] Checking start-time only', { fmtDate, start_time, totalPhotographers: photographers?.length || 0 });
      const startDateTmp = new Date(2000, 0, 1, Number(hh), Number(mm), 0);
      const endDateTmp = new Date(startDateTmp.getTime() + 30 * 60 * 1000);
      const endH = String(endDateTmp.getHours()).padStart(2, '0');
      const endM = String(endDateTmp.getMinutes()).padStart(2, '0');
      const end_time = `${endH}:${endM}`;
      try {
        if (!photographers || photographers.length === 0) { setAvailablePhotographerIds([]); return; }
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const allTimesSet = new Set<string>();
        const checks = await Promise.all(
          photographers.map(async (p) => {
            try {
              const res = await fetch(API_ROUTES.photographerAvailability.check, {
                method: "POST",
                headers,
                body: JSON.stringify({ photographer_id: p.id, date: fmtDate })
              });
              if (!res.ok) return false;
              const json = await res.json();
              const rows = (Array.isArray(json?.data) ? json.data : []).map(asRecord);
              rows.forEach(r => {
                if ((r?.status ?? 'available') !== 'unavailable') {
                  const raw = (r?.start_time ?? '').toString();
                  const norm = raw.includes(':') ? raw.slice(0,5) : raw; // normalize HH:mm[:ss] -> HH:mm
                  if (norm) allTimesSet.add(norm);
                }
              });
              const match = rows.some(r => {
                const raw = (r?.start_time ?? '').toString();
                const rowStart = raw.includes(':') ? raw.slice(0,5) : raw; // normalize HH:mm[:ss] -> HH:mm
                return (r?.status ?? 'available') !== 'unavailable' && rowStart === start_time;
              });
              console.debug('[Availability] Photographer', p.id, 'rows:', rows, 'start_time:', start_time, 'match:', match);
              return match;
            } catch {
              return false;
            }
          })
        );
        const ids = photographers.filter((_, idx) => checks[idx]).map(p => String(p.id));
        setAvailablePhotographerIds(ids);
        console.debug('[Availability] Available photographer IDs:', ids);
        const role = user?.role;
        if (role === 'client' && date && time && ids.length === 0) {
          const alternatives = Array.from(allTimesSet).filter(t => t !== start_time).sort();
          const top = alternatives.slice(0, 4).map(to12Hour).join(', ');
          const desc = top
            ? `No one at ${to12Hour(start_time)}. Other times today: ${top}`
            : 'No photographers available at the selected time. You can proceed without selecting a photographer.';
          toast({ title: 'No photographers available', description: desc });
        }
      } catch {
        setAvailablePhotographerIds([]);
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
        if (shootData) {
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
          if (shootData.scheduled_at || shootData.scheduledAt) {
            const scheduledDate = new Date(shootData.scheduled_at || shootData.scheduledAt);
            if (!isNaN(scheduledDate.getTime())) {
              setDate(scheduledDate);
              let hours = scheduledDate.getHours();
              const minutes = scheduledDate.getMinutes().toString().padStart(2, '0');
              const ampm = hours >= 12 ? 'PM' : 'AM';
              hours = hours % 12 || 12;
              setTime(`${hours}:${minutes} ${ampm}`);
            }
          }
          if (shootData.services && Array.isArray(shootData.services) && packages.length > 0) {
            const matchedServices = shootData.services
              .map((value: unknown) => {
                const svc = asRecord(value);
                const serviceId = svc.id !== undefined ? String(svc.id) : svc.service_id !== undefined ? String(svc.service_id) : undefined;
                return packages.find(pkg => pkg.id === serviceId);
              })
              .filter(Boolean) as ServicePackage[];
            if (matchedServices.length > 0) {
              setSelectedServices(matchedServices);
            }
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
              if (svcId && scheduledValue) {
                const serviceDate = new Date(scheduledValue);
                if (!Number.isNaN(serviceDate.getTime())) {
                  svcSchedules[svcId] = {
                    date: toDateInputValue(serviceDate),
                    time: `${String(serviceDate.getHours()).padStart(2, '0')}:${String(serviceDate.getMinutes()).padStart(2, '0')}`,
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
    isEditMode, setIsEditMode, editShootLoading, packages, setPackages, packagesLoading,
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
