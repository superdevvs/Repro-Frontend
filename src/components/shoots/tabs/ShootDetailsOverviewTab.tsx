import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  CalendarIcon, 
  ClockIcon, 
  MapPinIcon, 
  UserIcon, 
  PhoneIcon, 
  MailIcon,
  CameraIcon,
  Sun,
  CloudRain,
  Cloud,
  Snowflake,
  UserPlus,
  Search,
  ArrowUpDown,
  Loader2,
  MapPin,
  Save,
  XCircle,
  X,
  Key,
  UserCheck,
  Link2,
} from 'lucide-react';
import { format, isValid, parse } from 'date-fns';
import { ShootData } from '@/types/shoots';
import { WeatherInfo } from '@/services/weatherService';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { calculateDistance, getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { cn } from '@/lib/utils';
import { getStateFullName } from '@/utils/stateUtils';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { getServicePricingForSqft } from '@/utils/servicePricing';

const serviceCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const FLEXIBLE_DATE_FORMATS = [
  'dd-MM-yyyy',
  'MM-dd-yyyy',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
  'yyyy/MM/dd',
  'yyyy.MM.dd',
  'dd.MM.yyyy',
];

const parseFlexibleDate = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  const timestamp = Date.parse(trimmed);
  if (!Number.isNaN(timestamp)) {
    const parsed = new Date(timestamp);
    if (isValid(parsed)) return parsed;
  }
  for (const fmt of FLEXIBLE_DATE_FORMATS) {
    try {
      const parsed = parse(trimmed, fmt, new Date());
      if (isValid(parsed)) return parsed;
    // eslint-disable-next-line no-empty
    } catch {}
  }
  return null;
};

type ServiceOption = {
  id: string;
  name: string;
  price?: number;
  pricing_type?: 'fixed' | 'variable';
  allow_multiple?: boolean;
  sqft_ranges?: Array<{ sqft_from: number; sqft_to: number; duration: number | null; price: number; photographer_pay: number | null }>;
  description?: string;
  category?: { id?: string; name?: string } | string | null;
  photographer_pay?: number | null;
  duration?: number | null;
  [key: string]: unknown;
};

type ServiceCategoryOption = {
  id: string;
  name: string;
  count: number;
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'uncategorized';

const deriveServiceCategoryId = (service: ServiceOption) => {
  if (!service.category) return 'uncategorized';
  if (typeof service.category === 'string') return slugify(service.category);
  if (typeof service.category === 'object') {
    if (service.category.id) return String(service.category.id);
    if (service.category.name) return slugify(service.category.name);
  }
  return 'uncategorized';
};

const deriveServiceCategoryName = (service: ServiceOption) => {
  if (!service.category) return 'Uncategorized';
  if (typeof service.category === 'string') return service.category;
  return service.category.name || 'Uncategorized';
};

interface ShootDetailsOverviewTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  role: string;
  onShootUpdate: () => void;
  weather?: WeatherInfo | null;
  isEditMode?: boolean;
  onSave?: (updates: Partial<ShootData>) => void;
  onCancel?: () => void;
  onRegisterEditActions?: (actions: { save: () => void; cancel: () => void }) => void;
}

