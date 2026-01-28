import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Cuboid as Cube,
  Grid3x3,
  Home,
  Layers,
  Map as MapIcon,
  Palette,
  PenTool,
  PlusCircle,
  Search,
  Sparkles,
  Video,
  Info,
  Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
  DialogClose,
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

const getPackageCategoryId = (pkg?: PackageOption | null) =>
  pkg?.category?.id ? pkg.category.id.toString() : 'uncategorized';

const getPackageCategoryName = (pkg?: PackageOption | null) =>
  pkg?.category?.name ?? FALLBACK_CATEGORY_NAME;

const clientAccountPropertyFormSchema = z.object({
  propertyAddress: z.string().min(1, "Address is required"),
  propertyCity: z.string().min(1, "City is required"),
  propertyState: z.string()
    .min(1, "State is required")
    .max(2, "State must be a 2-letter abbreviation (e.g., CA, NY, DC)")
    .refine((val) => val.length === 2, "State must be exactly 2 characters"),
  propertyZip: z.string().min(1, "ZIP code is required"),
  bedRooms: z.number().min(0, "Bedrooms must be 0 or more").optional(),
  bathRooms: z.number().min(0, "Bathrooms must be 0 or more").optional(),
  sqft: z.number().min(0, "SQFT must be 0 or more").optional(),
  propertyType: z.enum(["residential", "commercial"]),
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
  propertyCity: z.string().min(1, "City is required"),
  propertyState: z.string()
    .min(1, "State is required")
    .max(2, "State must be a 2-letter abbreviation (e.g., CA, NY, DC)")
    .refine((val) => val.length === 2, "State must be exactly 2 characters"),
  propertyZip: z.string().min(1, "ZIP code is required"),
  bedRooms: z.number().min(0, "Bedrooms must be 0 or more").optional(),
  bathRooms: z.number().min(0, "Bathrooms must be 0 or more").optional(),
  sqft: z.number().min(0, "SQFT must be 0 or more").optional(),
  propertyType: z.enum(["residential", "commercial"]),
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
}: ClientPropertyFormProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);

  // AccountForm control state
  const [isAccountFormOpen, setIsAccountFormOpen] = useState<boolean>(false);
  const [accountInitialData, setAccountInitialData] = useState<User | undefined>(undefined);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [panelCategory, setPanelCategory] = useState<string>('all');
  const [presenceOption, setPresenceOption] = useState<PresenceOption>('self');
  const [propertyDetailsData, setPropertyDetailsData] = useState<any>(null);
  const [completeAddress, setCompleteAddress] = useState<string>('');
  const { toast } = useToast();

  const navigate = useNavigate();

  const formSchema = isClientAccount ? clientAccountPropertyFormSchema : adminPropertyFormSchema;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: React.useMemo(() => (
      isClientAccount ? {
        propertyAddress: initialData.propertyAddress || '',
        propertyCity: initialData.propertyCity || '',
        propertyState: initialData.propertyState || '',
        propertyZip: initialData.propertyZip || '',
        bedRooms: initialData.bedRooms || 0,
        bathRooms: initialData.bathRooms || 0,
        sqft: initialData.sqft || 0,
        propertyType: initialData.propertyType || 'residential',
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
        propertyCity: initialData.propertyCity || '',
        propertyState: initialData.propertyState || '',
        propertyZip: initialData.propertyZip || '',
        bedRooms: initialData.bedRooms || 0,
        bathRooms: initialData.bathRooms || 0,
        sqft: initialData.sqft || 0,
        propertyType: initialData.propertyType || 'residential',
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
    if (!panelCategory) return packages;
    return packages.filter(pkg => getPackageCategoryId(pkg) === panelCategory);
  }, [panelCategory, packages]);

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
      if (service.pricing_type === 'variable' && service.sqft_ranges?.length) {
        const pricingInfo = getServicePricingForSqft(service, effectiveSqft);
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
    if (!isSearching) return clients;
    return clients.filter(client =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.company && client.company.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [clients, searchQuery, isSearching]);

  const visibleClients = isSearching ? filteredClients : [];

  const selectedClientId = !isClientAccount ? (form.getValues() as AdminFormValues).clientId : '';
  const selectedClient = selectedClientId ? clients.find(client => client.id === selectedClientId) : null;

  const handleSubmit = (data: FormValues) => {
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
    // data: create payload from account form
    console.log("AccountForm submitted:", data);
    // close modal
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
    if (exists) {
      // Remove service
      const updated = selectedServices.filter(selected => selected.id !== service.id);
      onSelectedServicesChange(updated);
    } else {
      // Add service with sqft-adjusted price if applicable
      let adjustedService = { ...service };
      if (service.pricing_type === 'variable' && effectiveSqft && service.sqft_ranges?.length) {
        const pricingInfo = getServicePricingForSqft(service, effectiveSqft);
        adjustedService = { ...service, price: pricingInfo.price };
      }
      onSelectedServicesChange([...selectedServices, adjustedService]);
    }
  };

  const handleRemoveService = (serviceId: string) => {
    const updated = selectedServices.filter(service => service.id !== serviceId);
    onSelectedServicesChange(updated);
  };


  const getPackageHighlight = (pkg: { id: string; name: string }) => {
    if (pkg.name === 'Premium') return { icon: <Star className="h-4 w-4 text-amber-500" />, label: 'Most Popular' };
    if (pkg.name === 'Standard') return { icon: <Star className="h-4 w-4 text-blue-500" />, label: 'Best Value' };
    return null;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {!isClientAccount && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Client Information</h3>

            <div className="relative">
              <div className="flex mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search clients..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="ml-2"
                  onClick={navigateToNewClient}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  New Client
                </Button>
              </div>

              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 max-h-[200px] overflow-y-auto">
                      {visibleClients.length > 0 ? (
                        visibleClients.map((client) => (
                          <div
                            key={client.id}
                            className={`p-3 border rounded-md cursor-pointer transition-colors ${field.value === client.id
                              ? "bg-primary/10 border-primary"
                              : "bg-card hover:bg-accent/50"
                              }`}
                            onClick={() => form.setValue("clientId" as any, client.id)}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center ${field.value === client.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                                  }`}
                              >
                              </div>
                              <div>
                                <div className="font-medium leading-none">
                                  {client.name}
                                </div>
                                {client.company && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {client.company}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground mt-1.5">
                                  {client.email}
                                </div>
                                {(() => {
                                  const repValue = (client as any).rep;
                                  const repLabel =
                                    typeof repValue === 'string'
                                      ? repValue
                                      : repValue && typeof repValue === 'object'
                                        ? repValue.name ?? ''
                                        : '';
                                  return repLabel ? (
                                    <div className="text-xs text-primary mt-1 font-medium">
                                      Rep: {repLabel}
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : isSearching ? (
                        <div className="col-span-2 p-6 text-center text-muted-foreground">
                          No clients found for this search.
                        </div>
                      ) : null}
                    </div>

                    {/* {!isSearching && filteredClients.length > 2 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Showing 2 clients. Type in the search box to see more.
                      </p>
                    )} */}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator className="my-6" />
          </div>
        )}

        <div className="pt-2">
          {/* {!isClientAccount && <Separator className="my-6" />} */}
          <h3 className="text-lg font-medium mb-4">Property Details</h3>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="propertyType"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Property Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="residential" id="residential" />
                        <Label htmlFor="residential" className="flex items-center cursor-pointer">
                          <Home className="h-4 w-4 mr-2" />
                          Residential
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="commercial" id="commercial" />
                        <Label htmlFor="commercial" className="flex items-center cursor-pointer">
                          <Building2 className="h-4 w-4 mr-2" />
                          Commercial
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
                    <FormLabel>Search Address</FormLabel>
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
                          
                          form.setValue('propertyAddress', streetAddress, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                          
                          // Set only street address (not full address with city/state/zip)
                          setCompleteAddress(streetAddress);

                          onAddressFieldsChange?.({
                            address: streetAddress,
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
              <div className="space-y-2">
                <Label htmlFor="completeAddress">Street Address</Label>
                <Input
                  id="completeAddress"
                  value={completeAddress}
                  onChange={(e) => setCompleteAddress(e.target.value)}
                  placeholder="Street address"
                  className="font-medium"
                />
                <p className="text-xs text-muted-foreground">
                  You can manually edit this street address if needed. It is prefilled when you select an address.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="propertyCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
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
                      <FormLabel>State</FormLabel>
                      <FormControl>
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
                      <FormLabel>ZIP Code</FormLabel>
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
                      <FormLabel>Bedrooms</FormLabel>
                      <FormControl>
                        {/* <Input placeholder="Bedrooms" {...field} /> */}
                        <Input
                          type="number"
                          placeholder="Bedrooms"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
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
                      <FormLabel>Bathroom</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Bathroom"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)} />
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
                      <FormLabel>SQFT</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="sqft"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)} />
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
              <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    {selectedServices.length ? 'Edit services' : 'Select services'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-5xl w-[96vw] max-h-[90vh] p-0 overflow-hidden">
                  <DialogHeader className="px-4 sm:px-6 py-4 border-b border-border/80">
                    <DialogTitle>Select services</DialogTitle>
                    <DialogDescription>
                      Pick every service needed for this shoot. Categories appear on the left; services are listed on the right.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col sm:flex-row h-full sm:h-[70vh]">
                    <aside className="border-b sm:border-b-0 sm:border-r border-border/60 p-3 sm:p-4 space-y-2 sm:w-64 sm:overflow-y-auto sm:max-h-[70vh]">
                      <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-col sm:overflow-visible sm:pb-0">
                        {categoryOptions.map(category => {
                          const isActive = category.id === panelCategory;
                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => setPanelCategory(category.id)}
                              className={`rounded-full sm:rounded-lg border px-4 py-2 text-left transition-colors flex items-center gap-2 sm:gap-3 flex-shrink-0 ${
                                isActive
                                  ? 'border-primary/60 bg-primary/5 text-primary'
                                  : 'border-transparent hover:bg-muted/40 text-muted-foreground'
                              } ${category.id === 'all' ? 'min-w-[200px] sm:w-full' : 'min-w-[160px] sm:w-full'}`}
                            >
                              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                <category.icon className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{category.name}</p>
                                <p className="text-xs text-muted-foreground">{category.count} items</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </aside>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[60vh] sm:max-h-none">
                      {packagesLoading ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <Skeleton key={idx} className="h-28 rounded-2xl" />
                          ))}
                        </div>
                      ) : panelServices.length ? (
                        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                          {panelServices.map(service => {
                            const isSelected = isServiceSelected(service.id);
                            const supportsVariablePricing =
                              !!(
                                effectiveSqft &&
                                service.pricing_type === 'variable' &&
                                service.sqft_ranges &&
                                service.sqft_ranges.length
                              );
                            const pricingInfo = supportsVariablePricing
                              ? getServicePricingForSqft(service, effectiveSqft)
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
                                className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-primary/60 bg-primary/5 shadow-sm'
                                    : 'border-border/70 bg-background hover:border-primary/40'
                                }`}
                                onClick={() => toggleServiceSelection(service)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <p className="font-medium text-base">{service.name}</p>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {service.description}
                                    </p>
                                  </div>
                                  <Checkbox checked={isSelected} onCheckedChange={() => toggleServiceSelection(service)} />
                                </div>
                                <div className="mt-4 flex items-start justify-between gap-3 text-sm font-semibold">
                                  <div>
                                    <span>{displayPrice}</span>
                                    {sqftContext && (
                                      <p className="text-xs font-normal text-muted-foreground mt-1">
                                        {sqftContext}
                                      </p>
                                    )}
                                  </div>
                                  {service.category?.name && (
                                    <Badge variant="outline" className="uppercase text-[10px] tracking-wide">
                                      {service.category.name}
                                      {supportsVariablePricing && matchedRange && (
                                        <span className="ml-1 text-[8px] tracking-normal text-primary">
                                          SQFT
                                        </span>
                                      )}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                          No services exist in this category yet. Pick a different category to continue.
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="px-4 sm:px-6 py-4 border-t border-border/80 gap-2 sm:gap-0">
                    <DialogClose asChild>
                      <Button className="w-full sm:w-auto">Done</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
            <div className="space-y-3">
              <FormLabel>Who will be at the property?</FormLabel>
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
                      <FormLabel>On-site contact name</FormLabel>
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
                      <FormLabel>On-site contact phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {presenceOption === 'lockbox' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lockboxCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lockbox code</FormLabel>
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
                      <FormLabel>Lockbox location / instructions</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., on the front gate" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        </div>

        <div className="pt-2">
          <Separator className="my-6" />
          <div className="flex items-center gap-2 mb-4"></div>
          <FormField
            control={form.control}
            name="shootNotes"
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


          {/* Company Notes - Admin only (not for clients) */}
          {!isClientAccount && (
            <FormField
              control={form.control}
              name="companyNotes"
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
            />
          )}

          {/* Photographer Notes - Admin/Rep only (not for clients) */}
          {!isClientAccount && (
            <FormField
              control={form.control}
              name="photographerNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Photographer Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes for the photographer (visible to photographer and admins)."
                      className="resize-none"
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
                <FormItem>
                  <FormLabel>Editor Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes for the editor (visible to editor and admins)."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit">Continue</Button>
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
