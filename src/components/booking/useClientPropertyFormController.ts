import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Client } from '@/types/clients';
import { initialClientsData } from '@/data/clientsData';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { buildNormalizedPropertyDetails, type AddressDetails } from '@/utils/addressLookup';
import { normalizeState } from '@/utils/stateUtils';
import type { AccountFormValues } from '@/components/accounts/AccountForm';
import type { User } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import API_ROUTES from '@/lib/api';
import type { ServiceWithPricing, SqftRange } from '@/utils/servicePricing';
import { getServicePricingForSqft } from '@/utils/servicePricing';
import type { EmailHealth } from '@/types/auth';
import type { ServiceSelectionOption } from '@/components/booking/ServiceSelectionDialog';

interface PackageCategory {
  id: string;
  name: string;
}

export interface PackageOption extends ServiceSelectionOption {
  id: string;
  name: string;
  description: string;
  price: number;
  category?: PackageCategory | null;
  pricing_type?: 'fixed' | 'variable';
  sqft_ranges?: ServiceWithPricing['sqft_ranges'];
  delivery_time?: ServiceWithPricing['delivery_time'];
  photographer_pay?: ServiceWithPricing['photographer_pay'];
  sqftRanges?: ServiceWithPricing['sqft_ranges'];
  service_group_ids?: Array<string | number>;
  service_groups?: Array<{ id: string | number; name?: string }>;
}

export type PresenceOption = 'self' | 'other' | 'lockbox';
export type InternalShootType =
  | 'standard'
  | 'complimentary'
  | 'sample_upload'
  | 'internal_test'
  | 'pricing_pending';

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

const getServiceSqftRanges = (service?: PackageOption): SqftRange[] =>
  service?.sqft_ranges || service?.sqftRanges || [];

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
  const ids = pkg?.service_group_ids;
  if (Array.isArray(ids) && ids.length > 0) {
    return ids.map((id) => String(id));
  }
  const groups = pkg?.service_groups;
  if (Array.isArray(groups) && groups.length > 0) {
    return groups.map((group) => String(group.id));
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
  selectedPackage: z.string().optional(),
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
  selectedPackage: z.string().optional(),
  // Property access fields
  lockboxCode: z.string().optional(),
  lockboxLocation: z.string().optional(),
  accessContactName: z.string().optional(),
  accessContactPhone: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientAccountPropertyFormSchema>;
type AdminFormValues = z.infer<typeof adminPropertyFormSchema>;
export type FormValues = ClientFormValues & { clientId?: string };

export type PropertyDetailsDraft = Record<string, unknown> & {
  presenceOption?: PresenceOption;
  sqft?: string | number | null;
  squareFeet?: string | number | null;
  livingArea?: string | number | null;
  living_area?: string | number | null;
};

export type ClientPropertyDraft = Partial<FormValues> & {
  completeAddress?: string;
  property_details?: PropertyDetailsDraft;
  [key: string]: unknown;
};

const invalidFieldClassName =
  'border-red-500/60 ring-1 ring-red-500/20 focus-visible:ring-red-500/30 dark:border-red-400/60 dark:ring-red-400/20 dark:focus-visible:ring-red-400/30';

export type ClientPropertyFormProps = {
  onComplete: (data: ClientPropertyDraft) => void;
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
    propertyDetails?: PropertyDetailsDraft | null;
    property_details?: PropertyDetailsDraft | null;
  };
  isClientAccount?: boolean;
  packages: PackageOption[];
  clients: Client[];
  /** ✅ Add this line **/
  onAddressFieldsChange?: (fields: { address: string; city: string; state: string; zip: string }) => void;
  onClientChange?: (clientId: string) => void;
  onPropertyDraftChange?: (data: ClientPropertyDraft) => void;
  selectedServices: PackageOption[];
  onSelectedServicesChange: (services: PackageOption[]) => void;
  shootType?: InternalShootType;
  onShootTypeChange?: (type: InternalShootType) => void;
  canCreateNoProductShoot?: boolean;
  packagesLoading?: boolean;
  showClearSavedData?: boolean;
  onClearSavedData?: () => void;
};


