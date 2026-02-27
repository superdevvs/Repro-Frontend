import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Client } from '@/types/clients';
import { initialClientsData } from '@/data/clientsData';
import {
  Aperture,
  Building2,
  Camera,
  ChevronsUpDown,
  Cuboid as Cube,
  Grid3x3,
  Home,
  Layers,
  Map as MapIcon,
  Palette,
  PenTool,
  PlusCircle,
  Search,
  Check,
  AlertCircle,
  Sparkles,
  Video,
  Info,
  Star,
  Tag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AddressLookupField from '@/components/AddressLookupField';
import { normalizeState, STATE_OPTIONS } from '@/utils/stateUtils';
// add near other imports at top
import { AccountForm } from '@/components/accounts/AccountForm';
import type { AccountFormValues } from '@/components/accounts/AccountForm';
import type { User } from '@/components/auth/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import API_ROUTES from '@/lib/api';
import { Loader2 } from 'lucide-react';
import type { ServiceWithPricing, SqftRange } from '@/utils/servicePricing';
import { formatPrice, getServicePricingForSqft } from '@/utils/servicePricing';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import { cn } from '@/lib/utils';


interface PackageCategory {
  id: string;
  name: string;
}

interface PackageOption extends ServiceWithPricing {
  id: string;
  name: string;
  description: string;
  price: number;
  category?: PackageCategory | null;
  pricing_type?: 'fixed' | 'variable';
  sqft_ranges?: ServiceWithPricing['sqft_ranges'];
  delivery_time?: ServiceWithPricing['delivery_time'];
  photographer_pay?: ServiceWithPricing['photographer_pay'];
}

type CategoryDisplay = {
  id: string;
  name: string;
  count: number;
  icon: LucideIcon;
  gradientClass: string;
  shadowClass: string;
  isPrimary?: boolean;
};

type PresenceOption = 'self' | 'other' | 'lockbox';

const extractAptSuite = (rawAddress: string) => {
  if (!rawAddress) {
    return { streetAddress: rawAddress, aptSuite: '' };
  }

  const patterns = [
    /\s*(?:#|Apt\.?|Apartment|Unit|Suite|Ste\.?)\s*([A-Za-z0-9-]+)/i,
  ];

  let streetAddress = rawAddress;
  let aptSuite = '';

  for (const pattern of patterns) {
    const match = streetAddress.match(pattern);
    if (match) {
      aptSuite = match[1].trim();
      streetAddress = streetAddress.replace(match[0], '');
      break;
    }
  }

  streetAddress = streetAddress
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

  return { streetAddress, aptSuite };
};

const CATEGORY_STYLE_PRESETS = [
  { gradientClass: 'from-sky-400 via-blue-500 to-indigo-600', shadowClass: 'shadow-lg shadow-blue-500/40' },
  { gradientClass: 'from-fuchsia-500 via-pink-500 to-rose-500', shadowClass: 'shadow-lg shadow-rose-500/40' },
  { gradientClass: 'from-amber-400 via-orange-500 to-red-500', shadowClass: 'shadow-lg shadow-orange-500/40' },
  { gradientClass: 'from-emerald-400 via-green-500 to-teal-500', shadowClass: 'shadow-lg shadow-emerald-500/40' },
  { gradientClass: 'from-indigo-400 via-violet-500 to-purple-600', shadowClass: 'shadow-lg shadow-indigo-500/40' },
  { gradientClass: 'from-cyan-400 via-sky-500 to-blue-500', shadowClass: 'shadow-lg shadow-cyan-500/40' },
] as const;

const ALL_CATEGORY_STYLE = { gradientClass: 'from-slate-600 via-slate-700 to-slate-900', shadowClass: 'shadow-lg shadow-slate-900/30' };
const FALLBACK_CATEGORY_NAME = 'More services';

const PRIMARY_CATEGORY_ORDER: Record<string, number> = {
  photos: 1,
  video: 2,
  drone: 3,
  '360': 4,
  '3d': 4,
  floor: 5,
  plan: 5,
  virtual: 6,
  staging: 6,
};

const PRIMARY_CATEGORY_ICONS: Array<{ keyword: string; icon: LucideIcon }> = [
  { keyword: 'photo', icon: Camera },
  { keyword: 'video', icon: Video },
  { keyword: 'drone', icon: Aperture },
  { keyword: '360', icon: Cube },
  { keyword: '3d', icon: Cube },
  { keyword: 'floor', icon: Layers },
  { keyword: 'plan', icon: Layers },
  { keyword: 'virtual', icon: Sparkles },
  { keyword: 'staging', icon: Sparkles },
];

const FALLBACK_ICONS: LucideIcon[] = [Camera, Video, Aperture, Cube, Layers, Sparkles, Palette, PenTool];

const getCategoryIcon = (name: string, index: number): LucideIcon => {
  const normalized = name?.toLowerCase?.() ?? '';
  const match = PRIMARY_CATEGORY_ICONS.find(({ keyword }) => normalized.includes(keyword));
  if (match) return match.icon;
  return FALLBACK_ICONS[index % FALLBACK_ICONS.length];
};

const getCategoryStyle = (index: number) => CATEGORY_STYLE_PRESETS[index % CATEGORY_STYLE_PRESETS.length];

const normalizeCategoryName = (name?: string) => {
  const normalized = (name || '').trim().toLowerCase();
  if (normalized === 'photo' || normalized === 'photos') return 'photos';
  return normalized;
};

const getPackageCategoryId = (pkg?: PackageOption | null) => {
  const normalizedName = normalizeCategoryName(pkg?.category?.name);
  if (normalizedName === 'photos') return 'photos';
  if (pkg?.category?.id) return pkg.category.id.toString();
  return normalizedName || 'uncategorized';
};

const getPackageCategoryName = (pkg?: PackageOption | null) => {
  const normalizedName = normalizeCategoryName(pkg?.category?.name);
  if (normalizedName === 'photos') return 'Photos';
  return pkg?.category?.name ?? FALLBACK_CATEGORY_NAME;
};

const getServiceSqftRanges = (service?: ServiceWithPricing | null) =>
  (service?.sqft_ranges || (service as any)?.sqftRanges || []) as SqftRange[];

const clientAccountPropertyFormSchema = z.object({
  propertyAddress: z.string().min(1, "Address is required"),
  aptSuite: z.string().optional(),
  propertyCity: z.string().min(1, "City is required"),
  propertyState: z.string()
    .min(1, "State is required")
    .max(2, "State must be a 2-letter abbreviation (e.g., CA, NY, DC)")
    .refine((val) => val.length === 2, "State must be exactly 2 characters"),
  propertyZip: z.string().min(1, "ZIP code is required"),
  bedRooms: z.number().min(0, "Bedrooms must be 0 or more").optional(),
  bathRooms: z.number().min(0, "Bathrooms must be 0 or more").optional(),
  sqft: z.number({ required_error: "Square footage is required" }).min(1, "Square footage is required"),
  propertyType: z.enum(["residential", "commercial"]),
  listingType: z.enum(["for_sale", "for_rent"]).optional(),
  propertyInfo: z.string().optional(),
  companyNotes: z.string().optional(),
  shootNotes: z.string().optional(),
  photographerNotes: z.string().optional(),
  editorNotes: z.string().optional(),
  selectedPackage: z.string().min(1, "Please select a package"),
  // Property access fields
  lockboxCode: z.string().optional(),
  lockboxLocation: z.string().optional(),
  accessContactName: z.string().optional(),
  accessContactPhone: z.string().optional(),
});

const adminPropertyFormSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  propertyAddress: z.string().min(1, "Address is required"),
  aptSuite: z.string().optional(),
  propertyCity: z.string().min(1, "City is required"),
  propertyState: z.string()
    .min(1, "State is required")
    .max(2, "State must be a 2-letter abbreviation (e.g., CA, NY, DC)")
    .refine((val) => val.length === 2, "State must be exactly 2 characters"),
  propertyZip: z.string().min(1, "ZIP code is required"),
  bedRooms: z.number().min(0, "Bedrooms must be 0 or more").optional(),
  bathRooms: z.number().min(0, "Bathrooms must be 0 or more").optional(),
  sqft: z.number({ required_error: "Square footage is required" }).min(1, "Square footage is required"),
  propertyType: z.enum(["residential", "commercial"]),
  listingType: z.enum(["for_sale", "for_rent"]).optional(),
  propertyInfo: z.string().optional(),
  companyNotes: z.string().optional(),
  shootNotes: z.string().optional(),
  photographerNotes: z.string().optional(),
  editorNotes: z.string().optional(),
  selectedPackage: z.string().min(1, "Please select a package"),
  // Property access fields
  lockboxCode: z.string().optional(),
  lockboxLocation: z.string().optional(),
  accessContactName: z.string().optional(),
  accessContactPhone: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientAccountPropertyFormSchema>;
type AdminFormValues = z.infer<typeof adminPropertyFormSchema>;
type FormValues = ClientFormValues | AdminFormValues;

type ClientPropertyFormProps = {
  onComplete: (data: any) => void;
  initialData: {
    clientId: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientCompany: string;
    propertyType: 'residential' | 'commercial';
    propertyAddress: string;
    propertyCity: string;
    propertyState: string;
    propertyZip: string;
    bedRooms?: number;
    bathRooms?: number;
    sqft?: number;
    propertyInfo?: string;
    lockboxCode?: string;
    lockboxLocation?: string;
    accessContactName?: string;
    accessContactPhone?: string;
    companyNotes?: string;
    shootNotes?: string;
    photographerNotes?: string;
    editorNotes?: string;
    selectedPackage?: string;
    completeAddress?: string;
    aptSuite?: string;
  };
  isClientAccount?: boolean;
  packages: PackageOption[];
  clients: Client[];
  /** ✅ Add this line **/
  onAddressFieldsChange?: (fields: { address: string; city: string; state: string; zip: string }) => void;
  onClientChange?: (clientId: string) => void;
  selectedServices: PackageOption[];
  onSelectedServicesChange: (services: PackageOption[]) => void;
  packagesLoading?: boolean;
  showClearSavedData?: boolean;
  onClearSavedData?: () => void;
};


export const ClientPropertyForm = ({
  onComplete,
  initialData,
  isClientAccount = false,
  packages,
  clients,
  onAddressFieldsChange,
  onClientChange,
  selectedServices,
  onSelectedServicesChange,
  packagesLoading = false,
  showClearSavedData = false,
  onClearSavedData,
}: ClientPropertyFormProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newlyAddedClients, setNewlyAddedClients] = useState<Client[]>([]);
  const lastClientIdRef = React.useRef<string | null>(null);

  // AccountForm control state
  const [isAccountFormOpen, setIsAccountFormOpen] = useState<boolean>(false);
  const [accountInitialData, setAccountInitialData] = useState<User | undefined>(undefined);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [stateDrawerOpen, setStateDrawerOpen] = useState(false);
  const [panelCategory, setPanelCategory] = useState<string>('all');
  const [presenceOption, setPresenceOption] = useState<PresenceOption>('self');
  const [propertyDetailsData, setPropertyDetailsData] = useState<any>(null);
  const [completeAddress, setCompleteAddress] = useState<string>('');
  const [submitAttemptNotice, setSubmitAttemptNotice] = useState<string | null>(null);
  const { toast } = useToast();

  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleClientSelectOpenChange = (open: boolean) => {
    setClientSelectOpen(open);
    if (!open) {
      setSearchQuery('');
    }
  };

  const handleInvalidSubmit = (errors: FieldErrors<FormValues>) => {
    const firstMessage = Object.values(errors).find((error) => {
      const message = (error as { message?: unknown } | undefined)?.message;
      return typeof message === 'string' && message.trim().length > 0;
    }) as { message?: string } | undefined;

    const noticeText = firstMessage?.message || 'Please complete all required fields before continuing.';

    setSubmitAttemptNotice(noticeText);
    toast({
      title: 'Missing required fields',
      description: noticeText,
      variant: 'destructive',
    });
  };

  const formSchema = isClientAccount ? clientAccountPropertyFormSchema : adminPropertyFormSchema;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: React.useMemo(() => (
      isClientAccount ? {
        propertyAddress: initialData.propertyAddress || '',
        aptSuite: initialData.aptSuite || '',
        propertyCity: initialData.propertyCity || '',
        propertyState: initialData.propertyState || '',
        propertyZip: initialData.propertyZip || '',
        bedRooms: initialData.bedRooms || 0,
        bathRooms: initialData.bathRooms || 0,
        sqft: initialData.sqft || 0,
        propertyType: initialData.propertyType || 'residential',
        listingType: (initialData as any).listingType || undefined,
        propertyInfo: initialData.propertyInfo || '',
        accessContactName: initialData.accessContactName || '',
        accessContactPhone: initialData.accessContactPhone || '',
        lockboxCode: initialData.lockboxCode || '',
        lockboxLocation: initialData.lockboxLocation || '',
        selectedPackage: initialData.selectedPackage || '',
        completeAddress: initialData.completeAddress || '',
        shootNotes: initialData.shootNotes || '',
        companyNotes: initialData.companyNotes || '',
        photographerNotes: initialData.photographerNotes || '',
        editorNotes: initialData.editorNotes || '',
      } : {
        clientId: initialData.clientId || '',
        propertyAddress: initialData.propertyAddress || '',
        aptSuite: initialData.aptSuite || '',
        propertyCity: initialData.propertyCity || '',
        propertyState: initialData.propertyState || '',
        propertyZip: initialData.propertyZip || '',
        bedRooms: initialData.bedRooms || 0,
        bathRooms: initialData.bathRooms || 0,
        sqft: initialData.sqft || 0,
        propertyType: initialData.propertyType || 'residential',
        listingType: (initialData as any).listingType || undefined,
        propertyInfo: initialData.propertyInfo || '',
        accessContactName: initialData.accessContactName || '',
        accessContactPhone: initialData.accessContactPhone || '',
        lockboxCode: initialData.lockboxCode || '',
        lockboxLocation: initialData.lockboxLocation || '',
        selectedPackage: initialData.selectedPackage || '',
        completeAddress: initialData.completeAddress || '',
        shootNotes: initialData.shootNotes || '',
        companyNotes: initialData.companyNotes || '',
        photographerNotes: initialData.photographerNotes || '',
        editorNotes: initialData.editorNotes || '',
      }
    ), [isClientAccount]), // ✅ only recompute when role type changes
  });

  const watchedClientId = form.watch('clientId' as any);

  // Keep parent state (for summary) in sync with address fields as they change
  React.useEffect(() => {
    if (!onAddressFieldsChange) return;
    const subscription = form.watch((values, info) => {
      // Only react to address-related fields to avoid noisy updates
      if (
        !info?.name ||
        info.name === 'propertyAddress' ||
        info.name === 'propertyCity' ||
        info.name === 'propertyState' ||
        info.name === 'propertyZip'
      ) {
        const address = (values as any).propertyAddress || '';
        const city = (values as any).propertyCity || '';
        const state = normalizeState((values as any).propertyState) || (values as any).propertyState || '';
        const zip = (values as any).propertyZip || '';
        onAddressFieldsChange({ address, city, state, zip });
      }
    });
    return () => subscription.unsubscribe?.();
  }, [form, onAddressFieldsChange]);

  React.useEffect(() => {
    if (!onClientChange || isClientAccount) return;
    const subscription = form.watch((values, info) => {
      if (!info?.name || info.name === 'clientId') {
        const clientId = (values as any).clientId || '';
        onClientChange(clientId);
      }
    });
    return () => subscription.unsubscribe?.();
  }, [form, onClientChange, isClientAccount]);

  React.useEffect(() => {
    const firstServiceId = selectedServices[0]?.id || '';
    form.setValue('selectedPackage' as any, firstServiceId, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [selectedServices, form]);

  // Seed complete address from initial data (so it is editable even before lookup)
  React.useEffect(() => {
    const parts = [
      initialData.completeAddress,
      initialData.propertyAddress,
      initialData.propertyCity,
      initialData.propertyState,
      initialData.propertyZip,
    ]
      .filter(Boolean)
      .map((p) => String(p).trim())
      .filter(Boolean);

    if (!completeAddress && parts.length) {
      setCompleteAddress(
        parts
          .join(', ')
          .replace(/, ([A-Z]{2}), /, ', $1 ')
          .trim(),
      );
    }
  }, [initialData, completeAddress]);

const derivedCategories = React.useMemo<CategoryDisplay[]>(() => {
    if (!packages?.length) return [];
    const map = new Map<string, CategoryDisplay>();
    packages.forEach((pkg) => {
      const id = getPackageCategoryId(pkg);
      const name = getPackageCategoryName(pkg);
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
        return;
      }
      const normalizedName = name.toLowerCase();
      const isPrimary = Object.keys(PRIMARY_CATEGORY_ORDER).some(key => normalizedName.includes(key));
      const palette = getCategoryStyle(map.size);
      map.set(id, {
        id,
        name,
        count: 1,
        icon: getCategoryIcon(name, map.size),
        gradientClass: palette.gradientClass,
        shadowClass: palette.shadowClass,
        isPrimary,
      });
    });
    return Array.from(map.values());
  }, [packages]);

  const categoryOptions = React.useMemo<CategoryDisplay[]>(() => {
    if (!packages?.length) return [];

    const sortedCategories = [...derivedCategories].sort((a, b) => {
      const aKey = Object.keys(PRIMARY_CATEGORY_ORDER).find(key => a.name.toLowerCase().includes(key));
      const bKey = Object.keys(PRIMARY_CATEGORY_ORDER).find(key => b.name.toLowerCase().includes(key));
      const aScore = aKey ? PRIMARY_CATEGORY_ORDER[aKey] : Number.MAX_SAFE_INTEGER;
      const bScore = bKey ? PRIMARY_CATEGORY_ORDER[bKey] : Number.MAX_SAFE_INTEGER;
      if (aScore === bScore) return a.name.localeCompare(b.name);
      return aScore - bScore;
    });

    return sortedCategories;
  }, [derivedCategories, packages]);

  React.useEffect(() => {
    if (categoryOptions.length === 0) return;
    const exists = categoryOptions.some(category => category.id === panelCategory);
    if (!exists) {
      setPanelCategory(categoryOptions[0].id);
    }
  }, [categoryOptions, panelCategory]);

    const panelServices = React.useMemo(() => {
    if (!packages?.length) return [];
    let filtered = panelCategory
      ? packages.filter(pkg => getPackageCategoryId(pkg) === panelCategory)
      : packages;

    const query = serviceSearchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((pkg) =>
        pkg.name.toLowerCase().includes(query) ||
        (pkg.description || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [panelCategory, packages, serviceSearchQuery]);

  React.useEffect(() => {
    if (!serviceDialogOpen) {
      setServiceSearchQuery('');
    }
  }, [serviceDialogOpen]);

  const watchedSqft = form.watch('sqft' as any);
  const derivedSqftFromDetails = React.useMemo(() => {
    const details = propertyDetailsData;
    if (!details) return null;
    return (
      details.sqft ??
      details.squareFeet ??
      details.livingArea ??
      details.living_area ??
      null
    );
  }, [propertyDetailsData]);

  const effectiveSqft = React.useMemo(() => {
    const numericFormSqft =
      typeof watchedSqft === 'number'
        ? watchedSqft
        : watchedSqft
        ? parseFloat(watchedSqft)
        : NaN;
    if (!Number.isNaN(numericFormSqft) && numericFormSqft > 0) {
      return numericFormSqft;
    }
    if (derivedSqftFromDetails && Number(derivedSqftFromDetails) > 0) {
      return Number(derivedSqftFromDetails);
    }
    return null;
  }, [watchedSqft, derivedSqftFromDetails]);

  // Recalculate selected services prices when sqft changes
  React.useEffect(() => {
    if (selectedServices.length === 0) return;

    const updatedServices = selectedServices.map(service => {
      const sqftRanges = getServiceSqftRanges(service);
      if (service.pricing_type === 'variable' && sqftRanges.length) {
        const pricingInfo = getServicePricingForSqft({ ...service, sqft_ranges: sqftRanges }, effectiveSqft);
        return { ...service, price: pricingInfo.price };
      }
      return service;
    });
    
    // Only update if prices actually changed to avoid infinite loop
    const pricesChanged = updatedServices.some((updated, idx) => 
      updated.price !== selectedServices[idx].price
    );
    
    if (pricesChanged) {
      onSelectedServicesChange(updatedServices);
    }
  }, [effectiveSqft]); // Only run when sqft changes

  const isSearching = searchQuery.trim().length > 0;
  
  // Combine passed-in clients with newly added clients (newly added first)
  const allClients = React.useMemo(() => {
    const existingIds = new Set(clients.map(c => c.id));
    const uniqueNewClients = newlyAddedClients.filter(c => !existingIds.has(c.id));
    return [...uniqueNewClients, ...clients];
  }, [clients, newlyAddedClients]);
  
  const filteredClients = React.useMemo(() => {
    if (!isSearching) return allClients;
    const query = searchQuery.toLowerCase();
    return allClients.filter(client =>
      client.name.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      (client.company && client.company.toLowerCase().includes(query))
    );
  }, [allClients, searchQuery, isSearching]);

  // Show newly added clients even without search, plus filtered results when searching
  const visibleClients = filteredClients;

  React.useEffect(() => {
    if (isClientAccount || !watchedClientId) return;
    if (lastClientIdRef.current === watchedClientId) return;
    const matchingClient = allClients.find(client => client.id === watchedClientId);
    const nextCompanyNotes = matchingClient?.companyNotes || (matchingClient as any)?.company_notes || '';
    form.setValue('companyNotes' as any, nextCompanyNotes, {
      shouldDirty: false,
      shouldValidate: false,
    });
    lastClientIdRef.current = watchedClientId;
  }, [watchedClientId, allClients, isClientAccount, form]);

  const selectedClientId = !isClientAccount ? (form.getValues() as AdminFormValues).clientId : '';
  const selectedClient = selectedClientId ? allClients.find(client => client.id === selectedClientId) : null;

  const handleSubmit = (data: FormValues) => {
    setSubmitAttemptNotice(null);

    const normalizedComplete =
      completeAddress ||
      [data.propertyAddress, data.propertyCity, data.propertyState, data.propertyZip]
        .filter(Boolean)
        .join(', ')
        .trim();

    // Merge property details from address lookup with access info from form
    // Convert empty strings to undefined to avoid saving empty values
    const mergedPropertyDetails = {
      ...(propertyDetailsData || {}),
      presenceOption: presenceOption,
      lockboxCode: data.lockboxCode?.trim() || undefined,
      lockboxLocation: data.lockboxLocation?.trim() || undefined,
      accessContactName: data.accessContactName?.trim() || undefined,
      accessContactPhone: data.accessContactPhone?.trim() || undefined,
      // Include property measurements from form
      bedrooms: data.bedRooms || undefined,
      bathrooms: data.bathRooms || undefined,
      sqft: data.sqft || undefined,
      propertyType: data.propertyType || undefined,
    };
    
    const baseData = {
      ...data,
      completeAddress: normalizedComplete || undefined,
      property_details: Object.keys(mergedPropertyDetails).length > 0 ? mergedPropertyDetails : undefined,
      listingType: (data as any).listingType || undefined,
    };

    if (isClientAccount) {
      onComplete({
        ...baseData,
        clientId: initialData.clientId,
        clientName: initialData.clientName,
        clientEmail: initialData.clientEmail,
        clientPhone: initialData.clientPhone,
        clientCompany: initialData.clientCompany,
      });
    } else {
      onComplete({
        ...baseData,
        clientName: selectedClient?.name || '',
        clientEmail: selectedClient?.email || '',
        clientPhone: selectedClient?.phone || '',
        clientCompany: selectedClient?.company || '',
      });
    }
  };


  const handleAccountFormSubmit = (data: AccountFormValues) => {
    // Create a client object from the returned account form data
    // The AccountForm already created the user via API, so we just need to add to local list
    if (data.id) {
      const newClient: Client = {
        id: String(data.id),
        name: data.name || `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        phone: data.phone || '',
        company: data.company || '',
        status: 'active',
        shootsCount: 0,
        lastActivity: new Date().toISOString(),
        companyNotes: data.companyNotes || '',
      };
      
      // Add to local newly added clients list
      setNewlyAddedClients(prev => [newClient, ...prev]);
      
      // Select the new client in the form
      form.setValue('clientId' as any, newClient.id);
      
      // Clear search so the new client is visible
      setSearchQuery('');
      
      toast({
        title: "Client created",
        description: `${newClient.name} has been added and selected.`,
      });
    }
    
    // Close modal
    setIsAccountFormOpen(false);
  };

  const navigateToNewClient = () => {
    // Open AccountForm modal for creating a NEW client
    setAccountInitialData(undefined);
    setIsAccountFormOpen(true);
  };

  const isServiceSelected = (serviceId: string) =>
    selectedServices.some(service => service.id === serviceId);

  const toggleServiceSelection = (service: PackageOption) => {
    const exists = isServiceSelected(service.id);
    let updatedServices: PackageOption[];

    if (exists) {
      // Remove service
      updatedServices = selectedServices.filter(selected => selected.id !== service.id);
    } else {
      // Add service with sqft-adjusted price if applicable
      let adjustedService = { ...service };
      const sqftRanges = getServiceSqftRanges(service);
      if (service.pricing_type === 'variable' && effectiveSqft && sqftRanges.length) {
        const pricingInfo = getServicePricingForSqft({ ...service, sqft_ranges: sqftRanges }, effectiveSqft);
        adjustedService = { ...service, price: pricingInfo.price };
      }
      updatedServices = [...selectedServices, adjustedService];
    }

    onSelectedServicesChange(updatedServices);

    if (isMobile && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  };

  const handleRemoveService = (serviceId: string) => {
    const updated = selectedServices.filter(service => service.id !== serviceId);
    onSelectedServicesChange(updated);
  };

  const selectedServicesTotal = React.useMemo(
    () =>
      selectedServices.reduce((total, service) => {
        const numericPrice = Number(service.price ?? 0);
        return total + (Number.isFinite(numericPrice) ? numericPrice : 0);
      }, 0),
    [selectedServices],
  );

  const renderServicePickerBody = (mobileDrawer = false) => (
    <div className="flex h-full min-h-0 flex-col sm:h-[70vh] sm:flex-row overflow-hidden">
      <aside className="shrink-0 border-b sm:border-b-0 sm:border-r border-border/60 px-2.5 py-1.5 sm:p-4 sm:w-64 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:overflow-y-auto sm:max-h-[70vh]">
        <div className="-mx-1.5 flex gap-1.5 overflow-x-auto px-1.5 pb-1 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:flex-col sm:gap-2 sm:overflow-visible sm:pb-0 sm:snap-none">
          {categoryOptions.map((category) => {
            const isActive = category.id === panelCategory;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setPanelCategory(category.id)}
                className={`snap-start rounded-full sm:rounded-lg border px-3 sm:px-4 py-1.5 sm:py-2.5 text-left transition-all duration-200 flex items-center gap-1.5 sm:gap-3 flex-shrink-0 min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] sm:border-primary/60 sm:bg-primary/10 sm:text-primary sm:shadow-none'
                    : 'border-border/60 bg-background/80 text-foreground/85 hover:border-primary/40 hover:bg-primary/5 sm:border-transparent sm:bg-transparent sm:text-muted-foreground sm:hover:bg-muted/40'
                } ${category.id === 'all' ? 'min-w-[112px] sm:w-full' : 'min-w-[98px] sm:w-full'}`}
              >
                <div className="hidden h-8 w-8 sm:flex sm:h-9 sm:w-9 rounded-full bg-muted items-center justify-center flex-shrink-0">
                  <category.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex items-center gap-1.5 sm:block">
                  <p className="text-xs sm:text-sm font-medium leading-tight truncate">{category.name}</p>
                  <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold leading-none tabular-nums sm:hidden ${
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {category.count}
                  </span>
                  <p className="hidden sm:block text-[11px] sm:text-xs text-muted-foreground">{category.count} items</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto px-2.5 sm:p-6 space-y-2.5 sm:space-y-4",
          mobileDrawer ? "pb-4" : "pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:pb-6"
        )}
      >
        <div className="sticky top-0 z-20 -mx-2.5 px-2.5 py-2 sm:static sm:mx-0 sm:px-0 sm:py-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 border-b border-border/50 sm:border-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search services..."
              value={serviceSearchQuery}
              onChange={(event) => setServiceSearchQuery(event.target.value)}
              className="h-9 text-sm pl-8 border-border/70 focus-visible:ring-primary/40"
            />
          </div>
        </div>

        {packagesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : panelServices.length ? (
          <div className="grid gap-2.5 sm:gap-4 sm:grid-cols-2">
            {panelServices.map((service) => {
              const isSelected = isServiceSelected(service.id);
              const sqftRanges = getServiceSqftRanges(service);
              const supportsVariablePricing = !!(
                effectiveSqft &&
                service.pricing_type === 'variable' &&
                sqftRanges.length
              );
              const pricingInfo = supportsVariablePricing
                ? getServicePricingForSqft({ ...service, sqft_ranges: sqftRanges }, effectiveSqft)
                : null;
              const displayPrice = pricingInfo
                ? formatPrice(pricingInfo.price)
                : formatPrice(Number(service.price ?? 0));
              const matchedRange = pricingInfo?.matchedRange;
              const sqftContext = matchedRange
                ? `${matchedRange.sqft_from.toLocaleString()} - ${matchedRange.sqft_to.toLocaleString()} sqft tier`
                : supportsVariablePricing
                  ? `Using default price for ${effectiveSqft?.toLocaleString()} sqft`
                  : null;

              return (
                <div
                  key={service.id}
                  className={`group relative overflow-hidden rounded-lg sm:rounded-2xl border border-l-4 p-3 sm:p-4 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-primary/55 border-l-primary bg-primary/[0.08] shadow-[0_6px_18px_-12px_rgba(59,130,246,0.65)]'
                      : 'border-border/70 border-l-border/80 bg-background hover:border-primary/35 hover:border-l-primary/40'
                  }`}
                  onClick={() => toggleServiceSelection(service)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] sm:text-base font-semibold leading-tight line-clamp-1">{service.name}</p>
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground line-clamp-2">
                        {service.description}
                      </p>
                      {sqftContext && (
                        <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                          {sqftContext}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-base sm:text-lg font-semibold tabular-nums leading-none text-foreground">
                        {displayPrice}
                      </span>
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors sm:hidden ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-transparent'
                      }`}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <Checkbox
                        className="hidden sm:inline-flex"
                        checked={isSelected}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={() => toggleServiceSelection(service)}
                      />
                    </div>
                  </div>
                  {service.category?.name && (
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="uppercase text-[10px] tracking-wide">
                        {service.category.name}
                        {supportsVariablePricing && matchedRange && (
                          <span className="ml-1 text-[8px] tracking-normal text-primary">SQFT</span>
                        )}
                      </Badge>
                      {isSelected && (
                        <span className="text-[11px] font-medium text-primary sm:hidden">Selected</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-left text-sm text-muted-foreground">
            {serviceSearchQuery.trim()
              ? 'No services match this search in the selected category.'
              : 'No services exist in this category yet. Pick a different category to continue.'}
          </div>
        )}
      </div>
    </div>
  );

  const renderServicePickerFooterContent = (mobileDrawer = false) => (
    <>
      <div className={cn("min-w-0", !mobileDrawer && "sm:hidden") }>
        <p className="text-sm font-semibold leading-tight">
          {selectedServices.length} Selected · {formatPrice(selectedServicesTotal)}
        </p>
      </div>
      {!mobileDrawer && (
        <p className="hidden sm:block text-sm text-muted-foreground mr-auto">
          {selectedServices.length} selected · {formatPrice(selectedServicesTotal)}
        </p>
      )}
      <Button
        className="h-10 px-5"
        disabled={selectedServices.length === 0}
        onClick={() => setServiceDialogOpen(false)}
      >
        Done
      </Button>
    </>
  );


  const getPackageHighlight = (pkg: { id: string; name: string }) => {
    if (pkg.name === 'Premium') return { icon: <Star className="h-4 w-4 text-amber-500" />, label: 'Most Popular' };
    if (pkg.name === 'Standard') return { icon: <Star className="h-4 w-4 text-blue-500" />, label: 'Best Value' };
    return null;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)} className="space-y-6">
        {!isClientAccount && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:border-border dark:bg-card/40 p-4 sm:p-5 space-y-4">
            <h3 className="text-base font-semibold">Client Information</h3>

            <div className="space-y-3">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => {
                  const selectedClient = allClients.find((client) => client.id === field.value);
                  const selectedLabel = selectedClient?.name || 'Choose client';
                  const emptyLabel = isSearching ? 'No clients found for this search.' : 'No clients available.';
                  const handleSelectClient = (clientId: string) => {
                    field.onChange(clientId);
                    handleClientSelectOpenChange(false);
                  };

                  const clientCommand = (
                    <Command shouldFilter={false} className="rounded-lg">
                      <CommandInput
                        placeholder="Search clients..."
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        className="h-10"
                      />
                      <CommandList className="max-h-[35vh] sm:max-h-[260px] overflow-y-auto">
                        <CommandEmpty>{emptyLabel}</CommandEmpty>
                        <CommandGroup>
                          {visibleClients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={`${client.name} ${client.email ?? ''} ${client.company ?? ''}`}
                              onSelect={() => handleSelectClient(client.id)}
                              className="flex items-start gap-3"
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={getAvatarUrl(client.avatar, 'client', undefined, client.id)}
                                  alt={client.name}
                                />
                                <AvatarFallback
                                  className={field.value === client.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                  }
                                >
                                  {client.name
                                    .split(' ')
                                    .map((part) => part[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium truncate">{client.name}</span>
                                  {field.value === client.id && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                                {client.company && (
                                  <div className="text-xs text-muted-foreground truncate">{client.company}</div>
                                )}
                                {client.email && (
                                  <div className="text-xs text-muted-foreground truncate">{client.email}</div>
                                )}
                                {(() => {
                                  const repValue = (client as any).rep;
                                  const repLabel =
                                    typeof repValue === 'string'
                                      ? repValue
                                      : repValue && typeof repValue === 'object'
                                        ? repValue.name ?? ''
                                        : '';
                                  return repLabel ? (
                                    <div className="text-[10px] text-primary mt-1 font-medium">
                                      Rep: {repLabel}
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  );

                  return (
                    <FormItem className="space-y-2">
                      <div className="space-y-2">
                        <FormLabel className="text-sm font-semibold text-foreground">Choose client</FormLabel>
                        <div className="flex items-center gap-2 md:items-end md:gap-3 md:justify-start">
                          <div className="w-full min-w-0 md:flex-1">
                            {isMobile ? (
                              <>
                                <FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={clientSelectOpen}
                                    className="w-full justify-between h-12 text-sm font-normal"
                                    onClick={() => handleClientSelectOpenChange(true)}
                                  >
                                    <span className="flex items-center gap-2 min-w-0">
                                      {selectedClient && (
                                        <Avatar className="h-8 w-8">
                                          <AvatarImage
                                            src={getAvatarUrl(selectedClient.avatar, 'client', undefined, selectedClient.id)}
                                            alt={selectedClient.name}
                                          />
                                          <AvatarFallback className="text-[10px]">
                                            {selectedClient.name
                                              .split(' ')
                                              .map((part) => part[0])
                                              .join('')
                                              .slice(0, 2)
                                              .toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                      )}
                                      <span className="truncate">{selectedLabel}</span>
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                                <Drawer open={clientSelectOpen} onOpenChange={handleClientSelectOpenChange}>
                                  <DrawerContent className="h-[63vh] max-h-[63vh]">
                                    <DrawerHeader className="pb-2">
                                      <DrawerTitle>Choose client</DrawerTitle>
                                    </DrawerHeader>
                                    <div className="px-4 pb-4">
                                      {clientCommand}
                                    </div>
                                  </DrawerContent>
                                </Drawer>
                              </>
                            ) : (
                              <Popover open={clientSelectOpen} onOpenChange={handleClientSelectOpenChange}>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={clientSelectOpen}
                                      className="w-full justify-between h-12 text-sm font-normal"
                                    >
                                      <span className="flex items-center gap-2 min-w-0">
                                        {selectedClient && (
                                          <Avatar className="h-8 w-8">
                                            <AvatarImage
                                              src={getAvatarUrl(selectedClient.avatar, 'client', undefined, selectedClient.id)}
                                              alt={selectedClient.name}
                                            />
                                            <AvatarFallback className="text-[10px]">
                                              {selectedClient.name
                                                .split(' ')
                                                .map((part) => part[0])
                                                .join('')
                                                .slice(0, 2)
                                                .toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                        )}
                                        <span className="truncate">{selectedLabel}</span>
                                      </span>
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-[var(--radix-popover-trigger-width)] p-0 shadow-lg"
                                  align="start"
                                  sideOffset={4}
                                >
                                  {clientCommand}
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="shrink-0 h-12 px-4 bg-blue-600 text-white hover:bg-blue-700"
                            onClick={navigateToNewClient}
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            New Client
                          </Button>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:border-border dark:bg-card/40 p-4 sm:p-5 space-y-4">
          <h3 className="text-base font-semibold">Property Details</h3>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="propertyType"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-semibold text-foreground">Property Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      <div className="relative">
                        <RadioGroupItem value="residential" id="residential" className="peer sr-only" />
                        <Label
                          htmlFor="residential"
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium transition hover:border-primary/60 hover:bg-primary/5 peer-data-[state=checked]:border-primary/70 peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary"
                        >
                          <Home className="h-4 w-4" />
                          Residential
                        </Label>
                      </div>
                      <div className="relative">
                        <RadioGroupItem value="commercial" id="commercial" className="peer sr-only" />
                        <Label
                          htmlFor="commercial"
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium transition hover:border-primary/60 hover:bg-primary/5 peer-data-[state=checked]:border-primary/70 peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary"
                        >
                          <Building2 className="h-4 w-4" />
                          Commercial
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={"listingType" as any}
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-semibold text-foreground">Listing Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      <div className="relative">
                        <RadioGroupItem value="for_sale" id="for_sale" className="peer sr-only" />
                        <Label
                          htmlFor="for_sale"
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium transition hover:border-green-500/60 hover:bg-green-500/5 peer-data-[state=checked]:border-green-500/70 peer-data-[state=checked]:bg-green-500/10 peer-data-[state=checked]:text-green-700 dark:peer-data-[state=checked]:text-green-400"
                        >
                          <Tag className="h-4 w-4" />
                          For Sale
                        </Label>
                      </div>
                      <div className="relative">
                        <RadioGroupItem value="for_rent" id="for_rent" className="peer sr-only" />
                        <Label
                          htmlFor="for_rent"
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium transition hover:border-blue-500/60 hover:bg-blue-500/5 peer-data-[state=checked]:border-blue-500/70 peer-data-[state=checked]:bg-blue-500/10 peer-data-[state=checked]:text-blue-700 dark:peer-data-[state=checked]:text-blue-400"
                        >
                          <Tag className="h-4 w-4" />
                          For Rent
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="propertyAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground">Search Address</FormLabel>
                    <FormControl>
                      <AddressLookupField
                        value={field.value}
                        onChange={field.onChange}
                        onAddressSelect={(address) => {
                          console.log('🏠 ClientPropertyForm onAddressSelect called:', address);
                          
                          // Auto-fill city, state, and zip when address is selected
                          const city = address.city || '';
                          form.setValue('propertyCity', city, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                          // Normalize state to 2-letter abbreviation
                          const normalizedState = normalizeState(address.state) || address.state || '';
                          form.setValue('propertyState', normalizedState, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                          const zip = address.zip || '';
                          form.setValue('propertyZip', zip, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                          
                          // Extract only street address by removing city/state/zip from full address
                          let streetAddress = address.address || address.formatted_address || '';
                          if (streetAddress && (city || normalizedState || zip)) {
                            // Remove city, state, zip from the address string
                            if (city) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${city}\\s*,?`, 'gi'), '');
                            if (normalizedState) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${normalizedState}\\s*,?`, 'gi'), '');
                            if (address.state && address.state !== normalizedState) {
                              streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${address.state}\\s*,?`, 'gi'), '');
                            }
                            if (zip) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${zip}\\s*`, 'gi'), '');
                            // Clean up trailing/leading commas and spaces
                            streetAddress = streetAddress.replace(/^[,\s]+|[,\s]+$/g, '').trim();
                          }

                          const { streetAddress: normalizedStreet, aptSuite } = extractAptSuite(streetAddress);
                          const resolvedAptSuite = (address.apt_suite || aptSuite || '').trim();

                          form.setValue('propertyAddress', normalizedStreet, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                          form.setValue('aptSuite', resolvedAptSuite, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                          
                          // Set only street address (not full address with city/state/zip)
                          setCompleteAddress(normalizedStreet);

                          onAddressFieldsChange?.({
                            address: normalizedStreet,
                            city,
                            state: normalizedState,
                            zip,
                          });
                          
                          // Auto-fill property details (bedrooms, bathrooms, sqft) from address lookup
                          console.log('🏠 Property metrics from address:', {
                            bedrooms: address.bedrooms,
                            bathrooms: address.bathrooms,
                            sqft: address.sqft,
                          });
                          
                          if (address.bedrooms !== undefined && address.bedrooms !== null) {
                            console.log('Setting bedRooms to:', address.bedrooms);
                            form.setValue('bedRooms' as any, address.bedrooms, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                          }
                          if (address.bathrooms !== undefined && address.bathrooms !== null) {
                            console.log('Setting bathRooms to:', address.bathrooms);
                            form.setValue('bathRooms' as any, address.bathrooms, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                          }
                          if (address.sqft !== undefined && address.sqft !== null) {
                            console.log('Setting sqft to:', address.sqft);
                            form.setValue('sqft' as any, address.sqft, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                          }
                          
                          // Store property details if available
                          if (address.property_details) {
                            setPropertyDetailsData(address.property_details);
                          }
                        }}
                        placeholder="Start typing the property address..."
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-muted-foreground">
                      Start typing to see address suggestions. Selecting an address will auto-fill city, state, and ZIP code.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Editable Street Address Field - always visible */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="completeAddress" className="text-sm font-semibold text-foreground">Street Address</Label>
                  <Input
                    id="completeAddress"
                    value={completeAddress}
                    onChange={(e) => setCompleteAddress(e.target.value)}
                    placeholder="Street address"
                    className="font-medium"
                  />
                  <p className="text-xs text-muted-foreground">
                    You can manually edit this street address if needed.
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="aptSuite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">Apt/Suite</FormLabel>
                      <FormControl>
                        <Input placeholder="Unit #" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="propertyCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="propertyState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">State</FormLabel>
                      <FormControl>
                        {isMobile ? (
                          <Drawer open={stateDrawerOpen} onOpenChange={setStateDrawerOpen}>
                            <DrawerTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full h-10 justify-between font-normal"
                              >
                                <span className="truncate">
                                  {STATE_OPTIONS.find((option) => option.value === field.value)?.label || 'Select state'}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </DrawerTrigger>
                            <DrawerContent className="h-[63vh] max-h-[63vh]">
                              <DrawerHeader className="pb-2 text-left">
                                <DrawerTitle>Choose state</DrawerTitle>
                              </DrawerHeader>
                              <div className="px-4 pb-4 overflow-y-auto">
                                <div className="grid gap-1.5">
                                  {STATE_OPTIONS.map((option) => {
                                    const isSelected = field.value === option.value;
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                          field.onChange(option.value);
                                          setStateDrawerOpen(false);
                                        }}
                                        className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                                          isSelected
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border/60 bg-background hover:bg-muted/40'
                                        }`}
                                      >
                                        <span className="flex items-center justify-between gap-2">
                                          <span className="truncate">{option.label}</span>
                                          {isSelected && <Check className="h-4 w-4 shrink-0" />}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </DrawerContent>
                          </Drawer>
                        ) : (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="propertyZip"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-1 col-span-2">
                      <FormLabel className="text-xs font-medium text-muted-foreground">ZIP Code</FormLabel>
                      <FormControl>
                        <Input placeholder="ZIP Code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bedRooms"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-1 col-span-2">
                      <FormLabel className="text-xs font-medium text-muted-foreground">Bedrooms</FormLabel>
                      <FormControl>
                        {/* <Input placeholder="Bedrooms" {...field} /> */}
                        <Input
                          type="number"
                          placeholder="Bedrooms"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === '' ? 0 : Number(value));
                          }}
                        />


                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bathRooms"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-1 col-span-2">
                      <FormLabel className="text-xs font-medium text-muted-foreground">Bathroom</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Bathroom"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === '' ? 0 : Number(value));
                          }} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sqft"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-1 col-span-2">
                      <FormLabel className="text-xs font-medium text-muted-foreground">SQFT <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="sqft"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === '' ? undefined : Number(value));
                          }} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* <FormField
                control={form.control}
                name="propertyInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shoot Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Provide any additional information to attach to this shoot that will be visible to the client." 
                        className="resize-none" 
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />


              <FormField
                control={form.control}
                name="propertyInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Provide any additional information to save for the selected client that will only be visible to company admins/photographer.." 
                        className="resize-none" 
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}

            </div>
          </div>
        </div>

        <div className="pt-2">
          <Separator className="my-6" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-medium">Service Selection</h3>
              <p className="text-sm text-muted-foreground">
                Add the deliverables this booking includes, then review totals below.
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>Select multiple services inside the panel. You can revisit and adjust them anytime.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="rounded-xl border border-muted/40 bg-card/40 p-4 space-y-3 min-h-[140px]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Selected services</p>
                <p className="text-base font-semibold">
                  {selectedServices.length ? `${selectedServices.length} item${selectedServices.length > 1 ? 's' : ''}` : 'None yet'}
                </p>
              </div>
              {isMobile ? (
                <Drawer open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="outline" size="sm">
                      {selectedServices.length ? 'Edit services' : 'Select services'}
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="h-[84vh] max-h-[84vh]">
                    <DrawerHeader className="pb-2 text-left">
                      <DrawerTitle>Select services</DrawerTitle>
                      <DrawerDescription>
                        Pick the services for this shoot, compare prices quickly, then tap Done.
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="min-h-0 flex-1 overflow-hidden">{renderServicePickerBody(true)}</div>
                    <DrawerFooter className="border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))]">
                      {renderServicePickerFooterContent(true)}
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              ) : (
                <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      {selectedServices.length ? 'Edit services' : 'Select services'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:!max-h-[90vh] sm:!w-[96vw] sm:!max-w-5xl p-0 gap-0 overflow-hidden [&>button]:right-2 [&>button]:top-2">
                    <DialogHeader className="px-6 py-4 border-b border-border/80 text-left items-start space-y-1">
                      <DialogTitle className="w-full pr-10 text-left leading-tight">Select services</DialogTitle>
                      <DialogDescription className="w-full pr-10 text-left text-sm leading-snug">
                        Pick the services for this shoot, compare prices quickly, then tap Done.
                      </DialogDescription>
                    </DialogHeader>
                    {renderServicePickerBody(false)}
                    <DialogFooter className="px-6 py-4 border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 flex-row items-center justify-between gap-2 [padding-bottom:1rem]">
                      {renderServicePickerFooterContent(false)}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {selectedServices.length === 0 ? (
              packagesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-10 rounded-lg" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No services selected yet. Use the button to choose services.
                </p>
              )
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedServices.map(service => (
                  <Badge key={service.id} variant="secondary" className="flex items-center gap-2 py-1 px-3 text-sm">
                    {service.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveService(service.id)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <FormField
            control={form.control}
            name="selectedPackage"
            render={({ field }) => (
              <input type="hidden" value={field.value} onChange={field.onChange} />
            )}
          />
        </div>


        <div className="pt-2">
          <Separator className="my-6" />
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:border-border dark:bg-card/40 p-4 sm:p-5 space-y-4">
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold">Who will be at the property?</h3>
                </div>
                <RadioGroup
                  className="flex flex-wrap gap-4"
                  value={presenceOption}
                  onValueChange={(value) => setPresenceOption(value as PresenceOption)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem id="presence-self" value="self" />
                    <Label htmlFor="presence-self">Self / client</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem id="presence-other" value="other" />
                    <Label htmlFor="presence-other">Another contact</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem id="presence-lockbox" value="lockbox" />
                    <Label htmlFor="presence-lockbox">Lockbox</Label>
                  </div>
                </RadioGroup>
              </div>

              {presenceOption === 'other' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="accessContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">On-site contact name</FormLabel>
                        <FormControl>
                          <Input placeholder="Full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accessContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">On-site contact phone</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {presenceOption === 'lockbox' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:border-border dark:bg-card/40 p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="text-base font-semibold">Lockbox Details</h3>
                  <p className="text-sm text-muted-foreground">Share access info for the shoot.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lockboxCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">Lockbox code</FormLabel>
                        <FormControl>
                          <Input placeholder="####" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lockboxLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">Lockbox location / instructions</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., on the front gate" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:border-border dark:bg-card/40 p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold">Notes</h3>
            <p className="text-sm text-muted-foreground">Keep context for the client and internal teams.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField
              control={form.control}
              name="shootNotes"
              render={({ field }) => (
                <FormItem className="lg:col-span-2">
                  <FormLabel className="text-sm font-semibold text-foreground">Shoot Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide any additional information to attach to this shoot that will be visible to the client."
                      className="min-h-[120px] resize-none bg-white dark:bg-background/30 border-slate-200/80 dark:border-border/60 shadow-sm focus-visible:ring-primary/30"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Company Notes - Admin only (not for clients) */}
            {!isClientAccount && (
              <FormField
                control={form.control}
                name="companyNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">Company Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide any additional information to save for the selected client that will only be visible to company admins/photographer.."
                        className="min-h-[120px] resize-none bg-white dark:bg-background/30 border-slate-200/80 dark:border-border/60 shadow-sm focus-visible:ring-primary/30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Photographer Notes - Admin/Rep only (not for clients) */}
            {!isClientAccount && (
              <FormField
                control={form.control}
                name="photographerNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">Photographer Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Notes for the photographer (visible to photographer and admins)."
                        className="min-h-[120px] resize-none bg-white dark:bg-background/30 border-slate-200/80 dark:border-border/60 shadow-sm focus-visible:ring-primary/30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Editor Notes - Admin/Rep only (not for clients) */}
            {!isClientAccount && (
              <FormField
                control={form.control}
                name="editorNotes"
                render={({ field }) => (
                  <FormItem className="lg:col-span-2">
                    <FormLabel className="text-xs font-medium text-muted-foreground">Editor Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Notes for the editor (visible to editor and admins)."
                        className="min-h-[180px] resize-none bg-white dark:bg-background/30 border-slate-200/80 dark:border-border/60 shadow-sm focus-visible:ring-primary/30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-0">
          {submitAttemptNotice && (
            <div
              id="property-continue-warning"
              role="alert"
              className="w-full rounded-xl border border-amber-300/70 bg-amber-50/95 px-3 py-2.5 text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 sm:mr-auto sm:max-w-md"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700/90 dark:text-amber-200/90">
                    Action required
                  </p>
                  <p className="mt-0.5 text-sm leading-snug">
                    {submitAttemptNotice}
                  </p>
                </div>
              </div>
            </div>
          )}
          {showClearSavedData && onClearSavedData && (
            <Button
              type="button"
              variant="outline"
              onClick={onClearSavedData}
              className="w-full sm:w-auto"
            >
              Clear saved data
            </Button>
          )}
          <Button type="submit" className="w-full sm:w-auto">Continue</Button>
        </div>
      </form>

      <AccountForm
        open={isAccountFormOpen}
        onOpenChange={(open) => {
          setIsAccountFormOpen(open);
          if (!open) setAccountInitialData(undefined);
        }}
        onSubmit={handleAccountFormSubmit}
        initialData={accountInitialData}
      />
    </Form>
  );
}