export function ShootDetailsOverviewTab({
  shoot,
  isAdmin,
  isPhotographer,
  isEditor,
  isClient,
  role,
  onShootUpdate,
  weather,
  isEditMode = false,
  onSave,
  onCancel,
  onRegisterEditActions,
}: ShootDetailsOverviewTabProps) {
  const { toast } = useToast();
  const { formatTemperature, formatTime: formatTimePreference, formatDate: formatDatePreference } = useUserPreferences();
  
  // Edit mode state
  const [editedShoot, setEditedShoot] = useState<Partial<ShootData>>({});
  
  // For edit mode - clients and services
  const [clients, setClients] = useState<Array<{ id: string; name: string; email: string; company?: string }>>(() => {
    if (shoot.client) {
      return [{
        id: String(shoot.client.id),
        name: shoot.client.name || '',
        email: shoot.client.email || '',
        company: shoot.client.company || '',
      }];
    }
    return [];
  });
  const [servicesList, setServicesList] = useState<ServiceOption[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [servicePrices, setServicePrices] = useState<Record<string, string>>({});
  const [servicePhotographerPays, setServicePhotographerPays] = useState<Record<string, string>>({});
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [servicePanelCategory, setServicePanelCategory] = useState<string>('all');
  const [serviceModalSearch, setServiceModalSearch] = useState('');
  const [presenceOption, setPresenceOption] = useState<'self' | 'other' | 'lockbox'>('self');
  const [lockboxCode, setLockboxCode] = useState('');
  const [lockboxLocation, setLockboxLocation] = useState('');
  const [accessContactName, setAccessContactName] = useState('');
  const [accessContactPhone, setAccessContactPhone] = useState('');
  
  // Search states
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  
  // Fetch clients and services when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      // Fetch clients
      const fetchClients = async () => {
        try {
          const token = localStorage.getItem('authToken') || localStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}/api/admin/clients`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          });
          if (res.ok) {
            const json = await res.json();
            const clientsList = (json.data || json || []).map((c: any) => ({
              id: String(c.id),
              name: c.name,
              email: c.email || '',
              company: c.company_name || c.company || '',
            }));
            const currentClient = shoot.client;
            if (currentClient && !clientsList.some((c) => c.id === String(currentClient.id))) {
              clientsList.unshift({
                id: String(currentClient.id),
                name: currentClient.name || 'Current client',
                email: currentClient.email || '',
                company: currentClient.company || '',
              });
            }
            setClients(clientsList);
          }
        } catch (error) {
          console.error('Error fetching clients:', error);
        }
      };

      // Fetch services
      const fetchServices = async () => {
        try {
          const token = localStorage.getItem('authToken') || localStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}/api/services`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          });
          if (res.ok) {
            const json = await res.json();
            const servicesData = (json.data || json || []).map((s: any) => ({
              id: String(s.id),
              name: s.name,
              price: s.price || 0,
              pricing_type: s.pricing_type || 'fixed',
              allow_multiple: s.allow_multiple ?? false,
              sqft_ranges: s.sqft_ranges || [],
            }));
            setServicesList(servicesData);
            
            // Initialize selected services from current shoot
            if (shoot.services && Array.isArray(shoot.services) && servicesData.length > 0) {
              const currentServiceIds = shoot.services.map((s: any) => {
                if (typeof s === 'string') {
                  // If it's a string, try to find matching service by name
                  const found = servicesData.find((sv: any) => sv.name === s);
                  return found ? found.id : null;
                }
                // If it's an object, try to get id
                if (s && typeof s === 'object') {
                  return String(s.id || s.service_id || '');
                }
                return null;
              }).filter(Boolean) as string[];
              setSelectedServiceIds(currentServiceIds);
              
              // Initialize prices and photographer pays from current services
              const prices: Record<string, string> = {};
              const photographerPays: Record<string, string> = {};
              shoot.services.forEach((s: any) => {
                if (s && typeof s === 'object') {
                  const serviceId = String(s.id || s.service_id || '');
                  if (serviceId && currentServiceIds.includes(serviceId)) {
                    if (s.price !== undefined) {
                      prices[serviceId] = String(s.price);
                    }
                    if (s.photographer_pay !== undefined && s.photographer_pay !== null) {
                      photographerPays[serviceId] = String(s.photographer_pay);
                    }
                  }
                }
              });
              setServicePrices(prices);
              setServicePhotographerPays(photographerPays);
            }
          }
        } catch (error) {
          console.error('Error fetching services:', error);
        }
      };

      fetchClients();
      fetchServices();
    }
  }, [isEditMode, shoot]);

  // Initialize edited shoot when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      setEditedShoot({
        scheduledDate: formatDateForInput(shoot.scheduledDate),
        time: shoot.time,
        location: {
          address: shoot.location?.address || '',
          city: shoot.location?.city || '',
          state: shoot.location?.state || '',
          zip: shoot.location?.zip || '',
          fullAddress: shoot.location?.fullAddress || '',
        },
        client: shoot.client ? {
          ...shoot.client,
        } : undefined,
        photographer: shoot.photographer ? {
          ...shoot.photographer,
        } : undefined,
        payment: shoot.payment ? {
          ...shoot.payment,
        } : undefined,
      });
    }
  }, [isEditMode, shoot]);
  
  // Update edited shoot field
  const updateField = (field: string, value: unknown) => {
    setEditedShoot(prev => {
      const keys = field.split('.');
      const newState = { ...prev };
      let current: any = newState;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newState;
    });
  };
  
  // Handle save
  const handleSave = () => {
    if (onSave) {
      const updates = { ...editedShoot };
      updates.propertyDetails = {
        ...(updates.propertyDetails || {}),
        presenceOption,
        lockboxCode: presenceOption === 'lockbox' ? lockboxCode || undefined : undefined,
        lockboxLocation: presenceOption === 'lockbox' ? lockboxLocation || undefined : undefined,
        accessContactName: presenceOption === 'other' ? accessContactName || undefined : undefined,
        accessContactPhone: presenceOption === 'other' ? accessContactPhone || undefined : undefined,
      };
      
      // Get sqft from shoot for variable pricing
      const sqft = (shoot as any).sqft || (shoot as any).livingArea || (shoot as any).living_area || null;
      
      // Include selected services with prices and photographer pays
      if (selectedServiceIds.length > 0) {
        updates.services = selectedServiceIds.map(id => {
          const service = servicesList.find(s => s.id === id);
          
          // Calculate price based on sqft for variable pricing services
          let calculatedPrice = service?.price || 0;
          if (service?.pricing_type === 'variable' && sqft && service.sqft_ranges?.length) {
            const matchingRange = service.sqft_ranges.find(
              range => sqft >= range.sqft_from && sqft <= range.sqft_to
            );
            if (matchingRange) {
              calculatedPrice = matchingRange.price;
            }
          }
          
          const serviceData: any = {
            id: Number(id),
            price: servicePrices[id] ? parseFloat(servicePrices[id]) : calculatedPrice,
            quantity: 1,
          };
          if (servicePhotographerPays[id]) {
            serviceData.photographer_pay = parseFloat(servicePhotographerPays[id]);
          }
          return serviceData;
        });
      }
      
      onSave(updates);
    }
  };

  // Register handlers with parent when edit mode
  useEffect(() => {
    if (isEditMode && onRegisterEditActions) {
      onRegisterEditActions({
        save: handleSave,
        cancel: onCancel || (() => {}),
      });
    }
  }, [isEditMode, onRegisterEditActions, handleSave, onCancel]);
  
  // Handle cancel
  const handleCancel = () => {
    setEditedShoot({});
    setClientSearchQuery('');
    setServiceSearchQuery('');
    if (onCancel) {
      onCancel();
    }
  };

  // Filtered lists for search
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery) return clients;
    const query = clientSearchQuery.toLowerCase();
    return clients.filter((client) => 
      client.name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      (client.company && client.company.toLowerCase().includes(query))
    );
  }, [clients, clientSearchQuery]);

  const filteredServices = useMemo(() => {
    if (!serviceSearchQuery) return servicesList;
    const query = serviceSearchQuery.toLowerCase();
    return servicesList.filter((service) =>
      service.name.toLowerCase().includes(query)
    );
  }, [servicesList, serviceSearchQuery]);

  // Derive service categories for modal
  const serviceCategoryOptions = useMemo<ServiceCategoryOption[]>(() => {
    if (!servicesList.length) return [];
    const map = new Map<string, ServiceCategoryOption>();
    servicesList.forEach((service) => {
      const id = deriveServiceCategoryId(service);
      const name = deriveServiceCategoryName(service);
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(id, { id, name, count: 1 });
      }
    });
    const allOption: ServiceCategoryOption = { id: 'all', name: 'All services', count: servicesList.length };
    return [allOption, ...Array.from(map.values())];
  }, [servicesList]);

  // Filter services by selected category
  const panelServices = useMemo(() => {
    if (!servicesList.length) return [];
    let filtered = servicesList;
    if (servicePanelCategory !== 'all') {
      filtered = servicesList.filter((s) => deriveServiceCategoryId(s) === servicePanelCategory);
    }
    if (serviceModalSearch) {
      const query = serviceModalSearch.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(query));
    }
    return filtered;
  }, [servicesList, servicePanelCategory, serviceModalSearch]);

  // Get sqft for variable pricing
  const effectiveSqft = useMemo(() => {
    const sqft = (shoot as any).sqft || (shoot as any).livingArea || (shoot as any).living_area || null;
    return sqft ? Number(sqft) : null;
  }, [shoot]);

  const [assignPhotographerOpen, setAssignPhotographerOpen] = useState(false);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<string>('');
  const [photographers, setPhotographers] = useState<Array<{ 
    id: string; 
    name: string; 
    email: string;
    avatar?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    distance?: number;
  }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  
  // Check if user is admin or rep
  const isAdminOrRep = isAdmin || role === 'rep' || role === 'representative';

  // Get shoot location for distance calculation
  const getShootLocation = () => {
    const address = shoot.location?.address || (shoot as any).address || '';
    const city = shoot.location?.city || (shoot as any).city || '';
    const state = shoot.location?.state || (shoot as any).state || '';
    const zip = shoot.location?.zip || (shoot as any).zip || '';
    return { address, city, state, zip };
  };

  // Fetch photographers for assignment
  useEffect(() => {
    if (!assignPhotographerOpen || !isAdminOrRep) return;
    
    const fetchPhotographers = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/users/photographers`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        if (res.ok) {
          const json = await res.json();
          const photographersList = (json.data || json || []).map((p: any) => ({
            id: String(p.id),
            name: p.name,
            email: p.email,
            avatar: p.avatar,
            address: p.address || p.metadata?.address || p.metadata?.homeAddress,
            city: p.city || p.metadata?.city,
            state: p.state || p.metadata?.state,
            zip: p.zip || p.zipcode || p.metadata?.zip || p.metadata?.zipcode,
          }));
          setPhotographers(photographersList);
        }
      } catch (error) {
        console.error('Error fetching photographers:', error);
      }
    };
    
    fetchPhotographers();
  }, [assignPhotographerOpen, isAdminOrRep]);

  // Calculate distances when dialog opens and shoot location/photographers are available
  useEffect(() => {
    const calculateDistances = async () => {
      if (!assignPhotographerOpen || photographers.length === 0) return;
      
      const shootLocation = getShootLocation();
      if (!shootLocation.address || !shootLocation.city || !shootLocation.state) {
        return; // Can't calculate without location
      }

      setIsCalculatingDistances(true);
      try {
        // Get coordinates for shoot location
        const shootCoords = await getCoordinatesFromAddress(
          shootLocation.address,
          shootLocation.city,
          shootLocation.state,
          shootLocation.zip
        );
        
        if (!shootCoords) {
          setIsCalculatingDistances(false);
          return;
        }

        // Calculate distance for each photographer
        const photographersWithDist = await Promise.all(
          photographers.map(async (photographer) => {
            if (!photographer.address || !photographer.city || !photographer.state) {
              return { ...photographer, distance: undefined };
            }

            const photographerCoords = await getCoordinatesFromAddress(
              photographer.address,
              photographer.city,
              photographer.state,
              photographer.zip
            );

            if (!photographerCoords) {
              return { ...photographer, distance: undefined };
            }

            const dist = calculateDistance(
              shootCoords.lat,
              shootCoords.lon,
              photographerCoords.lat,
              photographerCoords.lon
            );

            return {
              ...photographer,
              distance: Math.round(dist * 10) / 10, // Round to 1 decimal
            };
          })
        );

        setPhotographers(photographersWithDist);
      } catch (error) {
        console.error('Error calculating distances:', error);
      } finally {
        setIsCalculatingDistances(false);
      }
    };

    calculateDistances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignPhotographerOpen, photographers.length]);

  // Filter and sort photographers
  const filteredAndSortedPhotographers = useMemo(() => {
    let filtered = photographers;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query) ||
        p.city?.toLowerCase().includes(query) ||
        p.state?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'distance') {
        // Sort by distance (undefined distances go to end)
        if (a.distance === undefined && b.distance === undefined) return 0;
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      } else {
        // Sort by name
        return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [photographers, searchQuery, sortBy]);

  // Assign photographer
  const handleAssignPhotographer = async () => {
    if (!selectedPhotographerId) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ photographer_id: selectedPhotographerId }),
      });
      
      if (!res.ok) throw new Error('Failed to assign photographer');
      
      // If in edit mode, update local state
      if (isEditMode) {
        const selectedPhotographer = photographers.find(p => p.id === selectedPhotographerId);
        if (selectedPhotographer) {
          updateField('photographer', {
            id: selectedPhotographer.id,
            name: selectedPhotographer.name,
            email: selectedPhotographer.email,
          });
        }
      }
      
      toast({
        title: 'Success',
        description: 'Photographer assigned successfully',
      });
      setAssignPhotographerOpen(false);
      setSelectedPhotographerId('');
      
      if (!isEditMode) {
        onShootUpdate();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign photographer',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Not set';
      return formatDatePreference(date);
    } catch {
      return 'Not set';
    }
  };

  // Helper to format date for HTML date input (YYYY-MM-DD)
  const formatDateForInput = (dateString?: string | null) => {
    if (!dateString) {
      return format(new Date(), 'yyyy-MM-dd');
    }
    try {
      const parsed = parseFlexibleDate(dateString);
      if (!parsed) return format(new Date(), 'yyyy-MM-dd');
      return format(parsed, 'yyyy-MM-dd');
    } catch {
      return format(new Date(), 'yyyy-MM-dd');
    }
  };

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return 'Not set';
    // Use the user preference formatter
    return formatTimePreference(timeString);
  };

  // Get location address - handle different data structures
  const getLocationAddress = () => {
    if (shoot.location?.address) return shoot.location.address;
    if (shoot.location?.fullAddress) return shoot.location.fullAddress;
    // Fallback to direct properties if location object doesn't exist
    if ((shoot as any).address) return (shoot as any).address;
    return 'Not set';
  };

  // Get location city/state/zip
  const getLocationDetails = () => {
    const city = shoot.location?.city || (shoot as any).city || '';
    const state = shoot.location?.state || (shoot as any).state || '';
    const zip = shoot.location?.zip || (shoot as any).zip || '';
    return { city, state, zip };
  };

  // Get services - handle different data structures
  const getServices = () => {
    if (Array.isArray(shoot.services) && shoot.services.length > 0) {
      return shoot.services;
    }
    // Check if service is a single object
    if ((shoot as any).service) {
      const service = (shoot as any).service;
      if (typeof service === 'string') return [service];
      if (service.name) return [service.name];
      if (Array.isArray(service)) return service;
    }
    // Check if services is a string
    if (typeof shoot.services === 'string' && shoot.services) {
      return [shoot.services];
    }
    return [];
  };

  const services = getServices();
  const locationDetails = getLocationDetails();
  
  // Get property details - handle both camelCase and snake_case
  const propertyDetails = shoot.propertyDetails || (shoot as any).property_details;

  // Toggle service selection
  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds((prev) => {
      if (prev.includes(serviceId)) {
        const updated = prev.filter((id) => id !== serviceId);
        const newPrices = { ...servicePrices };
        const newPays = { ...servicePhotographerPays };
        delete newPrices[serviceId];
        delete newPays[serviceId];
        setServicePrices(newPrices);
        setServicePhotographerPays(newPays);
        return updated;
      }
      return [...prev, serviceId];
    });
  };

  const renderWeatherIcon = (icon?: string) => {
    switch (icon) {
      case 'sunny':
        return <Sun size={14} className="text-muted-foreground" />;
      case 'rainy':
        return <CloudRain size={14} className="text-muted-foreground" />;
      case 'snowy':
        return <Snowflake size={14} className="text-muted-foreground" />;
      default:
        return <Cloud size={14} className="text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-2">
      {/* Schedule Card - Only in edit mode (view mode shows in header) */}
      {isEditMode && (
        <div className="p-2.5 border rounded-lg bg-card">
          <div className="flex items-center gap-1.5 mb-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Schedule</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Date:</span>
              <div className="relative">
                <CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={editedShoot.scheduledDate || formatDateForInput(shoot.scheduledDate)}
                  onChange={(e) => updateField('scheduledDate', e.target.value)}
                  className="h-7 text-xs pl-8 [&::-webkit-calendar-picker-indicator]:opacity-100"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Time:</span>
              <div className="relative">
                <ClockIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="time"
                  value={editedShoot.time ?? shoot.time ?? ''}
                  onChange={(e) => updateField('time', e.target.value)}
                  className="h-7 text-xs pl-8"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Card - Full width where weather was */}
      <div className="p-2.5 border rounded-lg bg-card">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Location</span>
        </div>
        {isEditMode ? (
          <div className="space-y-1.5 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Address:</span>
              <Input
                type="text"
                value={editedShoot.location?.address || shoot.location?.address || ''}
                onChange={(e) => updateField('location.address', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">City:</span>
                <Input
                  type="text"
                  value={editedShoot.location?.city || shoot.location?.city || ''}
                  onChange={(e) => updateField('location.city', e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">State:</span>
                <Input
                  type="text"
                  maxLength={2}
                  value={editedShoot.location?.state || shoot.location?.state || ''}
                  onChange={(e) => updateField('location.state', e.target.value.toUpperCase())}
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">ZIP:</span>
              <Input
                type="text"
                value={editedShoot.location?.zip || shoot.location?.zip || ''}
                onChange={(e) => updateField('location.zip', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </div>
        ) : (
          <div className="text-xs">
            <div className="font-medium truncate">{getLocationAddress()}</div>
            <div className="text-muted-foreground mt-0.5 truncate">
              {[locationDetails.city, locationDetails.state, locationDetails.zip].filter(Boolean).join(', ') || 'Not set'}
            </div>
          </div>
        )}
      </div>

      {/* Services Card */}
      <div className="p-2.5 border rounded-lg bg-card">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Services</span>
        {isEditMode ? (
          <div className="space-y-2">
            {/* Selected services summary and edit button */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">
                {selectedServiceIds.length ? `${selectedServiceIds.length} service${selectedServiceIds.length > 1 ? 's' : ''} selected` : 'None selected'}
              </p>
              <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    {selectedServiceIds.length ? 'Edit services' : 'Select services'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-4xl w-[96vw] max-h-[85vh] p-0 overflow-hidden">
                  <DialogHeader className="px-4 py-3 border-b">
                    <DialogTitle className="text-base">Select services</DialogTitle>
                    <DialogDescription className="text-xs">
                      Pick services for this shoot. Categories on left, services on right.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col sm:flex-row h-full sm:h-[60vh]">
                    {/* Category sidebar */}
                    <aside className="border-b sm:border-b-0 sm:border-r p-3 sm:w-48 flex-shrink-0">
                      <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-col sm:overflow-visible sm:pb-0 sm:space-y-1">
                        {serviceCategoryOptions.map((category) => {
                          const isActive = category.id === servicePanelCategory;
                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => setServicePanelCategory(category.id)}
                              className={cn(
                                'rounded-lg border px-3 py-2 text-left transition-colors flex-shrink-0 text-xs',
                                isActive
                                  ? 'border-primary/60 bg-primary/5 text-primary'
                                  : 'border-transparent hover:bg-muted/40 text-muted-foreground'
                              )}
                            >
                              <p className="font-medium">{category.name}</p>
                              <p className="text-[10px] text-muted-foreground">{category.count} items</p>
                            </button>
                          );
                        })}
                      </div>
                    </aside>
                    {/* Services list */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh] sm:max-h-none">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search services..."
                          value={serviceModalSearch}
                          onChange={(e) => setServiceModalSearch(e.target.value)}
                          className="h-8 text-xs pl-8"
                        />
                      </div>
                      {panelServices.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-6">
                          No services in this category.
                        </div>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {panelServices.map((service) => {
                            const isSelected = selectedServiceIds.includes(service.id);
                            const serviceWithPrice = { ...service, price: service.price ?? 0 };
                            const pricingInfo = effectiveSqft && service.pricing_type === 'variable' && service.sqft_ranges?.length
                              ? getServicePricingForSqft(serviceWithPrice, effectiveSqft)
                              : null;
                            const displayPrice = pricingInfo
                              ? serviceCurrencyFormatter.format(pricingInfo.price)
                              : serviceCurrencyFormatter.format(Number(service.price ?? 0));
                            return (
                              <div
                                key={service.id}
                                className={cn(
                                  'rounded-lg border p-3 cursor-pointer transition-all text-xs',
                                  isSelected
                                    ? 'border-primary/60 bg-primary/5'
                                    : 'border-border hover:border-primary/40'
                                )}
                                onClick={() => toggleServiceSelection(service.id)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="font-medium">{service.name}</p>
                                    {service.pricing_type === 'variable' && (
                                      <p className="text-[10px] text-muted-foreground uppercase">Variable pricing</p>
                                    )}
                                  </div>
                                  <Checkbox checked={isSelected} onCheckedChange={() => toggleServiceSelection(service.id)} />
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="font-semibold">{displayPrice}</span>
                                  {deriveServiceCategoryName(service) !== 'Uncategorized' && (
                                    <Badge variant="outline" className="text-[9px] uppercase">{deriveServiceCategoryName(service)}</Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="px-4 py-3 border-t gap-2">
                    <DialogClose asChild>
                      <Button size="sm" className="w-full sm:w-auto">Done</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {/* Selected services with price display */}
            {selectedServiceIds.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {selectedServiceIds.map((id) => {
                  const service = servicesList.find((s) => s.id === id);
                  if (!service) return null;
                  const serviceWithPrice = { ...service, price: service.price ?? 0 };
                  const pricingInfo = effectiveSqft && service.pricing_type === 'variable' && service.sqft_ranges?.length
                    ? getServicePricingForSqft(serviceWithPrice, effectiveSqft)
                    : null;
                  const displayPrice = pricingInfo
                    ? serviceCurrencyFormatter.format(pricingInfo.price)
                    : serviceCurrencyFormatter.format(Number(service.price ?? 0));
                  return (
                    <div key={id} className="border rounded-md p-2 bg-primary/5 border-primary/30 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-xs truncate block">{service.name}</span>
                        {service.pricing_type === 'variable' && effectiveSqft && (
                          <span className="text-[10px] text-muted-foreground">Variable • {effectiveSqft.toLocaleString()} sqft</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{displayPrice}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 flex-shrink-0"
                          onClick={() => toggleServiceSelection(id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {services.length > 0 ? (
              services.map((service, index) => (
                <Badge key={index} variant="outline" className="text-[10px] px-1.5 py-0.5">
                  {typeof service === 'string'
                    ? service
                    : (service as any).label || (service as any).name || String(service)}
                </Badge>
              ))
            ) : (
              <div className="text-xs text-muted-foreground">No services</div>
            )}
          </div>
        )}
      </div>

      {/* Client & Contact Card - Hide from editors */}
      {!isEditor && (
        <div className="p-2.5 border rounded-lg bg-card">
          <div className="flex items-center gap-1.5 mb-1.5">
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Client</span>
          </div>
        {isEditMode ? (
          <div className="space-y-1.5 text-xs">
            <Select
              value={editedShoot.client?.id || shoot.client?.id || ''}
              onValueChange={(value) => {
                const selectedClient = filteredClients.find(c => c.id === value);
                if (selectedClient) {
                  updateField('client', {
                    id: selectedClient.id,
                    name: selectedClient.name,
                    email: selectedClient.email,
                    company: selectedClient.company,
                  });
                  setClientSearchQuery(''); // Clear search after selection
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select client">
                  {(editedShoot.client?.name || shoot.client?.name) || 'Select client'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {/* Search input inside SelectContent */}
                <div className="sticky top-0 z-10 bg-background border-b px-2 py-1.5">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search clients..."
                      value={clientSearchQuery}
                      onChange={(e) => {
                        e.stopPropagation();
                        setClientSearchQuery(e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 text-xs pl-7"
                    />
                  </div>
                </div>
                {/* Filtered clients list */}
                <div className="max-h-[150px] overflow-y-auto">
                  {filteredClients.length > 0 ? (
                    filteredClients.map((client) => (
                      <SelectItem key={client.id} value={client.id} className="text-xs">
                        <div>
                          <div className="font-medium">{client.name}</div>
                          {client.company && (
                            <div className="text-muted-foreground text-[10px]">{client.company}</div>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                      {clientSearchQuery ? 'No clients found' : 'No clients available'}
                    </div>
                  )}
                </div>
              </SelectContent>
            </Select>
            {editedShoot.client?.name || shoot.client?.name ? (
              <div className="space-y-0.5 text-xs pt-1">
                <div className="font-medium">{editedShoot.client?.name || shoot.client?.name}</div>
                {(editedShoot.client?.company || shoot.client?.company) && (
                  <div className="text-muted-foreground">{editedShoot.client?.company || shoot.client?.company}</div>
                )}
                {(editedShoot.client?.email || shoot.client?.email) && (
                  <a href={`mailto:${editedShoot.client?.email || shoot.client?.email}`} className="text-primary hover:underline block truncate">
                    {editedShoot.client?.email || shoot.client?.email}
                  </a>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-0.5 text-xs">
            <div className="font-medium">{shoot.client?.name}</div>
            {shoot.client?.company && (
              <div className="text-muted-foreground">{shoot.client.company}</div>
            )}
            {shoot.client?.email && (
              <a href={`mailto:${shoot.client.email}`} className="text-primary hover:underline block truncate">
                {shoot.client.email}
              </a>
            )}
            {shoot.client?.phone && (
              <a href={`tel:${shoot.client.phone}`} className="text-primary hover:underline block">
                {shoot.client.phone}
              </a>
            )}
          </div>
        )}
      </div>
      )}
      
      {/* Property Access Card - Lockbox or Access Contact Info */}
      <div className="p-2.5 border rounded-lg bg-card">
        <div className="flex items-center gap-1.5 mb-1.5">
          {presenceOption === 'lockbox' ? (
            <Key className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">
            Property Access
          </span>
        </div>
        {isEditMode ? (
          <div className="space-y-3 text-xs">
            <RadioGroup
              value={presenceOption}
              onValueChange={(value) => setPresenceOption(value as 'self' | 'other' | 'lockbox')}
              className="grid grid-cols-3 gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="self" id="presence-self" />
                <Label htmlFor="presence-self" className="text-xs cursor-pointer">Self</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="presence-other" />
                <Label htmlFor="presence-other" className="text-xs cursor-pointer">Other contact</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="lockbox" id="presence-lockbox" />
                <Label htmlFor="presence-lockbox" className="text-xs cursor-pointer">Lockbox</Label>
              </div>
            </RadioGroup>
            {presenceOption === 'lockbox' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Lockbox code</span>
                  <Input
                    value={lockboxCode}
                    onChange={(e) => setLockboxCode(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="####"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Location / instructions</span>
                  <Input
                    value={lockboxLocation}
                    onChange={(e) => setLockboxLocation(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="e.g., on the gate"
                  />
                </div>
              </div>
            )}
            {presenceOption === 'other' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Contact name</span>
                  <Input
                    value={accessContactName}
                    onChange={(e) => setAccessContactName(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Full name"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Contact phone</span>
                  <Input
                    value={accessContactPhone}
                    onChange={(e) => setAccessContactPhone(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            )}
            {presenceOption === 'self' && (
              <p className="text-muted-foreground text-[11px]">Client will be present at the property.</p>
            )}
          </div>
        ) : (
          (() => {
            const details = propertyDetails || {};
            const hasLockboxData = !!(details.lockboxCode || details.lockboxLocation);
            const hasAccessContactData = !!(details.accessContactName || details.accessContactPhone);
            if (!hasLockboxData && !hasAccessContactData) {
              return <div className="text-xs text-muted-foreground">No access details provided.</div>;
            }
            const isLockbox = hasLockboxData || details.presenceOption === 'lockbox';
            return (
              <div className="space-y-1 text-xs">
                {isLockbox ? (
                  <>
                    {details.lockboxCode && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Code:</span>
                        <span className="font-medium font-mono">{details.lockboxCode}</span>
                      </div>
                    )}
                    {details.lockboxLocation && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-muted-foreground">Location:</span>
                        <span className="font-medium text-right flex-1">{details.lockboxLocation}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {details.accessContactName && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">On-site Contact:</span>
                        <span className="font-medium">{details.accessContactName}</span>
                      </div>
                    )}
                    {details.accessContactPhone && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Contact Phone:</span>
                        <a href={`tel:${details.accessContactPhone}`} className="font-medium text-primary hover:underline">
                          {details.accessContactPhone}
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()
        )}
      </div>

      {/* Photographer Card - Hide from editors */}
      {!isEditor && (
        <div className="p-2.5 border rounded-lg bg-card">
          <div className="flex items-center gap-1.5 mb-1.5">
            <CameraIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Photographer</span>
          </div>
        {isEditMode ? (
          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-3 font-medium w-full"
              onClick={() => setAssignPhotographerOpen(true)}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              {editedShoot.photographer?.name || shoot.photographer?.name || 'Assign Photographer'}
            </Button>
            {(editedShoot.photographer?.name || shoot.photographer?.name) && (
              <div className="text-xs">
                <div className="font-medium">{editedShoot.photographer?.name || shoot.photographer?.name}</div>
                {(editedShoot.photographer as any)?.email && (
                  <a href={`mailto:${(editedShoot.photographer as any).email}`} className="text-primary hover:underline block truncate text-[10px]">
                    {(editedShoot.photographer as any).email}
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {shoot.photographer ? (
              <div className="space-y-0.5 text-xs">
                <div className="font-medium">{shoot.photographer.name}</div>
                {(shoot.photographer as any)?.email && (
                  <a 
                    href={`mailto:${(shoot.photographer as any).email}`}
                    className="text-primary hover:underline block truncate"
                  >
                    {(shoot.photographer as any).email}
                  </a>
                )}
                {(shoot.photographer as any)?.phone && (
                  <a 
                    href={`tel:${(shoot.photographer as any).phone}`}
                    className="text-primary hover:underline block"
                  >
                    {(shoot.photographer as any).phone}
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Not assigned</div>
                {isAdminOrRep && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3 font-medium"
                    onClick={() => setAssignPhotographerOpen(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    Assign
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* Completion Info Card - Only show if completed */}
      {shoot.completedDate && (
        <div className="p-2.5 border rounded-lg bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Completion</span>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed:</span>
              <span>{formatDate(shoot.completedDate)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Media Links Card - Editor only */}
      {isEditor && (
        <div className="p-2.5 border rounded-lg bg-card">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Media Links</span>
          </div>
          <div className="space-y-1.5 text-xs">
            {/* Dropbox Links */}
            {(shoot as any).dropbox_raw_folder && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">RAW Photos:</span>
                <a 
                  href={(shoot as any).dropbox_raw_folder} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <span>Open Dropbox</span>
                  <Link2 className="h-3 w-3" />
                </a>
              </div>
            )}
            {(shoot as any).dropbox_edited_folder && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Edited Photos:</span>
                <a 
                  href={(shoot as any).dropbox_edited_folder} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <span>Open Dropbox</span>
                  <Link2 className="h-3 w-3" />
                </a>
              </div>
            )}
            {/* Custom Media Links */}
            {(shoot as any).media_links && Array.isArray((shoot as any).media_links) && (shoot as any).media_links.length > 0 && (
              <div className="space-y-1 pt-1 border-t">
                <span className="text-muted-foreground block mb-1">Custom Links:</span>
                {(shoot as any).media_links.map((link: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-muted-foreground truncate flex-1 mr-2">{link.label || 'Media Link'}</span>
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>Open</span>
                      <Link2 className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}
            {/* Add Media Link Button */}
            {isEditMode && (
              <div className="pt-1 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2 w-full"
                  onClick={() => {
                    toast({
                      title: 'Add Media Link',
                      description: 'Media link management would be implemented here',
                    });
                  }}
                >
                  <Link2 className="h-3 w-3 mr-1" />
                  Add Media Link
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Summary Card */}
      <div className="p-2.5 border rounded-lg bg-card">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Payment</span>
        {isEditMode && isAdmin ? (
          <div className="space-y-1.5 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Base Quote:</span>
              <Input
                type="number"
                step="0.01"
                value={editedShoot.payment?.baseQuote ?? shoot.payment?.baseQuote ?? 0}
                onChange={(e) => updateField('payment.baseQuote', parseFloat(e.target.value) || 0)}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Tax Amount:</span>
              <Input
                type="number"
                step="0.01"
                value={editedShoot.payment?.taxAmount ?? shoot.payment?.taxAmount ?? 0}
                onChange={(e) => updateField('payment.taxAmount', parseFloat(e.target.value) || 0)}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Total Quote:</span>
              <Input
                type="number"
                step="0.01"
                value={editedShoot.payment?.totalQuote ?? shoot.payment?.totalQuote ?? 0}
                onChange={(e) => updateField('payment.totalQuote', parseFloat(e.target.value) || 0)}
                className="h-7 text-xs"
              />
            </div>
            <Separator className="my-1.5" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid:</span>
              <span>${(Number(shoot.payment?.totalPaid) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance:</span>
              <span className={((Number(editedShoot.payment?.totalQuote ?? shoot.payment?.totalQuote) || 0) - (Number(shoot.payment?.totalPaid) || 0) > 0) ? 'text-orange-600 font-medium' : 'text-green-600'}>
                ${((Number(editedShoot.payment?.totalQuote ?? shoot.payment?.totalQuote) || 0) - (Number(shoot.payment?.totalPaid) || 0)).toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5 text-xs">
            {isAdmin ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base:</span>
                  <span>${(Number(shoot.payment?.baseQuote) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax:</span>
                  <span>${(Number(shoot.payment?.taxAmount) || 0).toFixed(2)}</span>
                </div>
                <Separator className="my-1.5" />
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span>${(Number(shoot.payment?.totalQuote) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid:</span>
                  <span>${(Number(shoot.payment?.totalPaid) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance:</span>
                  <span className={((shoot.payment?.totalQuote || 0) - (shoot.payment?.totalPaid || 0) > 0) ? 'text-orange-600 font-medium' : 'text-green-600'}>
                    ${((shoot.payment?.totalQuote || 0) - (shoot.payment?.totalPaid || 0)).toFixed(2)}
                  </span>
                </div>
              </>
            ) : isClient ? (
              <>
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span>${(Number(shoot.payment?.totalQuote) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid:</span>
                  <span>${(Number(shoot.payment?.totalPaid) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Outstanding:</span>
                  <span className={((Number(shoot.payment?.totalQuote) || 0) - (Number(shoot.payment?.totalPaid) || 0) > 0) ? 'text-orange-600 font-medium' : 'text-green-600'}>
                    ${((Number(shoot.payment?.totalQuote) || 0) - (Number(shoot.payment?.totalPaid) || 0)).toFixed(2)}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">Not available</div>
            )}
          </div>
        )}
      </div>

      {/* Assign Photographer Dialog - Matching Book Shoot selector */}
      <Dialog open={assignPhotographerOpen} onOpenChange={(open) => {
        setAssignPhotographerOpen(open);
        if (!open) {
          setSearchQuery('');
          setSelectedPhotographerId('');
        }
      }}>
        <DialogContent className="sm:max-w-md w-full">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <DialogHeader>
                  <DialogTitle className="text-lg text-slate-900 dark:text-slate-100">Select Photographer</DialogTitle>
                  <DialogDescription>
                    Choose a photographer to assign to this shoot
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>

            {/* Search and Sort Controls */}
            <div className="space-y-3 mb-4">
              {/* Search Field */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search photographers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(value: 'distance' | 'name') => setSortBy(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">Sort by Distance</SelectItem>
                    <SelectItem value="name">Sort by Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {/* Scrollable content area */}
              <div className="pt-3 max-h-[48vh] overflow-y-auto pr-2">
                {isCalculatingDistances ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Calculating distances...</span>
                  </div>
                ) : filteredAndSortedPhotographers.length > 0 ? (
                  <div className="grid gap-3">
                    {filteredAndSortedPhotographers.map((photographerItem) => (
                      <div
                        key={photographerItem.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={photographerItem.avatar} alt={photographerItem.name} />
                            <AvatarFallback>{photographerItem.name?.charAt(0)}</AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {photographerItem.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              {photographerItem.distance !== undefined ? (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {photographerItem.distance} mi away
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Distance unavailable</span>
                              )}
                              {photographerItem.city && photographerItem.state && (
                                <span className="text-muted-foreground">
                                  • {photographerItem.city}, {getStateFullName(photographerItem.state)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhotographerId(photographerItem.id);
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors",
                              selectedPhotographerId === photographerItem.id
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600"
                            )}
                          >
                            {selectedPhotographerId === photographerItem.id ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                    {searchQuery ? 'No photographers found matching your search.' : 'No photographers available.'}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="pt-4">
                <div className="flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={() => {
                    setAssignPhotographerOpen(false);
                    setSearchQuery('');
                    setSelectedPhotographerId('');
                  }} className="w-full">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedPhotographerId) {
                        toast({
                          title: "No photographer selected",
                          description: "Please select a photographer before continuing.",
                          variant: "destructive",
                        });
                        return;
                      }
                      handleAssignPhotographer();
                    }}
                    className="w-full"
                    disabled={!selectedPhotographerId}
                  >
                    Assign
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



