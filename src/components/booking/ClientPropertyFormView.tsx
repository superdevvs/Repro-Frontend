import React from 'react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, ChevronsUpDown, Grid3x3, Home, Map as MapIcon, PlusCircle, AlertCircle, ArrowRight, Check, Info, Tag, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AddressLookupField from '@/components/AddressLookupField';
import { buildNormalizedPropertyDetails } from '@/utils/addressLookup';
import { normalizeState, STATE_OPTIONS } from '@/utils/stateUtils';
import { AccountForm } from '@/components/accounts/AccountForm';
import { EmailHealthBadge } from '@/components/accounts/EmailHealthBadge';
import { Badge } from '@/components/ui/badge';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import { cn } from '@/lib/utils';
import { ServiceSelectionDialog } from '@/components/booking/ServiceSelectionDialog';
import type { ClientPropertyFormController, PackageOption, PresenceOption } from './useClientPropertyFormController';

export const ClientPropertyFormView = ({ controller }: { controller: ClientPropertyFormController }) => {
  const {
    form, isClientAccount, allClients, selectedClient, isSearching, visibleClients,
    searchQuery, setSearchQuery, clientSelectOpen, handleClientSelectOpenChange,
    isMobile, navigateToNewClient, isAddingClient, accountInitialData, setAccountInitialData,
    isAccountFormOpen, setIsAccountFormOpen, handleAccountFormSubmit, showMissingFieldStroke,
    getClientEmailHealthAlert, invalidFieldClassName, stateDrawerOpen, setStateDrawerOpen,
    completeAddress, setCompleteAddress, propertyDetailsData, setPropertyDetailsData,
    clearAddressDerivedState, buildLookupPropertyDetails, extractAptSuite,
    onAddressFieldsChange, visiblePackages, selectedServices,
    onSelectedServicesChange, packagesLoading, serviceDialogOpen, setServiceDialogOpen,
    effectiveSqft, handleRemoveService, presenceOption, setPresenceOption,
    onPropertyDraftChange, buildPropertyDraftData, submitAttemptNotice,
    showClearSavedData, onClearSavedData, handleSubmit, handleInvalidSubmit,
  } = controller;
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
                                  const repValue: unknown = client.rep;
                                  const repLabel =
                                    typeof repValue === 'string'
                                      ? repValue
                                      : repValue && typeof repValue === 'object'
                                        ? String((repValue as { name?: unknown }).name ?? '')
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
                        // Prefer the provider's structured street value (`address.address`),
                        // which is already free of city/state/zip (e.g. "3300 Lake Austin
                        // Boulevard"). Use it verbatim — never strip from it — so a city
                        // token that legitimately appears inside the street name (e.g. the
                        // "Austin" in "Lake Austin Blvd" when the city is also "Austin") is
                        // not deleted, which previously produced "LakeBoulevard".
                        const hasStructuredStreet = Boolean((address.address || '').trim());
                        let streetAddress = address.address || address.formatted_address || '';
                        if (!hasStructuredStreet && streetAddress && (city || normalizedState || zip)) {
                          // Only the formatted line (which contains ", City, ST ZIP, USA")
                          // needs trimming. Strip city/state/zip ANCHORED AT THE END so
                          // tokens inside the street name are never removed.
                          const escRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                          const stripTrailing = (token: string) => {
                            if (!token) return;
                            streetAddress = streetAddress
                              .replace(new RegExp(`\\s*,?\\s*\\b${escRx(token)}\\b\\s*,?\\s*$`, 'i'), '')
                              .trim();
                          };
                          // Drop a trailing country first, then zip, state, city.
                          streetAddress = streetAddress.replace(/\s*,?\s*USA\s*,?\s*$/i, '').trim();
                          if (zip) stripTrailing(zip);
                          if (normalizedState) stripTrailing(normalizedState);
                          if (address.state && address.state !== normalizedState) {
                            stripTrailing(address.state);
                          }
                          if (city) stripTrailing(city);
                          streetAddress = streetAddress.replace(/^[,\s]+|[,\s]+$/g, '').trim();
                        }
                        const { streetAddress: normalizedStreet, aptSuite } = extractAptSuite(streetAddress);
                        const resolvedAptSuite = (address.apt_suite || aptSuite || '').trim();
                        form.setValue('propertyAddress', normalizedStreet, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        form.setValue('aptSuite', resolvedAptSuite, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        form.setValue('propertyCity', city, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        form.setValue('propertyState', normalizedState, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        form.setValue('propertyZip', zip, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        form.setValue('bedRooms', address.bedrooms ?? undefined, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
                        form.setValue('bathRooms', address.bathrooms ?? undefined, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
                        form.setValue('sqft', address.sqft ?? undefined, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
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
                            },
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
                  name="listingType"
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
              className="w-full sm:hidden"
            >
              Clear saved data
            </Button>
          )}
          <Button
            type="submit"
            className="w-full sm:h-14 sm:w-auto sm:min-w-[200px] sm:bg-blue-600 sm:text-xl sm:font-bold sm:text-white sm:hover:bg-blue-700"
          >
            Continue
            <ArrowRight className="ml-2 hidden h-5 w-5 sm:inline" />
          </Button>
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