export const useClientPropertyFormController = ({
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
  shootType = 'standard',
  onShootTypeChange,
  canCreateNoProductShoot = false,
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
  const [propertyDetailsData, setPropertyDetailsData] = useState<PropertyDetailsDraft | null>(
    () => initialData.propertyDetails || initialData.property_details || null,
  );
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
        listingType: initialData.listingType || undefined,
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
        listingType: initialData.listingType || undefined,
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
    ), [initialData, isClientAccount]),
  });

  const showMissingFieldStroke = (name: keyof AdminFormValues) =>
    form.formState.submitCount > 0 && Boolean(form.formState.errors[name]);

  const watchedClientId = form.watch('clientId');
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
        const address = values.propertyAddress || '';
        const city = values.propertyCity || '';
        const state = normalizeState(values.propertyState) || values.propertyState || '';
        const zip = values.propertyZip || '';
        onAddressFieldsChange({ address, city, state, zip });
      }
    });
    return () => subscription.unsubscribe?.();
  }, [form, onAddressFieldsChange]);

  React.useEffect(() => {
    if (!onClientChange || isClientAccount) return;
    const subscription = form.watch((values, info) => {
      if (!info?.name || info.name === 'clientId') {
        const clientId = values.clientId || '';
        onClientChange(clientId);
      }
    });
    return () => subscription.unsubscribe?.();
  }, [form, onClientChange, isClientAccount]);

  React.useEffect(() => {
    const firstServiceId = selectedServices[0]?.id || '';
    form.setValue('selectedPackage', firstServiceId, {
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

  const watchedSqft = form.watch('sqft');
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
        propertyDetailsData?: PropertyDetailsDraft | null;
        presenceOption?: PresenceOption;
      },
    ) => {
      const currentValues = {
        ...form.getValues(),
        ...(values || {}),
      } satisfies Partial<FormValues>;
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
      form.setValue('bedRooms', undefined, resetOptions);
      form.setValue('bathRooms', undefined, resetOptions);
      form.setValue('sqft', undefined, resetOptions);
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
      } satisfies Partial<FormValues>;
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

  const buildLookupPropertyDetails = React.useCallback((address: AddressDetails): PropertyDetailsDraft => {
    return buildNormalizedPropertyDetails(address) as PropertyDetailsDraft;
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
  }, [effectiveSqft, onSelectedServicesChange, selectedServices]);

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
    const nextCompanyNotes = matchingClient?.companyNotes || '';
    form.setValue('companyNotes', nextCompanyNotes, {
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

    const requiresService = isClientAccount || !canCreateNoProductShoot;
    if (requiresService && selectedServices.length === 0) {
      const noticeText = 'Please select at least one service before continuing.';
      setSubmitAttemptNotice(noticeText);
      form.setError('selectedPackage', { type: 'manual', message: noticeText });
      toast({
        title: 'Missing required fields',
        description: noticeText,
        variant: 'destructive',
      });
      return;
    }

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
        email_health: data.email_health,
        phone: data.phone || '',
        company: data.company || '',
        status: 'active',
        shootsCount: 0,
        lastActivity: new Date().toISOString(),
        companyNotes: data.companyNotes || '',
        rep: data.created_by_name || data.createdBy || undefined,
        service_group_ids: Array.isArray(data.service_group_ids)
          ? data.service_group_ids.map((id) => String(id))
          : Array.isArray(data.serviceGroupIds)
            ? data.serviceGroupIds.map((id) => String(id))
            : [],
        service_groups: Array.isArray(data.service_groups)
          ? data.service_groups.map((group) => ({
              id: String(group.id),
              name: group.name,
              description: group.description ?? '',
            }))
          : [],
      };
      
      // Add to local newly added clients list
      setNewlyAddedClients(prev => [newClient, ...prev]);
      
      // Select the new client in the form
      form.setValue('clientId', newClient.id);
      
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

  return {
    form,
    isClientAccount,
    allClients,
    selectedClient,
    isSearching,
    visibleClients,
    searchQuery,
    setSearchQuery,
    clientSelectOpen,
    handleClientSelectOpenChange,
    isMobile,
    navigateToNewClient,
    isAddingClient,
    setIsAddingClient,
    accountInitialData,
    setAccountInitialData,
    isAccountFormOpen,
    setIsAccountFormOpen,
    handleAccountFormSubmit,
    showMissingFieldStroke,
    getClientEmailHealthAlert,
    invalidFieldClassName,
    stateDrawerOpen,
    setStateDrawerOpen,
    completeAddress,
    setCompleteAddress,
    propertyDetailsData,
    setPropertyDetailsData,
    clearAddressDerivedState,
    buildLookupPropertyDetails,
    extractAptSuite,
    onAddressFieldsChange,
    visiblePackages,
    selectedServices,
    onSelectedServicesChange,
    packagesLoading,
    serviceDialogOpen,
    setServiceDialogOpen,
    effectiveSqft,
    handleRemoveService,
    presenceOption,
    setPresenceOption,
    onPropertyDraftChange,
    buildPropertyDraftData,
    submitAttemptNotice,
    showClearSavedData,
    onClearSavedData,
    handleSubmit,
    handleInvalidSubmit,
  };
};

export type ClientPropertyFormController = ReturnType<typeof useClientPropertyFormController>;
