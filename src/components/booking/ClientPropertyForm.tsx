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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Client } from '@/types/clients';
import { initialClientsData } from '@/data/clientsData';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  ChevronsUpDown,
  Grid3x3,
  Home,
  Map as MapIcon,
  PlusCircle,
  AlertCircle,
  Check,
  Info,
  Tag,
} from 'lucide-react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AddressLookupField, { buildNormalizedPropertyDetails } from '@/components/AddressLookupField';
import { normalizeState, STATE_OPTIONS } from '@/utils/stateUtils';
// add near other imports at top
import { AccountForm } from '@/components/accounts/AccountForm';
import { EmailHealthBadge } from '@/components/accounts/EmailHealthBadge';
import type { AccountFormValues } from '@/components/accounts/AccountForm';
import type { User } from '@/components/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import API_ROUTES from '@/lib/api';
import { Loader2 } from 'lucide-react';
import type { ServiceWithPricing, SqftRange } from '@/utils/servicePricing';
import { getServicePricingForSqft } from '@/utils/servicePricing';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import { cn } from '@/lib/utils';
import type { EmailHealth } from '@/types/auth';
import { ServiceSelectionDialog, type ServiceSelectionOption } from '@/components/booking/ServiceSelectionDialog';


interface PackageCategory {
  id: string;
  name: string;
}

