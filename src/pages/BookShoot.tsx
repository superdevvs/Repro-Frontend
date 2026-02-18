import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { BookingStepIndicator } from '@/components/booking/BookingStepIndicator';
import { BookingComplete } from '@/components/booking/BookingComplete';
import { useShoots } from '@/context/ShootsContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Client } from '@/types/clients';
import { initialClientsData } from '@/data/clientsData';
import { useAuth } from '@/components/auth/AuthProvider';
import { format } from 'date-fns';
import { BookingSummary } from '@/components/booking/BookingSummary';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { BookingContentArea } from '@/components/booking/BookingContentArea';
import { ShootData } from '@/types/shoots';
import { useIsMobile } from '@/hooks/use-mobile';
import { BookingHeader } from '@/components/booking/BookingHeader';
import { useWeatherData } from '@/hooks/useWeatherData';
import axios from 'axios';
import API_ROUTES from '@/lib/api';
import { API_BASE_URL } from '@/config/env';
import { normalizeState, isValidState } from '@/utils/stateUtils';

type SqftRange = {
  id?: number;
  sqft_from: number;
  sqft_to: number;
  duration: number | null;
  price: number;
  photographer_pay: number | null;
};

type ServicePackage = {
  id: string;
  name: string;
  price: number;
  pricing_type?: 'fixed' | 'variable';
  allow_multiple?: boolean;
  description: string;
  sqft_ranges?: SqftRange[];
  category?: {
    id: string;
    name: string;
  };
};

const normalizeAddressPart = (value?: string | null) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildNormalizedAddress = (params: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) => {
  let street = normalizeAddressPart(params.address);
  const cityPart = normalizeAddressPart(params.city);
  const statePart = normalizeAddressPart(params.state);
  const zipPart = normalizeAddressPart(params.zip);

  const trimTrailingToken = (source: string, token: string) => {
    if (!source || !token) return source;
    const pattern = new RegExp(`(?:,\\s*)?${escapeRegExp(token)}\\s*$`, 'i');
    return source.replace(pattern, '').replace(/[\s,]+$/, '').trim();
  };

  const stateZip = [statePart, zipPart].filter(Boolean).join(' ');
  street = trimTrailingToken(street, stateZip);
  street = trimTrailingToken(street, zipPart);
  street = trimTrailingToken(street, statePart);
  street = trimTrailingToken(street, cityPart);

  const locality = [cityPart, [statePart, zipPart].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const parts = [street, locality].filter(Boolean);

  return parts.join(', ');
};

const BookShoot = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { formatDate } = useUserPreferences();
  const queryParams = new URLSearchParams(location.search);
  const clientIdFromUrl = queryParams.get('clientId');
  const clientNameFromUrl = queryParams.get('clientName');
  const clientCompanyFromUrl = queryParams.get('clientCompany');
  const editShootId = queryParams.get('edit'); // For modifying existing shoot requests
  const { user, isImpersonating } = useAuth();
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
  const [selectedServices, setSelectedServices] = useState<ServicePackage[]>([]);
  const [propertyDetails, setPropertyDetails] = useState<any>(null);
  const [propertySqft, setPropertySqft] = useState<number | null>(null);

  const handleSelectedServicesChange = (services: ServicePackage[]) => {
    setSelectedServices(services);
  };
  const [notes, setNotes] = useState('');
  const [companyNotes, setCompanyNotes] = useState('');
  const [photographerNotes, setPhotographerNotes] = useState('');
  const [editorNotes, setEditorNotes] = useState('');
  const [bypassPayment, setBypassPayment] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [step, setStep] = useState(1);
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdShootId, setCreatedShootId] = useState<string | number | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { addShoot } = useShoots();
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

  // Hide body scroll on this page; rely on layout/main scroll only
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Check if user is a client (either actual client or admin impersonating a client)
  // When impersonating, user.role is already set to the target user's role
  const isClientAccount = user && (user.role as string) === 'client';
  
  // Check if user should have form data cached (admin, rep, or photographer)
  const shouldCacheForm = user && ['admin', 'superadmin', 'rep', 'photographer'].includes(user.role);
  const CACHE_KEY = 'bookShoot_form_cache';
  const hasRestoredRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const [hasCachedData, setHasCachedData] = useState(false);

  // Check if cached data exists
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
  }, [shouldCacheForm, client, address, city, state, zip, date, time, photographer, selectedServices, notes, companyNotes, photographerNotes, editorNotes, bypassPayment, sendNotification, step, propertyDetails]);

  // Restore form data from localStorage on mount (only once, when user is loaded)
  useEffect(() => {
    // Wait for user to be loaded
    if (!user) return;
    
    // Only restore if user should cache and we haven't restored yet
    if (!shouldCacheForm || hasRestoredRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    
    hasRestoredRef.current = true;

    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        
        // Restore form fields
        if (parsed.client && !isClientAccount) {
          setClient(parsed.client);
        }
        if (parsed.address) setAddress(parsed.address);
        if (parsed.city) setCity(parsed.city);
        if (parsed.state) setState(parsed.state);
        if (parsed.zip) setZip(parsed.zip);
        if (parsed.date) {
          const restoredDate = new Date(parsed.date);
          if (!isNaN(restoredDate.getTime())) {
            setDate(restoredDate);
          }
        }
        if (parsed.time) setTime(parsed.time);
        if (parsed.photographer) setPhotographer(parsed.photographer);
        if (parsed.selectedServices && Array.isArray(parsed.selectedServices)) {
          setSelectedServices(parsed.selectedServices);
        }
        if (parsed.notes) setNotes(parsed.notes);
        if (parsed.companyNotes) setCompanyNotes(parsed.companyNotes);
        if (parsed.photographerNotes) setPhotographerNotes(parsed.photographerNotes);
        if (parsed.editorNotes) setEditorNotes(parsed.editorNotes);
        if (parsed.bypassPayment !== undefined) setBypassPayment(parsed.bypassPayment);
        if (parsed.sendNotification !== undefined) setSendNotification(parsed.sendNotification);
        if (parsed.editorNotes) setEditorNotes(parsed.editorNotes);
        if (parsed.propertyDetails) setPropertyDetails(parsed.propertyDetails);
        if (parsed.propertySqft !== undefined && parsed.propertySqft !== null) {
          setPropertySqft(Number(parsed.propertySqft));
        } else if (parsed.propertyDetails) {
          const derivedSqft =
            parsed.propertyDetails?.sqft ??
            parsed.propertyDetails?.livingArea ??
            null;
          setPropertySqft(derivedSqft ? Number(derivedSqft) : null);
        }
        
        // Form data restored from cache
      }
    } catch (error) {
      console.error('Error restoring form data from cache:', error);
    }
    
    // Mark initial mount as complete after a delay to allow state updates to settle
    setTimeout(() => {
      isInitialMountRef.current = false;
    }, 1000);
  }, [user, shouldCacheForm, isClientAccount]);

  // Save form data to localStorage whenever it changes (but not during initial restore)
  useEffect(() => {
    if (!shouldCacheForm || !user) return;
    
    // Skip saving during initial mount/restore
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
        selectedServices,
        notes,
        companyNotes,
        photographerNotes,
        editorNotes,
        bypassPayment,
        sendNotification,
        step,
        propertyDetails,
        propertySqft,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(formData));
      // Form data saved to cache
    } catch (error) {
      console.error('Error saving form data to cache:', error);
    }
  }, [
    shouldCacheForm,
    user,
    client,
    address,
    city,
    state,
    zip,
    date,
    time,
    photographer,
    selectedServices,
    notes,
    companyNotes,
    photographerNotes,
    editorNotes,
    bypassPayment,
    sendNotification,
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
        const clientsData = response.data.data.map((client: any) => {
          // Extract rep name - backend returns rep as object { id, name, email } or null
          let repName: string | undefined = undefined;
          if (client.rep) {
            if (typeof client.rep === 'object' && client.rep.name) {
              repName = client.rep.name;
            } else if (typeof client.rep === 'string') {
              repName = client.rep;
            }
          }

          const metadata = client.metadata || {};
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
          
          // Client data processed from API
          
          return {
            ...client,
            id: client.id.toString(),
            companyNotes: client.companyNotes ?? client.company_notes ?? '',
            // Store rep name for easy access
            rep: repName,
            // Also keep original rep object if needed
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
        
        // Try secured list first (supports role filtering)
        const response = await axios.get(API_ROUTES.people.adminPhotographers, { headers });
        const data = response.data?.data || response.data || [];
        const formatted = Array.isArray(data) ? data.map((photographer: any) => ({
          ...photographer,
          id: photographer.id?.toString() || '',
          name: photographer.name || 'Unknown',
          avatar: photographer.avatar || photographer.profile_image || photographer.profile_photo_url,
        })) : [];
        
        if (formatted.length > 0) {
          setPhotographersList(formatted);
          console.debug('[BookShoot] Loaded photographers from admin endpoint:', formatted.length);
          return;
        }
      } catch (error) {
        console.warn('Admin photographers endpoint failed, falling back to public list:', error);
      }
      
      // Fallback to public endpoint
      try {
        const res2 = await axios.get(API_ROUTES.people.photographers);
        const data2 = res2.data?.data || res2.data || [];
        const formatted2 = Array.isArray(data2) ? data2.map((p: any) => ({ 
          ...p, 
          id: p.id?.toString() || '',
          name: p.name || 'Unknown',
          avatar: p.avatar || p.profile_image || p.profile_photo_url,
        })) : [];
        
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
        const response = await axios.get(`${API_BASE_URL}/api/services`);
        const packageData: ServicePackage[] = response.data.data.map((pkg: any) => ({
          id: pkg.id?.toString?.() ?? String(pkg.id),
          name: pkg.name,
          description: pkg.description ?? '',
          price: Number(pkg.price ?? 0),
          pricing_type: pkg.pricing_type || 'fixed',
          allow_multiple: pkg.allow_multiple ?? false,
          sqft_ranges: pkg.sqft_ranges || pkg.sqftRanges || [],
          category: pkg.category
            ? {
                id: pkg.category.id?.toString?.() ?? String(pkg.category.id),
                name: pkg.category.name ?? 'Other',
              }
            : undefined,
        }));
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
      if (!date || !time) { setAvailablePhotographerIds([]); setAvailabilityChecked(true); return; }
      // Convert UI time like "12:30 PM" to 24h HH:MM
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
      // Build a 30-minute window to increase match likelihood
      const startDateTmp = new Date(2000, 0, 1, Number(hh), Number(mm), 0);
      const endDateTmp = new Date(startDateTmp.getTime() + 30 * 60 * 1000);
      const endH = String(endDateTmp.getHours()).padStart(2, '0');
      const endM = String(endDateTmp.getMinutes()).padStart(2, '0');
      const end_time = `${endH}:${endM}`;
      try {
        // Frontend-only rule: mark available if any row starts exactly at this start_time
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
              const rows = (json?.data || []) as Array<any>;
              // collect all available start times for suggestion list
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
        // Show toast here to avoid race where a separate effect fires before IDs update
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
  }, [date, time, photographers]);



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

  // Fetch existing shoot data when in edit mode
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
          // Prefill form fields
          setClient(shootData.client_id?.toString() || shootData.client?.id?.toString() || '');
          setAddress(shootData.address || shootData.location?.address || '');
          setCity(shootData.city || shootData.location?.city || '');
          setState(shootData.state || shootData.location?.state || '');
          setZip(shootData.zip || shootData.location?.zip || '');
          setNotes(shootData.shoot_notes || shootData.notes || '');
          setCompanyNotes(shootData.company_notes || '');
          setPhotographerNotes(shootData.photographer_notes || '');
          setEditorNotes(shootData.editor_notes || '');
          
          // Set photographer if assigned
          if (shootData.photographer_id) {
            setPhotographer(shootData.photographer_id.toString());
          }
          
          // Set date and time
          if (shootData.scheduled_at || shootData.scheduledAt) {
            const scheduledDate = new Date(shootData.scheduled_at || shootData.scheduledAt);
            if (!isNaN(scheduledDate.getTime())) {
              setDate(scheduledDate);
              // Format time as "HH:MM AM/PM"
              let hours = scheduledDate.getHours();
              const minutes = scheduledDate.getMinutes().toString().padStart(2, '0');
              const ampm = hours >= 12 ? 'PM' : 'AM';
              hours = hours % 12 || 12;
              setTime(`${hours}:${minutes} ${ampm}`);
            }
          }
          
          // Set services - need to match with available packages
          if (shootData.services && Array.isArray(shootData.services) && packages.length > 0) {
            const matchedServices = shootData.services
              .map((svc: any) => {
                const serviceId = svc.id?.toString() || svc.service_id?.toString();
                return packages.find(pkg => pkg.id === serviceId);
              })
              .filter(Boolean) as ServicePackage[];
            
            if (matchedServices.length > 0) {
              setSelectedServices(matchedServices);
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
    
    // Wait for packages to load before fetching shoot
    if (!packagesLoading && editShootId) {
      fetchShootForEdit();
    }
  }, [editShootId, packagesLoading, packages, toast]);

  // Removed geolocation permission prompt to avoid asking for location on this page.


  const getPackagePrice = () => {
    if (!selectedServices.length) {
      return 0;
    }
    
    // Get sqft from property details for variable pricing
    const sqft = propertySqft ?? propertyDetails?.sqft ?? propertyDetails?.livingArea ?? null;
    
    const total = selectedServices.reduce((sum, service) => {
      let price = Number(service.price ?? 0);
      
      // If variable pricing and sqft available, find matching range
      if (service.pricing_type === 'variable' && sqft && service.sqft_ranges?.length) {
        const matchingRange = service.sqft_ranges.find(
          range => sqft >= range.sqft_from && sqft <= range.sqft_to
        );
        if (matchingRange) {
          price = Number(matchingRange.price);
        }
      }
      
      return sum + price;
    }, 0);
    return Math.round(total * 100) / 100;
  };

  const getPhotographerRate = () => {

    return 0;
  };

  const getTax = () => {
    const subtotal = getPackagePrice(); // Only package price, photographer fee is internal
    return Math.round(subtotal * 0.06);
  };

  const getTotal = () => {
    const packagePrice = getPackagePrice();
    const tax = getTax();

    const packageCents = Math.round(packagePrice * 100);
    const taxCents = Math.round(tax * 100);

    const totalCents = packageCents + taxCents;
    return totalCents / 100;
  };

  const getAvailablePhotographers = () => {
    const role = user?.role;
    if (role === 'admin' || role === 'superadmin') return photographers;
    if (!date || !time) return [];
    if (availablePhotographerIds.length === 0) return [];
    return photographers.filter(p => availablePhotographerIds.includes(p.id));
  };

  const validateCurrentStep = () => {
    if (step === 1) {
      if (!client && !isClientAccount) {
        toast({
          title: "Missing information",
          description: "Please select a client before proceeding.",
          variant: "destructive",
        });
        return false;
      }

      if (!address || !city || !state || !zip || selectedServices.length === 0) {
        toast({
          title: "Missing information",
          description: "Please fill in all property details and select a package before proceeding.",
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    if (step === 2) {
      const errors = {};
      if (!date) errors['date'] = "Please select a date";
      if (!time) errors['time'] = "Please select a time";

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return false;
      }
      return true;
    }

    return true;
  };


  // const availablePhotographers = getAvailablePhotographers();

  // if (!client || !address || !city || !state || !zip || !date || !time || !selectedPackage) {
  //   toast({
  //     title: "Missing information",
  //     description: "Please fill in all required fields before confirming the booking.",
  //     variant: "destructive",
  //   });
  //   return;
  // }

  // const selectedClientData = clients.find(c => c.id === client);
  // const selectedPhotographerData = photographers.find(p => p.id === photographer);
  // const selectedPackageData = packages.find(p => p.id === selectedPackage);

  // const bookingStatus: ShootData['status'] = 'booked';

  // // Make sure date is properly formatted to avoid timezone issues
  // const shootDate = date ? new Date(
  //   date.getFullYear(),
  //   date.getMonth(),
  //   date.getDate(),
  //   12, // Set to noon to avoid timezone issues
  //   0,
  //   0
  // ) : new Date();

  // const newShoot: ShootData = {
  //   id: uuidv4(),
  //   scheduledDate: shootDate.toISOString().split('T')[0],
  //   time: time,
  //   client: {
  //     name: selectedClientData?.name || 'Unknown Client',
  //     email: selectedClientData?.email || `client${client}@example.com`,
  //     company: selectedClientData?.company,
  //     totalShoots: 1
  //   },
  //   location: {
  //     address: address,
  //     address2: '',
  //     city: city,
  //     state: state,
  //     zip: zip,
  //     fullAddress: `${address}, ${city}, ${state} ${zip}`
  //   },
  //   photographer: selectedPhotographerData ? {
  //     id: selectedPhotographerData.id,
  //     name: selectedPhotographerData.name,
  //     avatar: selectedPhotographerData.avatar
  //   } : {
  //     name: "To Be Assigned",
  //     avatar: ""
  //   },
  //   services: selectedPackageData ? [selectedPackageData.name] : [],
  //   payment: {
  //     baseQuote: getPackagePrice(),
  //     taxRate: 6.0,
  //     taxAmount: getTax(),
  //     totalQuote: getTotal(),
  //     totalPaid: bypassPayment ? 0 : getTotal(),
  //     lastPaymentDate: bypassPayment ? undefined : new Date().toISOString().split('T')[0],
  //     lastPaymentType: bypassPayment ? undefined : 'Credit Card'
  //   },
  //   status: bookingStatus,
  //   notes: notes ? { shootNotes: notes } : undefined,
  //   createdBy: user?.name || "Current User"
  // };

  // addShoot(newShoot);
  // setIsComplete(true);

  // console.log("New shoot created:", newShoot);

  //       if (!client || !address || !city || !state || !zip || !date || !time || !selectedPackage) {
  //         toast({
  //           title: "Missing information",
  //           description: "Please fill in all required fields before confirming the booking.",
  //           variant: "destructive",
  //         });
  //         return;
  //       }

  //       const shootDate = date ? new Date(
  //         date.getFullYear(),
  //         date.getMonth(),
  //         date.getDate(),
  //         12
  //       ) : new Date();

  //       const payload = {
  //         client_id: client,
  //         address,
  //         city,
  //         state,
  //         zip,
  //         scheduled_date: shootDate.toISOString().split('T')[0],
  //         time,
  //         photographer_id: photographer || null,
  //         service_id: selectedPackage,
  //         notes,
  //         bypass_payment: bypassPayment,
  //         send_notification: sendNotification
  //       };

  //       try {
  //         const token = localStorage.getItem('authToken');
  //         const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/shoots`, payload, {
  //           headers: {
  //             Authorization: `Bearer ${token}`
  //           }
  //         });

  //         toast({
  //           title: "Shoot Booked!",
  //           description: "The shoot has been successfully created.",
  //           variant: "default"
  //         });

  //         setIsComplete(true);
  //         console.log("Shoot created response:", response.data);
  //       } catch (error) {
  //         console.error("Error creating shoot:", error);
  //         toast({
  //           title: "Error",
  //           description: "Failed to create shoot. Please try again.",
  //           variant: "destructive"
  //         });
  //       }
  //   } else {
  //     if (!validateCurrentStep()) {
  //       return;
  //     }

  //     setStep(step + 1);
  //   }
  // };

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (isSubmitting) return;
    
    setFormErrors({});

    if (step === 3) {
      setIsSubmitting(true);
      // For client accounts, they don't need to select a client (they ARE the client)
      const clientValid = isClientAccount || !!client;
      if (!clientValid || !address || !city || !state || !zip || !date || !time || selectedServices.length === 0) {
        toast({
          title: "Missing information",
          description: "Please fill in all required fields before confirming the booking.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Normalize state to 2-letter abbreviation
      const normalizedState = normalizeState(state);
      if (!normalizedState || !isValidState(normalizedState)) {
        toast({
          title: "Invalid State",
          description: "State must be a valid 2-letter abbreviation (e.g., CA, NY, DC). Please enter a valid state code.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Convert time from 12-hour format (e.g., "02:05 PM") to 24-hour format (e.g., "14:05:00")
      let time24Hour = '00:00:00';
      if (time) {
        const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const period = match[3].toUpperCase();
          
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          
          time24Hour = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
        } else {
          // If time is already in 24-hour format, use it as-is
          const time24Match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
          if (time24Match) {
            const h = parseInt(time24Match[1], 10);
            const m = parseInt(time24Match[2], 10);
            const s = time24Match[3] || '00';
            time24Hour = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          }
        }
      }

      const shootDate = date ? new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        12
      ) : new Date();

      // Calculate pricing information
      const baseQuote = getPackagePrice();
      const photographerRate = getPackagePrice();
      const taxAmount = getTax();
      const totalQuote = getTotal();

      // Get sqft for variable pricing
      const sqft = propertySqft ?? propertyDetails?.sqft ?? propertyDetails?.livingArea ?? null;
      
      const servicesPayload = selectedServices.map(service => {
        let price = Number(service.price ?? 0);
        
        // If variable pricing and sqft available, find matching range
        if (service.pricing_type === 'variable' && sqft && service.sqft_ranges?.length) {
          const matchingRange = service.sqft_ranges.find(
            range => sqft >= range.sqft_from && sqft <= range.sqft_to
          );
          if (matchingRange) {
            price = Number(matchingRange.price);
          }
        }
        
        return {
          id: service.id,
          price,
          quantity: 1,
        };
      });

      const primaryServiceId = servicesPayload[0]?.id ?? null;
      
      // Construct scheduled_at as full datetime string (YYYY-MM-DD HH:MM:SS)
      const scheduledAt = date && time24Hour 
        ? `${shootDate.toISOString().split('T')[0]} ${time24Hour}`
        : null;
      
      // Preparing shoot submission
      
      // For client accounts, use their own user ID as the client_id
      const effectiveClientId = isClientAccount ? user?.id : client;
      
      const payload = {
        client_id: effectiveClientId,
        address,
        city,
        state: normalizedState, // Use normalized state
        zip,
        scheduled_at: scheduledAt, // Full datetime in format: "YYYY-MM-DD HH:MM:SS"
        scheduled_date: shootDate.toISOString().split('T')[0], // YYYY-MM-DD format (legacy support)
        time: time24Hour, // 24-hour format for backend
        photographer_id: photographer || null,
        service_id: primaryServiceId,
        services: servicesPayload,
        service_category: selectedServices[0]?.category?.name || undefined,
        shoot_notes: notes || undefined,
        company_notes: companyNotes || undefined,
        photographer_notes: photographerNotes || undefined,
        editor_notes: editorNotes || undefined,
        bypass_paywall: bypassPayment,
        send_notification: sendNotification,
        // Integration fields
        property_details: propertyDetails || undefined,
        // Add the missing required fields based on API error
        base_quote: baseQuote,
        tax_amount: taxAmount,
        total_quote: totalQuote,
        payment_status: bypassPayment ? 'pending' : 'paid', // or whatever statuses your API expects
        // Don't send status - let backend determine based on user role (client = requested, admin = scheduled)
        created_by: user?.name || user?.email || 'System', // Use available user info
        // Flag to indicate this is a client-initiated request (needs approval)
        is_client_request: isClientAccount,
      };

      try {
        const token = localStorage.getItem('authToken');
        const response = await axios.post(`${API_BASE_URL}/api/shoots`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        // Show appropriate message based on user role
        const isClientRole = user?.role === 'client';
        toast({
          title: isClientRole ? "Shoot Request Submitted!" : "Shoot Booked!",
          description: isClientRole 
            ? "Your shoot request has been submitted for approval. We'll notify you once it's reviewed."
            : "The shoot has been successfully created.",
          variant: "default"
        });

        // Store created shoot ID for payment
        const shootData = response.data?.data || response.data;
        if (shootData?.id) {
          setCreatedShootId(shootData.id);
        }
        
        setIsComplete(true);
        await fetchShoots();
        
        // Clear form cache on successful submission
        if (shouldCacheForm) {
          localStorage.removeItem(CACHE_KEY);
        }
        
        console.log("Shoot created response:", response.data);
      } catch (error: any) {
        console.error("Error creating shoot:", error);
        console.error("Error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText,
        });

        // Better error handling to show specific validation errors
        if (error.response?.data?.errors) {
          const errorMessages = Object.values(error.response.data.errors).flat();
          toast({
            title: "Validation Error",
            description: errorMessages.join('. '),
            variant: "destructive"
          });
        } else if (error.response?.data?.message) {
          toast({
            title: "Error",
            description: error.response.data.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error",
            description: `Failed to create shoot (${error.response?.status || 'Unknown error'}). Please check the console for details.`,
            variant: "destructive"
          });
        }
        setIsSubmitting(false);
      }
    } else {
      if (!validateCurrentStep()) {
        return;
      }

      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setFormErrors({});
      setStep(step - 1);
    }
  };

  const resetForm = () => {
    if (!isClientAccount) {
      setClient('');
    }
    setAddress('');
    setCity('');
    setState('');
    setZip('');
    setDate(undefined);
    setTime('');
    setPhotographer('');
    setSelectedServices([]);
    setNotes('');
    setBypassPayment(false);
    setSendNotification(true);
    setStep(1);
    setIsComplete(false);
    
    // Clear form cache when resetting
    if (shouldCacheForm) {
      localStorage.removeItem(CACHE_KEY);
      setHasCachedData(false);
    }
    
    navigate('/shoots');
  };

  const handleAddressFieldsChange = React.useCallback(
    ({ address: newAddress, city: newCity, state: newState, zip: newZip }: { address: string; city: string; state: string; zip: string }) => {
      setAddress(newAddress);
      setCity(newCity);
      setState(normalizeState(newState) || newState);
      setZip(newZip);
    },
    []
  );

  const handleClientChange = React.useCallback((clientId: string) => {
    setClient(clientId);
  }, []);

  const updateClientCompanyNotes = React.useCallback(
    async (clientId: string, notesValue: string) => {
      if (!clientId) return;
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return;
        await axios.put(
          `${API_BASE_URL}/api/admin/users/${clientId}`,
          { company_notes: notesValue || '' },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          }
        );
        setClients((prev) =>
          prev.map((clientItem) =>
            clientItem.id === clientId
              ? {
                  ...clientItem,
                  companyNotes: notesValue,
                }
              : clientItem
          )
        );
      } catch (error) {
        console.error('Failed to update company notes for client:', error);
        toast({
          title: 'Company notes not saved',
          description: 'We could not save the company notes for this client.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  // Clear cached form data
  const handleClearCache = () => {
    if (shouldCacheForm) {
      localStorage.removeItem(CACHE_KEY);
      setHasCachedData(false);
      
      // Reset form fields
      if (!isClientAccount) {
        setClient('');
      }
      setAddress('');
      setCity('');
      setState('');
      setZip('');
      setDate(undefined);
      setTime('');
      setPhotographer('');
      setSelectedServices([]);
      setNotes('');
      setCompanyNotes('');
      setPhotographerNotes('');
      setEditorNotes('');
      setBypassPayment(false);
      setSendNotification(true);
      setStep(1);
      setPropertyDetails(null);
      setPropertySqft(null);
      
      toast({
        title: 'Form cleared',
        description: 'All saved form data has been cleared.',
      });
    }
  };

  const clientPropertyFormData = React.useMemo(() => ({
    initialData: {
      clientId: client,
      clientName: isClientAccount ? user?.name || '' : clients.find(c => c.id === client)?.name || '',
      clientEmail: isClientAccount ? user?.email || '' : clients.find(c => c.id === client)?.email || '',
      clientPhone: isClientAccount ? (user?.metadata?.phone || user?.phone || '') : clients.find(c => c.id === client)?.phone || '',
      clientCompany: isClientAccount ? (user?.metadata?.company || user?.company || '') : clients.find(c => c.id === client)?.company || '',
      propertyType: 'residential' as const,
      propertyAddress: address,
      propertyCity: city,
      propertyState: state,
      propertyZip: zip,
      completeAddress: address,
      propertyInfo: notes,
      shootNotes: notes,
      companyNotes: companyNotes,
      photographerNotes: photographerNotes,
      editorNotes: editorNotes,
      bedRooms: propertyDetails?.bedrooms ?? propertyDetails?.bedRooms ?? undefined,
      bathRooms: propertyDetails?.bathrooms ?? propertyDetails?.bathRooms ?? undefined,
      sqft: propertySqft ?? undefined,
      lockboxCode: propertyDetails?.lockboxCode ?? undefined,
      lockboxLocation: propertyDetails?.lockboxLocation ?? undefined,
      accessContactName: propertyDetails?.accessContactName ?? undefined,
      accessContactPhone: propertyDetails?.accessContactPhone ?? undefined,
      selectedPackage: selectedServices[0]?.id || ''
    },
    onComplete: (data: any) => {
      if (!isClientAccount && data.clientId) {
        setClient(data.clientId);
      }
      setAddress(data.propertyAddress);
      setCity(data.propertyCity);
      // Normalize state when setting from address lookup
      const normalizedState = normalizeState(data.propertyState);
      setState(normalizedState || data.propertyState);
      setZip(data.propertyZip);
      setNotes(data.shootNotes || data.propertyInfo || '');
      setCompanyNotes(data.companyNotes || '');
      setPhotographerNotes(data.photographerNotes || '');
      setEditorNotes(data.editorNotes || '');
      setPropertyDetails(data.property_details || null);
      const derivedSqft =
        (data.sqft && Number(data.sqft)) ||
        data.property_details?.sqft ||
        data.property_details?.livingArea ||
        null;
      setPropertySqft(derivedSqft);
      if (!isClientAccount && data.clientId) {
        const existingNotes = clients.find((c) => c.id === data.clientId)?.companyNotes || '';
        const nextNotes = data.companyNotes || '';
        if (existingNotes !== nextNotes) {
          updateClientCompanyNotes(data.clientId, nextNotes);
        }
      }
      setStep(2);
    },
    isClientAccount: isClientAccount,
    selectedServices,
    onSelectedServicesChange: handleSelectedServicesChange,
    packagesLoading,
  }), [client, clients, address, city, state, zip, notes, companyNotes, photographerNotes, editorNotes, propertyDetails, selectedServices, isClientAccount, user, packagesLoading, propertySqft]);


  const getSummaryInfo = () => {
    const selectedClientData = clients.find(c => c.id === client);
    const serviceNames = selectedServices.map(service => service.name).join(', ');

    // Extract rep name from various possible fields
    // Backend returns rep as object: { id, name, email } or as string
    let repName: string | undefined = undefined;
    if (selectedClientData) {
      // Check if rep was already extracted as string (from our mapping)
      if (typeof (selectedClientData as any).rep === 'string') {
        repName = (selectedClientData as any).rep;
      }
      // Check repObject if it exists (original rep object from backend)
      else if ((selectedClientData as any).repObject) {
        const repObj = (selectedClientData as any).repObject;
        if (typeof repObj === 'object' && repObj.name) {
          repName = repObj.name;
        } else if (typeof repObj === 'string') {
          repName = repObj;
        }
      }
      // Fallback to other possible field names
      if (!repName) {
        repName = (selectedClientData as any).rep_name 
          || (selectedClientData as any).sales_rep
          || (selectedClientData as any).salesRep;
      }
    }

    const fullAddress = buildNormalizedAddress({ address, city, state, zip });

    // Summary info calculated

    return {
      client: selectedClientData?.name || (isClientAccount ? user?.name || '' : ''),
      clientRep: repName,
      services: selectedServices,
      packageLabel: serviceNames,
      packagePrice: getPackagePrice(),
      address: fullAddress || address || '',
      bedrooms: 0,
      bathrooms: 0,
      sqft: 0,
      date: date ? formatDate(date) : '',
      time: time || '',
    };
  };

  const { temperature, condition } = useWeatherData({ date, time, city, state, zip, address });
  const parsedTemperature =
    temperature !== undefined && temperature !== null && !Number.isNaN(Number(temperature))
      ? Number(temperature)
      : undefined;

  const summaryInfo = getSummaryInfo();

  const getCurrentStepContent = () => {
    const stepContent = {
      1: {
        title: "Book a new shoot",
        description: "Select a client and enter the property information"
      },
      2: {
        title: "Schedule",
        description: "Choose a convenient date and time for the shoot"
      },
      3: {
        title: "Review & Confirm",
        description: "Verify all the details before confirming the booking"
      }
    };

    return stepContent[step as keyof typeof stepContent] || { title: '', description: '' };
  };

  const currentStepContent = getCurrentStepContent();

  return (
    // Match Shoot History padding; scroll only within the page content (navbar/sidebar/summary stay fixed)
    <DashboardLayout>
      <div className="space-y-6 px-1 py-4 sm:px-4 sm:py-6 lg:p-6">
          <AnimatePresence mode="wait">
            {isComplete ? (
              <BookingComplete 
                date={date} 
                time={time} 
                resetForm={resetForm} 
                isClientRequest={isClientAccount}
                shootId={createdShootId}
                totalAmount={getTotal()}
                shootAddress={buildNormalizedAddress({ address, city, state, zip })}
                shootServices={selectedServices.map(s => s.name)}
                clientName={user?.name}
                clientEmail={user?.email}
              />
            ) : (
              <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <BookingHeader
                  title={currentStepContent.title}
                  description={currentStepContent.description}
                />
              </div>

              <BookingStepIndicator currentStep={step} totalSteps={3} />
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {!isComplete && (
              <div
                className={`grid grid-cols-1 ${{
                  true: 'lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,0.95fr)]',
                  false: 'lg:grid-cols-1',
                }[String(!isMobile || step === 3) as 'true' | 'false']} gap-8 mt-2 items-start`}
              >
                <div className="order-2 lg:order-1 w-full">
                <BookingContentArea
                  step={step}
                  formErrors={formErrors}
                  setFormErrors={setFormErrors}
                  clientPropertyFormData={clientPropertyFormData}
                  onAddressFieldsChange={handleAddressFieldsChange}
                  onClientChange={handleClientChange}
                  date={date}
                  setDate={setDate}
                  time={time}
                  setTime={setTime}
                  selectedServices={selectedServices}
                  onSelectedServicesChange={handleSelectedServicesChange}
                  notes={notes}
                  setNotes={setNotes}
                  packages={packages}
                  packagesLoading={packagesLoading}
                  client={client}
                  address={address}
                  city={city}
                  state={state}
                  zip={zip}
                  setAddress={setAddress}
                  setCity={setCity}
                  setState={setState}
                  setZip={setZip}
                  photographer={photographer}
                  setPhotographer={setPhotographer}
                  bypassPayment={bypassPayment}
                  setBypassPayment={setBypassPayment}
                  sendNotification={sendNotification}
                  setSendNotification={setSendNotification}
                  getPackagePrice={getPackagePrice}
                  getPhotographerRate={getPhotographerRate}
                  clients={clients}
                  photographers={photographers}
                  handleSubmit={handleSubmit}
                  goBack={goBack}
                  showClearSavedData={shouldCacheForm && hasCachedData}
                  onClearSavedData={handleClearCache}
                />
                </div>
                {(!isMobile || step === 3) && (
                  <div className="order-1 lg:order-2 lg:sticky lg:top-4 lg:max-w-sm w-full">
                    <BookingSummary
                      summaryInfo={summaryInfo}
                      selectedServices={selectedServices}
                      onSubmit={step === 3 ? handleSubmit : undefined}
                      isLastStep={step === 3}
                      canSubmit={isMobile ? true : Boolean(String(photographer || '').trim())}
                      isSubmitting={isSubmitting}
                      showRepName={user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'photographer'}
                      weather={{ temperature: parsedTemperature, condition }}
                      isMobile={isMobile}
                    />
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default BookShoot;