interface PackageOption extends ServiceSelectionOption {
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

const getServiceSqftRanges = (service?: any) =>
  (service?.sqft_ranges || (service as any)?.sqftRanges || []) as SqftRange[];

const getClientServiceGroupIds = (client?: Client | null) => {
  if (!client) return [];
  if (Array.isArray(client.service_group_ids) && client.service_group_ids.length > 0) {
    return client.service_group_ids.map((id) => String(id));
  }
  if (Array.isArray(client.service_groups) && client.service_groups.length > 0) {
    return client.service_groups.map((group) => String(group.id));
  }
  return [];
};

const getClientEmailHealthAlert = (emailHealth?: EmailHealth | null) => {
  const status = emailHealth?.status;
  if (!status || status === 'verified') {
    return null;
  }

  if (status === 'bounced' || status === 'invalid') {
    return {
      containerClassName:
        'border-rose-200 bg-rose-50/95 text-rose-950 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100',
      iconClassName: 'text-rose-600 dark:text-rose-300',
      message: 'Email needs correction.',
    };
  }

  if (status === 'risky') {
    return {
      containerClassName:
        'border-orange-200 bg-orange-50/95 text-orange-950 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-100',
      iconClassName: 'text-orange-600 dark:text-orange-300',
      message: 'Email looks unusual.',
    };
  }

  return {
    containerClassName:
      'border-amber-200 bg-amber-50/95 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100',
    iconClassName: 'text-amber-600 dark:text-amber-300',
    message: 'Email is unverified.',
  };
};

const getPackageServiceGroupIds = (pkg?: PackageOption | null) => {
  const ids = (pkg as any)?.service_group_ids;
  if (Array.isArray(ids) && ids.length > 0) {
    return ids.map((id: any) => String(id));
  }
  const groups = (pkg as any)?.service_groups;
  if (Array.isArray(groups) && groups.length > 0) {
    return groups.map((group: any) => String(group.id));
  }
  return [];
};

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

const invalidFieldClassName =
  'border-red-500/60 ring-1 ring-red-500/20 focus-visible:ring-red-500/30 dark:border-red-400/60 dark:ring-red-400/20 dark:focus-visible:ring-red-400/30';

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
    listingType?: 'for_sale' | 'for_rent';
    presenceOption?: PresenceOption;
    propertyDetails?: any;
    property_details?: any;
  };
  isClientAccount?: boolean;
  packages: PackageOption[];
  clients: Client[];
  /** ✅ Add this line **/
  onAddressFieldsChange?: (fields: { address: string; city: string; state: string; zip: string }) => void;
  onClientChange?: (clientId: string) => void;
  onPropertyDraftChange?: (data: any) => void;
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
  onPropertyDraftChange,
  selectedServices,
  onSelectedServicesChange,
  packagesLoading = false,
  showClearSavedData = false,
  onClearSavedData,
}: ClientPropertyFormProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newlyAddedClients, setNewlyAddedClients] = useState<Client[]>([]);
  const lastClientIdRef = React.useRef<string | null>(null);

  // AccountForm control state
  const [isAccountFormOpen, setIsAccountFormOpen] = useState<boolean>(false);
  const [accountInitialData, setAccountInitialData] = useState<User | undefined>(undefined);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [stateDrawerOpen, setStateDrawerOpen] = useState(false);
  const [presenceOption, setPresenceOption] = useState<PresenceOption>(() => {
    const initialPresence =
      initialData.presenceOption ||
      initialData.propertyDetails?.presenceOption ||
      initialData.property_details?.presenceOption;
    return initialPresence === 'other' || initialPresence === 'lockbox' || initialPresence === 'self'
      ? initialPresence
      : 'self';
  });
  const [propertyDetailsData, setPropertyDetailsData] = useState<any>(() => initialData.propertyDetails || initialData.property_details || null);
  const [completeAddress, setCompleteAddress] = useState<string>(() => initialData.completeAddress || initialData.propertyAddress || '');
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

  const showMissingFieldStroke = (name: keyof AdminFormValues) =>
    form.formState.submitCount > 0 && Boolean(form.formState.errors[name]);

  const watchedClientId = form.watch('clientId' as any);
  const allClients = React.useMemo(() => {
    const existingIds = new Set(clients.map(c => c.id));
    const uniqueNewClients = newlyAddedClients.filter(c => !existingIds.has(c.id));
    return [...uniqueNewClients, ...clients];
  }, [clients, newlyAddedClients]);
  const selectedClientId = !isClientAccount ? (watchedClientId || '') : '';
  const selectedClient = selectedClientId ? allClients.find(client => client.id === selectedClientId) : null;
  const selectedClientServiceGroupIds = React.useMemo(
    () => getClientServiceGroupIds(selectedClient),
    [selectedClient],
  );
  const visiblePackages = React.useMemo(() => {
    if (isClientAccount || selectedClientServiceGroupIds.length === 0) {
      return packages;
    }

    return packages.filter((pkg) => {
      const packageGroupIds = getPackageServiceGroupIds(pkg);
      return packageGroupIds.some((id) => selectedClientServiceGroupIds.includes(id));
    });
  }, [isClientAccount, packages, selectedClientServiceGroupIds]);

  React.useEffect(() => {
    if (isClientAccount || selectedClientServiceGroupIds.length === 0 || selectedServices.length === 0) {
      return;
    }

    const filteredServices = selectedServices.filter((service) => {
      const packageGroupIds = getPackageServiceGroupIds(service as PackageOption);
      return packageGroupIds.some((id) => selectedClientServiceGroupIds.includes(id));
    });

    if (filteredServices.length !== selectedServices.length) {
      onSelectedServicesChange(filteredServices);
      toast({
        title: 'Services updated',
        description: 'Unavailable services were removed for the selected client.',
      });
    }
  }, [isClientAccount, onSelectedServicesChange, selectedClientServiceGroupIds, selectedServices, toast]);

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

  const buildPropertyDraftData = React.useCallback(
    (
      values?: Partial<FormValues>,
      overrides?: {
        completeAddress?: string;
        propertyDetailsData?: any;
        presenceOption?: PresenceOption;
      },
    ) => {
      const currentValues = {
        ...form.getValues(),
        ...(values || {}),
      } as any;
      const currentCompleteAddress = overrides?.completeAddress ?? completeAddress;
      const currentPropertyDetails = overrides?.propertyDetailsData ?? propertyDetailsData;
      const currentPresenceOption = overrides?.presenceOption ?? presenceOption;
      const normalizedComplete =
        currentCompleteAddress ||
        [
          currentValues.propertyAddress,
          currentValues.propertyCity,
          currentValues.propertyState,
          currentValues.propertyZip,
        ]
          .filter(Boolean)
          .join(', ')
          .trim();
      const toOptionalNumber = (value: unknown) => {
        if (value === '' || value === null || value === undefined) {
          return undefined;
        }
        const numericValue = Number(value);
        return Number.isNaN(numericValue) ? undefined : numericValue;
      };
      const mergedPropertyDetails = {
        ...(currentPropertyDetails || {}),
        presenceOption: currentPresenceOption,
        aptSuite: currentValues.aptSuite?.trim() || undefined,
        completeAddress: normalizedComplete || undefined,
        lockboxCode: currentValues.lockboxCode?.trim() || undefined,
        lockboxLocation: currentValues.lockboxLocation?.trim() || undefined,
        accessContactName: currentValues.accessContactName?.trim() || undefined,
        accessContactPhone: currentValues.accessContactPhone?.trim() || undefined,
        bedrooms: toOptionalNumber(currentValues.bedRooms),
        bathrooms: toOptionalNumber(currentValues.bathRooms),
        sqft: toOptionalNumber(currentValues.sqft),
        propertyType: currentValues.propertyType || undefined,
        listingType: currentValues.listingType || undefined,
      };

      return {
        ...currentValues,
        completeAddress: normalizedComplete || undefined,
        property_details: mergedPropertyDetails,
        listingType: currentValues.listingType || undefined,
      };
    },
    [completeAddress, form, presenceOption, propertyDetailsData],
  );

  const clearAddressDerivedState = React.useCallback(
    ({ keepSearchField = true }: { keepSearchField?: boolean } = {}) => {
      const resetOptions = {
        shouldDirty: true,
        shouldTouch: false,
        shouldValidate: false,
      };

      if (!keepSearchField) {
        form.setValue('propertyAddress', '', resetOptions);
      }

      form.setValue('aptSuite', '', resetOptions);
      form.setValue('propertyCity', '', resetOptions);
      form.setValue('propertyState', '', resetOptions);
      form.setValue('propertyZip', '', resetOptions);
      form.setValue('bedRooms' as any, undefined, resetOptions);
      form.setValue('bathRooms' as any, undefined, resetOptions);
      form.setValue('sqft' as any, undefined, resetOptions);
      setCompleteAddress('');
      setPropertyDetailsData(null);
      const nextValues = {
        ...form.getValues(),
        propertyAddress: keepSearchField ? form.getValues('propertyAddress') || '' : '',
        aptSuite: '',
        propertyCity: '',
        propertyState: '',
        propertyZip: '',
        bedRooms: undefined,
        bathRooms: undefined,
        sqft: undefined,
      } as any;
      onAddressFieldsChange?.({
        address: keepSearchField ? form.getValues('propertyAddress') || '' : '',
        city: '',
        state: '',
        zip: '',
      });
      onPropertyDraftChange?.(
        buildPropertyDraftData(nextValues, {
          completeAddress: '',
          propertyDetailsData: null,
        }),
      );
    },
    [buildPropertyDraftData, form, onAddressFieldsChange, onPropertyDraftChange],
  );

  const buildLookupPropertyDetails = React.useCallback((address: any) => {
    return buildNormalizedPropertyDetails(address);
  }, []);

  // Recalculate selected services prices when sqft changes
  React.useEffect(() => {
    if (selectedServices.length === 0) return;

    const updatedServices = selectedServices.map(service => {
      const sqftRanges = getServiceSqftRanges(service);
      if (service.pricing_type === 'variable' && sqftRanges.length) {
        const pricingInfo = getServicePricingForSqft({ ...service, sqft_ranges: sqftRanges } as ServiceWithPricing, effectiveSqft);
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

  React.useEffect(() => {
    if (!onPropertyDraftChange) return;
    const subscription = form.watch((values, info) => {
      if (!info?.name) return;
      onPropertyDraftChange(buildPropertyDraftData(values as Partial<FormValues>));
    });
    return () => subscription.unsubscribe?.();
  }, [buildPropertyDraftData, form, onPropertyDraftChange]);

  const handleSubmit = (data: FormValues) => {
    setSubmitAttemptNotice(null);

    const baseData = buildPropertyDraftData(data);

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
        email_health: (data as any).email_health,
        phone: data.phone || '',
        company: data.company || '',
        status: 'active',
        shootsCount: 0,
        lastActivity: new Date().toISOString(),
        companyNotes: data.companyNotes || '',
        rep: (data as any).rep || data.created_by_name || undefined,
        service_group_ids: Array.isArray((data as any).service_group_ids)
          ? (data as any).service_group_ids.map((id: any) => String(id))
          : Array.isArray((data as any).serviceGroupIds)
            ? (data as any).serviceGroupIds.map((id: any) => String(id))
            : [],
        service_groups: Array.isArray((data as any).service_groups)
          ? (data as any).service_groups.map((group: any) => ({
              id: String(group.id),
              name: group.name,
              description: group.description ?? '',
            }))
          : [],
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

  const handleRemoveService = (serviceId: string) => {
    const updated = selectedServices.filter(service => service.id !== serviceId);
    onSelectedServicesChange(updated);
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
                  const selectedClientEmailAlert = getClientEmailHealthAlert(selectedClient?.email_health);
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
                                  <div className="flex items-center gap-2 shrink-0">
                                    <EmailHealthBadge emailHealth={client.email_health} />
                                    {field.value === client.id && (
                                      <Check className="h-4 w-4 text-primary" />
                                    )}
                                  </div>
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
                                    className={cn(
                                      'w-full justify-between h-12 text-sm font-normal',
                                      showMissingFieldStroke('clientId') && invalidFieldClassName,
                                    )}
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
                                      <EmailHealthBadge emailHealth={selectedClient?.email_health} />
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
                                      className={cn(
                                        'w-full justify-between h-12 text-sm font-normal',
                                        showMissingFieldStroke('clientId') && invalidFieldClassName,
                                      )}
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
                                        <EmailHealthBadge emailHealth={selectedClient?.email_health} />
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
                        {selectedClientEmailAlert && selectedClient && (
                          <div
                            className={cn(
                              'rounded-xl border px-4 py-3 text-sm font-medium shadow-sm',
                              selectedClientEmailAlert.containerClassName,
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <AlertCircle className={cn('h-4 w-4 shrink-0', selectedClientEmailAlert.iconClassName)} />
                              <span>{selectedClientEmailAlert.message}</span>
                            </div>
                          </div>
                        )}
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
              name="propertyAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-foreground">Search Address</FormLabel>
                  <FormControl>
                    <AddressLookupField
                      value={field.value}
                      onChange={field.onChange}
                      onSelectionReset={() => {
                        clearAddressDerivedState();
                      }}
                      onSelectionStarted={() => {
                        clearAddressDerivedState({ keepSearchField: false });
                      }}
                      onAddressSelect={(address) => {
                        const city = address.city || '';
                        const normalizedState = normalizeState(address.state) || address.state || '';
                        const zip = address.zip || '';

                        let streetAddress = address.address || address.formatted_address || '';
                        if (streetAddress && (city || normalizedState || zip)) {
                          const escRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                          if (city) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*\\b${escRx(city)}\\b\\s*,?`, 'gi'), '');
                          if (normalizedState) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*\\b${escRx(normalizedState)}\\b\\s*,?`, 'gi'), '');
                          if (address.state && address.state !== normalizedState) {
                            streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*\\b${escRx(address.state)}\\b\\s*,?`, 'gi'), '');
                          }
                          if (zip) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*\\b${escRx(zip)}\\b\\s*`, 'gi'), '');
                          streetAddress = streetAddress.replace(/^[,\s]+|[,\s]+$/g, '').trim();
                        }

                        const { streetAddress: normalizedStreet, aptSuite } = extractAptSuite(streetAddress);
                        const resolvedAptSuite = (address.apt_suite || aptSuite || '').trim();

                        form.setValue('propertyAddress', normalizedStreet, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        form.setValue('aptSuite', resolvedAptSuite, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        form.setValue('propertyCity', city, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        form.setValue('propertyState', normalizedState, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        form.setValue('propertyZip', zip, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        form.setValue('bedRooms' as any, address.bedrooms ?? undefined, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
                        form.setValue('bathRooms' as any, address.bathrooms ?? undefined, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
                        form.setValue('sqft' as any, address.sqft ?? undefined, { shouldDirty: true, shouldTouch: true, shouldValidate: false });

                        const lookupPropertyDetails = buildLookupPropertyDetails(address);
                        setCompleteAddress(normalizedStreet);
                        setPropertyDetailsData(lookupPropertyDetails);

                        onAddressFieldsChange?.({
                          address: normalizedStreet,
                          city,
                          state: normalizedState,
                          zip,
                        });
                        onPropertyDraftChange?.(
                          buildPropertyDraftData(
                            {
                              ...form.getValues(),
                              propertyAddress: normalizedStreet,
                              aptSuite: resolvedAptSuite,
                              propertyCity: city,
                              propertyState: normalizedState,
                              propertyZip: zip,
                              bedRooms: address.bedrooms ?? undefined,
                              bathRooms: address.bathrooms ?? undefined,
                              sqft: address.sqft ?? undefined,
                            } as any,
                            {
                              completeAddress: normalizedStreet,
                              propertyDetailsData: lookupPropertyDetails,
                            },
                          ),
                        );
                      }}
                      placeholder="Start typing the property address..."
                      className={cn(
                        showMissingFieldStroke('propertyAddress') &&
                          '[&_input]:border-red-500/60 [&_input]:ring-1 [&_input]:ring-red-500/20 dark:[&_input]:border-red-400/60 dark:[&_input]:ring-red-400/20',
                      )}
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-muted-foreground">
                    Start typing to see address suggestions. Selecting an address will auto-fill city, state, ZIP code, and available property data.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4">
              {/* Editable Street Address Field - always visible */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="completeAddress" className="text-sm font-semibold text-foreground">Street Address</Label>
                  <Input
                    id="completeAddress"
                    value={completeAddress}
                    onChange={(e) => {
                      const nextCompleteAddress = e.target.value;
                      setCompleteAddress(nextCompleteAddress);
                      onPropertyDraftChange?.(
                        buildPropertyDraftData(undefined, {
                          completeAddress: nextCompleteAddress,
                        }),
                      );
                    }}
                    placeholder="Street address"
                    className={cn('font-medium', showMissingFieldStroke('propertyAddress') && invalidFieldClassName)}
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
                        <Input
                          placeholder="City"
                          {...field}
                          className={cn(showMissingFieldStroke('propertyCity') && invalidFieldClassName)}
                        />
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
                                className={cn(
                                  'w-full h-10 justify-between font-normal',
                                  showMissingFieldStroke('propertyState') && invalidFieldClassName,
                                )}
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
                            <SelectTrigger
                              className={cn(showMissingFieldStroke('propertyState') && invalidFieldClassName)}
                            >
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
                        <Input
                          placeholder="ZIP Code"
                          {...field}
                          className={cn(showMissingFieldStroke('propertyZip') && invalidFieldClassName)}
                        />
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
                          className={cn(showMissingFieldStroke('sqft') && invalidFieldClassName)}
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

              <div className="space-y-4 pt-1">
                <Separator className="bg-border/70" />

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
                          className="grid grid-cols-2 gap-2 sm:gap-3"
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
                          className="grid grid-cols-2 gap-2 sm:gap-3"
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

          <div
            className={cn(
              'rounded-xl border border-muted/40 bg-card/40 p-4 space-y-3 min-h-[140px] transition-colors',
              showMissingFieldStroke('selectedPackage') && invalidFieldClassName,
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Selected services</p>
                <p className="text-base font-semibold">
                  {selectedServices.length ? `${selectedServices.length} item${selectedServices.length > 1 ? 's' : ''}` : 'None yet'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setServiceDialogOpen(true)}
              >
                {selectedServices.length ? 'Edit services' : 'Select services'}
              </Button>
              <ServiceSelectionDialog
                open={serviceDialogOpen}
                onOpenChange={setServiceDialogOpen}
                services={visiblePackages}
                selectedServices={selectedServices}
                onSelectedServicesChange={(services) => onSelectedServicesChange(services as PackageOption[])}
                servicesLoading={packagesLoading}
                effectiveSqft={effectiveSqft}
              />
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
                  onValueChange={(value) => {
                    const nextPresenceOption = value as PresenceOption;
                    setPresenceOption(nextPresenceOption);
                    onPropertyDraftChange?.(
                      buildPropertyDraftData(undefined, {
                        presenceOption: nextPresenceOption,
                      }),
                    );
                  }}
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
