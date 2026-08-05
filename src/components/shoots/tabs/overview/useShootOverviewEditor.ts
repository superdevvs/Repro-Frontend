import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShootMutationRefresh } from '@/hooks/useShootMutationRefresh';
import type { ShootData } from '@/types/shoots';
import { API_BASE_URL } from '@/config/env';
import { getServicePricingForSqft } from '@/utils/servicePricing';
import {
  getShootPhotographerAssignmentGroups,
  normalizeShootServiceCategoryKey,
} from '@/utils/shootPhotographerAssignments';
import { setNestedDraftValue } from './draftUtils';
import {
  buildScheduledAtIso,
  deriveMetricsFromAddress,
  deriveServiceCategoryId,
  deriveServiceCategoryName,
  extractLookupPropertyDetails,
  buildServiceScheduleFields,
  formatDateForInput,
  formatEditableValue,
  formatTimeForInput,
  mapPhotographerPickerOption,
  toNumberOrUndefined,
  useOverviewLookupData,
  usePhotographerAssignmentOptions,
  usePhotographerDistanceAvailability,
} from './shootOverviewEditorSupport';
import { to12Hour } from '@/utils/availabilityUtils';
import type {
  AddressDetailsForLookup,
  ClientOption,
  PhotographerPickerContext,
  PhotographerPickerOption,
  PresenceOption,
  ServiceCategoryOption,
  ServiceOption,
  ServiceScheduleFields,
  UseShootOverviewEditorArgs,
} from './shootOverviewEditorSupport';

export function useShootOverviewEditor({
  shoot,
  isAdmin,
  role,
  isEditMode = false,
  onShootUpdate,
  onSave,
  onCancel,
  onRegisterEditActions,
  toast,
}: UseShootOverviewEditorArgs) {
  const refreshShootMutations = useShootMutationRefresh();

  const [editedShoot, setEditedShoot] = useState<Partial<ShootData>>({});
  const [taxAmountDirty, setTaxAmountDirty] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>(() => {
    if (!shoot.client) return [];
    return [{
      id: String(shoot.client.id),
      name: shoot.client.name || '',
      email: shoot.client.email || '',
      company: shoot.client.company || '',
    }];
  });
  const [selectedClientId, setSelectedClientId] = useState(() => (shoot.client ? String(shoot.client.id) : ''));
  const [editPhotographers, setEditPhotographers] = useState<PhotographerPickerOption[]>([]);
  const [selectedPhotographerIdEdit, setSelectedPhotographerIdEdit] = useState(() => (shoot.photographer ? String(shoot.photographer.id) : ''));
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [photographerSearchOpen, setPhotographerSearchOpen] = useState(false);
  const [perCategoryPhotographers, setPerCategoryPhotographers] = useState<Record<string, string>>({});
  const [perCategoryPopoverOpen, setPerCategoryPopoverOpen] = useState<Record<string, boolean>>({});
  const [servicesList, setServicesList] = useState<ServiceOption[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [servicePrices, setServicePrices] = useState<Record<string, string>>({});
  const [servicePhotographerPays, setServicePhotographerPays] = useState<Record<string, string>>({});
  const [serviceSchedules, setServiceSchedules] = useState<Record<string, ServiceScheduleFields>>({});
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [servicePanelCategory, setServicePanelCategory] = useState('all');
  const [serviceModalSearch, setServiceModalSearch] = useState('');
  const [presenceOption, setPresenceOption] = useState<PresenceOption>('self');
  const [lockboxCode, setLockboxCode] = useState('');
  const [lockboxLocation, setLockboxLocation] = useState('');
  const [accessContactName, setAccessContactName] = useState('');
  const [accessContactPhone, setAccessContactPhone] = useState('');
  const [propertyMetricsEdit, setPropertyMetricsEdit] = useState({ beds: '', baths: '', sqft: '' });
  const [addressInput, setAddressInput] = useState('');
  const [assignPhotographerOpen, setAssignPhotographerOpen] = useState(false);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState('');
  const [photographerPickerContext, setPhotographerPickerContext] = useState<PhotographerPickerContext>(null);
  const [photographers, setPhotographers] = useState<PhotographerPickerOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'availability'>('distance');
  const [showAllPhotographers, setShowAllPhotographers] = useState(false);
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);

  const safeEditPhotographers = useMemo(
    () => (Array.isArray(editPhotographers) ? editPhotographers : []),
    [editPhotographers],
  );

  const photographerAssignments = useMemo(() => getShootPhotographerAssignmentGroups(shoot), [shoot]);
  const isAdminOrRep = isAdmin || role === 'rep' || role === 'representative';

  const resolveServicePrice = useCallback((service: ServiceOption, sqft: number | null, overrideValue?: string) => {
    const serviceWithPrice = { ...service, price: service.price ?? 0 };
    const pricingInfo = sqft && service.pricing_type === 'variable' && service.sqft_ranges?.length
      ? getServicePricingForSqft(serviceWithPrice, sqft)
      : null;
    const rawBasePrice = Number(pricingInfo?.price ?? service.price ?? 0);
    const basePrice = Number.isFinite(rawBasePrice) ? rawBasePrice : 0;
    const parsedOverride = overrideValue !== undefined && overrideValue !== '' ? Number(overrideValue) : NaN;
    const hasOverride = Number.isFinite(parsedOverride)
      && ((basePrice === 0 && parsedOverride > 0) || (basePrice > 0 && Math.abs(parsedOverride - basePrice) > 0.01));

    return {
      price: hasOverride ? parsedOverride : basePrice,
      basePrice,
      hasOverride,
    };
  }, []);

  const initializeMetricsFromShoot = useCallback(() => {
    const propertyDetails = shoot.propertyDetails || (shoot as any).property_details || {};
    setPropertyMetricsEdit({
      beds: formatEditableValue(propertyDetails.beds ?? propertyDetails.bedrooms ?? propertyDetails.bed ?? (shoot as any).beds ?? (shoot as any).bedrooms ?? ''),
      baths: formatEditableValue(propertyDetails.baths ?? propertyDetails.bathrooms ?? propertyDetails.bath ?? (shoot as any).baths ?? (shoot as any).bathrooms ?? ''),
      sqft: formatEditableValue(
        propertyDetails.sqft ??
        propertyDetails.squareFeet ??
        propertyDetails.square_feet ??
        (shoot as any).sqft ??
        (shoot as any).squareFeet ??
        (shoot as any).square_feet ??
        (shoot as any).livingArea ??
        (shoot as any).living_area ??
        '',
      ),
    });
  }, [shoot]);

  const updateField = useCallback((field: string, value: unknown) => {
    setEditedShoot((current) => setNestedDraftValue(current as Record<string, any>, field, value));
  }, []);

  const clearAddressDerivedState = useCallback(({ keepAddressInput = true }: { keepAddressInput?: boolean } = {}) => {
    if (!keepAddressInput) {
      setAddressInput('');
      updateField('location.address', '');
      updateField('location.fullAddress', '');
    }
    updateField('location.city', '');
    updateField('location.state', '');
    updateField('location.zip', '');
    updateField('location.latitude', undefined);
    updateField('location.longitude', undefined);
    updateField('propertyDetails', {});
    setPropertyMetricsEdit({ beds: '', baths: '', sqft: '' });
  }, [updateField]);

  const handleAddressSelect = useCallback((details: AddressDetailsForLookup) => {
    const mergedAddress = details.address || details.formatted_address || '';
    setAddressInput(mergedAddress);
    updateField('location.address', mergedAddress);
    updateField('location.fullAddress', details.formatted_address || mergedAddress);
    updateField('location.city', details.city || '');
    updateField('location.state', details.state || '');
    updateField('location.zip', details.zip || '');
    updateField('location.latitude', details.latitude);
    updateField('location.longitude', details.longitude);
    updateField('propertyDetails', extractLookupPropertyDetails(details));

    const derivedMetrics = deriveMetricsFromAddress(details);
    setPropertyMetricsEdit({
      beds: formatEditableValue(derivedMetrics.bedrooms),
      baths: formatEditableValue(derivedMetrics.bathrooms),
      sqft: formatEditableValue(derivedMetrics.sqft),
    });
  }, [updateField]);

  const effectiveSqft = useMemo(() => {
    const rawSqft = isEditMode
      ? propertyMetricsEdit.sqft
      : (shoot as any).propertyDetails?.sqft ??
        (shoot as any).property_details?.sqft ??
        (shoot as any).sqft ??
        (shoot as any).squareFeet ??
        (shoot as any).square_feet ??
        (shoot as any).livingArea ??
        (shoot as any).living_area ??
        null;
    if (rawSqft === '' || rawSqft === null || rawSqft === undefined) return null;
    const parsedSqft = Number(rawSqft);
    return Number.isFinite(parsedSqft) ? parsedSqft : null;
  }, [isEditMode, propertyMetricsEdit.sqft, shoot]);

  useOverviewLookupData(
    isEditMode,
    shoot,
    effectiveSqft,
    resolveServicePrice,
    setClients,
    setServicesList,
    setSelectedServiceIds,
    setServicePrices,
    setServicePhotographerPays,
    setServiceSchedules,
    setEditPhotographers,
  );

  useEffect(() => {
    if (!isEditMode) return;

    const propertyDetails = shoot.propertyDetails || (shoot as any).property_details || {};
    setServiceSchedules({});
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
      client: shoot.client ? { ...shoot.client } : undefined,
      photographer: shoot.photographer ? { ...shoot.photographer } : undefined,
      payment: shoot.payment ? { ...shoot.payment } : undefined,
    });
    setAddressInput(shoot.location?.address || shoot.location?.fullAddress || (shoot as any).address || '');
    initializeMetricsFromShoot();
    if (shoot.client) setSelectedClientId(String(shoot.client.id));
    if (shoot.photographer) setSelectedPhotographerIdEdit(String(shoot.photographer.id));

    const nextPerCategoryPhotographers: Record<string, string> = {};
    for (const group of photographerAssignments.groups) {
      const photographerId = group.photographer?.id;
      if (photographerId != null && !nextPerCategoryPhotographers[group.key]) {
        nextPerCategoryPhotographers[group.key] = String(photographerId);
      }
    }
    setPerCategoryPhotographers(nextPerCategoryPhotographers);
    setServiceSchedules((current) => {
      // Do NOT fabricate the shoot/order date for services that have no
      // schedule of their own. Unscheduled services must stay EMPTY so the
      // pickers render "Select date"/"Select time" (UNASSIGNED). Any real
      // per-service schedule is hydrated by `fetchServices`.
      const nextSchedules: Record<string, ServiceScheduleFields> = {};
      selectedServiceIds.forEach((serviceId) => {
        nextSchedules[serviceId] = current[serviceId] || { date: '', time: '' };
      });
      return nextSchedules;
    });
    setTaxAmountDirty(false);
    setPresenceOption(propertyDetails.presenceOption === 'lockbox' || propertyDetails.presenceOption === 'other' ? propertyDetails.presenceOption : 'self');
    setLockboxCode(propertyDetails.lockboxCode || '');
    setLockboxLocation(propertyDetails.lockboxLocation || '');
    setAccessContactName(propertyDetails.accessContactName || '');
    setAccessContactPhone(propertyDetails.accessContactPhone || '');
  }, [initializeMetricsFromShoot, isEditMode, photographerAssignments.groups, shoot]);

  useEffect(() => {
    if (!isEditMode || selectedServiceIds.length > 0) return;

    const rawSourceItems: any[] = Array.isArray((shoot as any).serviceItems) && (shoot as any).serviceItems.length > 0
      ? (shoot as any).serviceItems
      : Array.isArray((shoot as any).service_items) && (shoot as any).service_items.length > 0
        ? (shoot as any).service_items
        : Array.isArray(shoot.serviceObjects) && shoot.serviceObjects.length > 0
          ? shoot.serviceObjects
          : [];
    const serviceObjectsById = new Map<string, any>();
    if (Array.isArray(shoot.serviceObjects)) {
      shoot.serviceObjects.forEach((serviceObject: any) => {
        const id = serviceObject?.service_id ?? serviceObject?.serviceId ?? serviceObject?.id;
        if (id !== null && id !== undefined) serviceObjectsById.set(String(id), serviceObject);
      });
    }
    const sourceItems = rawSourceItems.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const id = item.service_id ?? item.serviceId ?? item.id;
      const serviceObject = id !== null && id !== undefined ? serviceObjectsById.get(String(id)) : null;
      if (!serviceObject) return item;
      return {
        ...serviceObject,
        ...item,
        scheduled_at: item.scheduled_at ?? item.scheduledAt ?? serviceObject.scheduled_at ?? serviceObject.scheduledAt,
        scheduledAt: item.scheduledAt ?? item.scheduled_at ?? serviceObject.scheduledAt ?? serviceObject.scheduled_at,
      };
    });

    const ids: string[] = [];
    const fallbackServices: ServiceOption[] = [];
    const schedules: Record<string, ServiceScheduleFields> = {};

    sourceItems.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const rawServiceId = item.service_id ?? item.serviceId ?? item.id;
      if (rawServiceId === null || rawServiceId === undefined) return;
      const serviceId = String(rawServiceId);
      if (!serviceId || ids.includes(serviceId)) return;
      ids.push(serviceId);
      const scheduledAt = item.scheduled_at ?? item.scheduledAt;
      // Keep unscheduled services EMPTY instead of fabricating the order date.
      schedules[serviceId] = buildServiceScheduleFields(scheduledAt);
      const serviceName = item.name ?? item.service_name ?? item.serviceName;
      if (serviceName) {
        fallbackServices.push({
          id: serviceId,
          name: String(serviceName),
          price: Number(item.price ?? item.subtotal ?? 0) || 0,
          pricing_type: item.pricing_type || 'fixed',
          allow_multiple: item.allow_multiple ?? false,
          sqft_ranges: Array.isArray(item.sqft_ranges) ? item.sqft_ranges : [],
          category: item.category || null,
          description: item.description || '',
          photographer_pay: item.photographer_pay != null ? Number(item.photographer_pay) : null,
          duration: item.duration != null ? Number(item.duration) : null,
        });
      }
    });

    if (ids.length === 0) return;
    setSelectedServiceIds(ids);
    setServiceSchedules((current) => ({ ...current, ...schedules }));
    setServicesList((current) => {
      const merged = new Map(current.map((service) => [service.id, service]));
      fallbackServices.forEach((service) => {
        if (!merged.has(service.id)) merged.set(service.id, service);
      });
      return Array.from(merged.values());
    });
  }, [isEditMode, selectedServiceIds.length, shoot]);

  const handleSave = useCallback(() => {
    if (!onSave) return;

    const updates = { ...editedShoot } as Partial<ShootData> & Record<string, any>;
    const incomingPropertyDetails =
      updates.propertyDetails && typeof updates.propertyDetails === 'object'
        ? { ...(updates.propertyDetails as Record<string, any>) }
        : null;
    const basePropertyDetails = { ...(shoot.propertyDetails || (shoot as any).property_details || {}) } as Record<string, any>;

    if (incomingPropertyDetails) {
      [
        'beds', 'bedrooms', 'baths', 'bathrooms', 'sqft', 'squareFeet',
        'mls_id', 'mlsId', 'price', 'lot_size', 'lotSize', 'year_built',
        'yearBuilt', 'property_type', 'propertyType', 'zpid', 'source',
        'confidence', 'field_sources', 'property_source_chain',
      ].forEach((key) => {
        delete basePropertyDetails[key];
      });
      Object.assign(basePropertyDetails, incomingPropertyDetails);
    }

    const bedsValue = toNumberOrUndefined(propertyMetricsEdit.beds);
    const bathsValue = toNumberOrUndefined(propertyMetricsEdit.baths);
    const sqftValue = toNumberOrUndefined(propertyMetricsEdit.sqft);

    if (bedsValue !== undefined) {
      basePropertyDetails.beds = bedsValue;
      basePropertyDetails.bedrooms = bedsValue;
    } else if (incomingPropertyDetails) {
      delete basePropertyDetails.beds;
      delete basePropertyDetails.bedrooms;
    }
    if (bathsValue !== undefined) {
      basePropertyDetails.baths = bathsValue;
      basePropertyDetails.bathrooms = bathsValue;
    } else if (incomingPropertyDetails) {
      delete basePropertyDetails.baths;
      delete basePropertyDetails.bathrooms;
    }
    if (sqftValue !== undefined) {
      basePropertyDetails.sqft = sqftValue;
      basePropertyDetails.squareFeet = sqftValue;
    } else if (incomingPropertyDetails) {
      delete basePropertyDetails.sqft;
      delete basePropertyDetails.squareFeet;
    }

    updates.propertyDetails = {
      ...basePropertyDetails,
      presenceOption,
      lockboxCode: presenceOption === 'lockbox' ? lockboxCode || null : null,
      lockboxLocation: presenceOption === 'lockbox' ? lockboxLocation || null : null,
      accessContactName: presenceOption === 'other' ? accessContactName || null : null,
      accessContactPhone: presenceOption === 'other' ? accessContactPhone || null : null,
    };

    if (updates.client?.id !== undefined && updates.client.id !== null) {
      const clientId = typeof updates.client.id === 'string' ? parseInt(updates.client.id, 10) : Number(updates.client.id);
      if (!Number.isNaN(clientId) && clientId > 0) {
        updates.client = { ...updates.client, id: clientId };
      }
    }
    if (updates.photographer?.id !== undefined && updates.photographer.id !== null) {
      const photographerId = typeof updates.photographer.id === 'string' ? parseInt(updates.photographer.id, 10) : Number(updates.photographer.id);
      if (!Number.isNaN(photographerId) && photographerId > 0) {
        updates.photographer = { ...updates.photographer, id: photographerId };
      } else {
        delete updates.photographer;
      }
    }

    const sqftForPricing =
      sqftValue ??
      basePropertyDetails.sqft ??
      (basePropertyDetails as any).squareFeet ??
      (basePropertyDetails as any).square_feet ??
      (shoot as any).sqft ??
      (shoot as any).squareFeet ??
      (shoot as any).square_feet ??
      (shoot as any).livingArea ??
      (shoot as any).living_area ??
      null;

    const orderSchedule = {
      date: formatDateForInput((updates as any).scheduledDate ?? shoot.scheduledDate),
      time: formatTimeForInput(String((updates as any).time ?? shoot.time ?? '')) || '10:00',
    };
    const existingScheduleByServiceId = new Map<string, ServiceScheduleFields>();
    [
      ...(((shoot as any).serviceItems as any[]) || []),
      ...(((shoot as any).service_items as any[]) || []),
      ...((shoot.serviceObjects as any[]) || []),
    ].forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const serviceId = item.service_id ?? item.serviceId ?? item.id;
      if (serviceId === null || serviceId === undefined) return;
      const scheduledAt = item.scheduled_at ?? item.scheduledAt;
      if (!scheduledAt) return;
      existingScheduleByServiceId.set(String(serviceId), {
        date: formatDateForInput(scheduledAt),
        time: formatTimeForInput(scheduledAt) || orderSchedule.time,
      });
    });
    const serviceItemsPayload = selectedServiceIds.map((serviceId) => {
      const service = servicesList.find((serviceOption) => serviceOption.id === serviceId);
      const resolvedPrice = service ? resolveServicePrice(service, sqftForPricing, servicePrices[serviceId]).price : 0;
      const savedSchedule = serviceSchedules[serviceId] || orderSchedule;
      const existingSchedule = existingScheduleByServiceId.get(serviceId);
      const serviceSchedule =
        existingSchedule &&
        savedSchedule.date === orderSchedule.date &&
        savedSchedule.time === orderSchedule.time
          ? existingSchedule
          : savedSchedule;
      const serviceData: any = {
        service_id: Number(serviceId),
        price: resolvedPrice,
        quantity: 1,
        // Keep unscheduled services unscheduled: an empty date must NOT fall back
        // to the order date. `buildScheduledAtIso` returns null for an empty date.
        scheduled_at: serviceSchedule.date
          ? buildScheduledAtIso(serviceSchedule.date, serviceSchedule.time)
          : null,
      };
      if (servicePhotographerPays[serviceId]) {
        serviceData.photographer_pay = parseFloat(servicePhotographerPays[serviceId]);
      }
      return serviceData;
    });
    (updates as any).service_items = serviceItemsPayload;
    (updates as any).services = serviceItemsPayload.map((serviceData) => ({
      id: serviceData.service_id,
      price: serviceData.price,
      quantity: serviceData.quantity,
      scheduled_at: serviceData.scheduled_at,
      photographer_pay: serviceData.photographer_pay,
    }));

    const servicePhotographerAssignments: Array<{ service_id: number; photographer_id: number }> = [];
    if (Object.keys(perCategoryPhotographers).length > 0 && selectedServiceIds.length > 0) {
      for (const serviceId of selectedServiceIds) {
        const service = servicesList.find((serviceOption) => serviceOption.id === serviceId);
        if (!service) continue;
        const categoryName = deriveServiceCategoryName(service);
        const categoryKey = categoryName.trim().toLowerCase().replace(/s$/, '');
        const photographerId = perCategoryPhotographers[categoryKey];
        if (photographerId) {
          servicePhotographerAssignments.push({
            service_id: Number(serviceId),
            photographer_id: Number(photographerId),
          });
        }
      }
    }
    updates.service_photographers = servicePhotographerAssignments;

    onSave(updates);
  }, [
    accessContactName,
    accessContactPhone,
    editedShoot,
    lockboxCode,
    lockboxLocation,
    onSave,
    perCategoryPhotographers,
    presenceOption,
    propertyMetricsEdit.baths,
    propertyMetricsEdit.beds,
    propertyMetricsEdit.sqft,
    resolveServicePrice,
    selectedServiceIds,
    servicePhotographerPays,
    servicePrices,
    serviceSchedules,
    servicesList,
    shoot,
  ]);

  // An UNSET service schedule must stay empty (UNASSIGNED) rather than
  // inheriting the shoot/order date. The pickers render '' as
  // "Select date"/"Select time"; save converts a chosen date with no time
  // to a default time via buildScheduledAtIso.
  const defaultServiceSchedule = useMemo<ServiceScheduleFields>(
    () => ({ date: '', time: '' }),
    [],
  );

  useEffect(() => {
    if (!isEditMode) return;
    setServiceSchedules((current) => {
      let changed = false;
      const next: Record<string, ServiceScheduleFields> = {};
      selectedServiceIds.forEach((serviceId) => {
        next[serviceId] = current[serviceId] || defaultServiceSchedule;
        if (!current[serviceId]) changed = true;
      });
      Object.keys(current).forEach((serviceId) => {
        if (!selectedServiceIds.includes(serviceId)) changed = true;
      });
      return changed ? next : current;
    });
  }, [defaultServiceSchedule, isEditMode, selectedServiceIds]);

  const updateServiceSchedule = useCallback((serviceId: string, field: keyof ServiceScheduleFields, value: string) => {
    setServiceSchedules((current) => ({
      ...current,
      [serviceId]: {
        ...(current[serviceId] || defaultServiceSchedule),
        [field]: value,
      },
    }));
  }, [defaultServiceSchedule]);

  const handleCancel = useCallback(() => {
    setEditedShoot({});
    setClientSearchOpen(false);
    setPhotographerSearchOpen(false);
    setServiceModalSearch('');
    setSearchQuery('');
    if (onCancel) onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (!isEditMode || !onRegisterEditActions) return;
    onRegisterEditActions({
      save: handleSave,
      cancel: handleCancel,
    });
  }, [handleCancel, handleSave, isEditMode, onRegisterEditActions]);

  const serviceCategoryOptions = useMemo<ServiceCategoryOption[]>(() => {
    if (!servicesList.length) return [];
    const categories = new Map<string, ServiceCategoryOption>();
    servicesList.forEach((service) => {
      const id = deriveServiceCategoryId(service);
      const name = deriveServiceCategoryName(service);
      const existing = categories.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        categories.set(id, { id, name, count: 1 });
      }
    });
    return Array.from(categories.values());
  }, [servicesList]);

  const panelServices = useMemo(() => {
    if (!servicesList.length) return [];
    let filteredServices = servicesList;
    if (servicePanelCategory) {
      filteredServices = filteredServices.filter((service) => deriveServiceCategoryId(service) === servicePanelCategory);
    }
    if (serviceModalSearch) {
      const query = serviceModalSearch.toLowerCase();
      filteredServices = filteredServices.filter((service) => service.name.toLowerCase().includes(query));
    }
    return filteredServices;
  }, [serviceModalSearch, servicePanelCategory, servicesList]);

  useEffect(() => {
    if (!serviceCategoryOptions.length) return;
    const hasSelectedCategory = serviceCategoryOptions.some((category) => category.id === servicePanelCategory);
    if (!hasSelectedCategory) {
      setServicePanelCategory(serviceCategoryOptions[0].id);
    }
  }, [serviceCategoryOptions, servicePanelCategory]);

  const toggleServiceSelection = useCallback((serviceId: string) => {
    setSelectedServiceIds((current) => {
      if (current.includes(serviceId)) {
        setServicePrices((prices) => {
          const nextPrices = { ...prices };
          delete nextPrices[serviceId];
          return nextPrices;
        });
        setServicePhotographerPays((pays) => {
          const nextPays = { ...pays };
          delete nextPays[serviceId];
          return nextPays;
        });
        return current.filter((id) => id !== serviceId);
      }
      return [...current, serviceId];
    });
  }, []);

  useEffect(() => {
    const total = selectedServiceIds.reduce((sum, serviceId) => {
      const service = servicesList.find((serviceOption) => serviceOption.id === serviceId);
      if (!service) return sum;
      const resolvedPrice = resolveServicePrice(service, effectiveSqft, servicePrices[serviceId]).price;
      return sum + (Number.isNaN(resolvedPrice) ? 0 : resolvedPrice);
    }, 0);
    const rawTaxRate = Number(editedShoot.payment?.taxRate ?? shoot.payment?.taxRate ?? 0);
    const normalizedTaxRate = rawTaxRate > 1 ? rawTaxRate / 100 : rawTaxRate;
    const autoTax = Number((total * normalizedTaxRate).toFixed(2));
    const manualTax = Number(editedShoot.payment?.taxAmount ?? shoot.payment?.taxAmount ?? 0);
    const resolvedManualTax = Number.isFinite(manualTax) ? manualTax : 0;
    const finalTax = taxAmountDirty ? resolvedManualTax : autoTax;
    updateField('payment.baseQuote', total);
    updateField('payment.taxAmount', finalTax);
    updateField('payment.totalQuote', total + finalTax);
  }, [
    editedShoot.payment?.taxAmount,
    editedShoot.payment?.taxRate,
    effectiveSqft,
    resolveServicePrice,
    selectedServiceIds,
    servicePrices,
    servicesList,
    shoot.payment?.taxAmount,
    shoot.payment?.taxRate,
    taxAmountDirty,
    updateField,
  ]);

  const getShootLocation = useCallback(() => {
    const editedLocation = isEditMode ? editedShoot.location : undefined;
    const address =
      (typeof editedLocation?.address === 'string' ? editedLocation.address : undefined)
      || shoot.location?.address
      || (shoot as any).address
      || '';
    const city =
      (typeof editedLocation?.city === 'string' ? editedLocation.city : undefined)
      || shoot.location?.city
      || (shoot as any).city
      || '';
    const state =
      (typeof editedLocation?.state === 'string' ? editedLocation.state : undefined)
      || shoot.location?.state
      || (shoot as any).state
      || '';
    const zip =
      (typeof editedLocation?.zip === 'string' ? editedLocation.zip : undefined)
      || shoot.location?.zip
      || (shoot as any).zip
      || '';
    return { address, city, state, zip };
  }, [editedShoot.location, isEditMode, shoot]);

  usePhotographerAssignmentOptions(
    assignPhotographerOpen,
    safeEditPhotographers,
    isAdminOrRep,
    isEditMode,
    setPhotographers,
    setEditPhotographers,
  );

  const photographerPickerScheduleDate = formatDateForInput(
    String(editedShoot.scheduledDate ?? (shoot as any).scheduled_at ?? (shoot as any).scheduledAt ?? shoot.scheduledDate ?? ''),
  );
  const photographerPickerScheduleTime =
    formatTimeForInput(String(editedShoot.time ?? (shoot as any).scheduled_at ?? (shoot as any).scheduledAt ?? shoot.time ?? ''))
    || '10:00';

  usePhotographerDistanceAvailability(
    assignPhotographerOpen,
    photographers,
    isAdminOrRep,
    getShootLocation,
    photographerPickerScheduleDate,
    photographerPickerScheduleTime,
    setPhotographers,
    setIsCalculatingDistances,
    setIsLoadingAvailability,
  );

  const fallbackAssignedPhotographers = useMemo(() => {
    const photographersMap = new Map<string, PhotographerPickerOption>();
    const addPhotographer = (photographer?: any | null) => {
      if (!photographer?.id) return;
      const mappedPhotographer = mapPhotographerPickerOption(photographer);
      photographersMap.set(String(mappedPhotographer.id), mappedPhotographer);
    };

    addPhotographer(shoot.photographer);
    photographerAssignments.groups.forEach((group) => addPhotographer(group.photographer));

    return Array.from(photographersMap.values());
  }, [photographerAssignments.groups, shoot.photographer]);

  const photographerPickerOptions = useMemo(() => {
    if (photographers.length > 0) return photographers;
    if (safeEditPhotographers.length > 0) {
      return safeEditPhotographers.map((photographer) => ({ ...photographer }));
    }
    return fallbackAssignedPhotographers;
  }, [fallbackAssignedPhotographers, photographers, safeEditPhotographers]);

  const filteredAndSortedPhotographers = useMemo(() => {
    let filteredPhotographers = [...photographerPickerOptions];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredPhotographers = filteredPhotographers.filter((photographer) =>
        photographer.name.toLowerCase().includes(query)
        || photographer.email?.toLowerCase().includes(query)
        || photographer.city?.toLowerCase().includes(query)
        || photographer.state?.toLowerCase().includes(query),
      );
    }

    const hasAvailablePhotographers = filteredPhotographers.some((photographer) =>
      Boolean(photographer.hasAvailability || photographer.netAvailableSlots?.length),
    );
    if (!showAllPhotographers && hasAvailablePhotographers) {
      filteredPhotographers = filteredPhotographers.filter((photographer) =>
        Boolean(photographer.hasAvailability || photographer.netAvailableSlots?.length),
      );
    }

    filteredPhotographers.sort((first, second) => {
      const firstAvailable = Boolean(first.hasAvailability || first.netAvailableSlots?.length);
      const secondAvailable = Boolean(second.hasAvailability || second.netAvailableSlots?.length);
      if (sortBy === 'availability') {
        if (firstAvailable !== secondAvailable) return firstAvailable ? -1 : 1;
        const firstSlots = first.netAvailableSlots?.length || 0;
        const secondSlots = second.netAvailableSlots?.length || 0;
        if (firstSlots !== secondSlots) return secondSlots - firstSlots;
      }
      if (sortBy === 'distance') {
        if (first.distance === undefined && second.distance === undefined) return 0;
        if (first.distance === undefined) return 1;
        if (second.distance === undefined) return -1;
        return first.distance - second.distance;
      }
      return first.name.localeCompare(second.name);
    });

    return filteredPhotographers;
  }, [photographerPickerOptions, searchQuery, showAllPhotographers, sortBy]);

  const resolvePhotographerDetails = useCallback((photographerId?: string | null) => {
    if (!photographerId) return null;
    const normalizedId = String(photographerId);
    return (
      photographerPickerOptions.find((photographer) => String(photographer.id) === normalizedId)
      || safeEditPhotographers.find((photographer) => String(photographer.id) === normalizedId)
      || (shoot.photographer && String(shoot.photographer.id) === normalizedId ? shoot.photographer : null)
    );
  }, [photographerPickerOptions, safeEditPhotographers, shoot.photographer]);

  const closePhotographerPicker = useCallback(() => {
    setAssignPhotographerOpen(false);
    setSearchQuery('');
    setSelectedPhotographerId('');
    setPhotographerPickerContext(null);
  }, []);

  const openEditPhotographerPicker = useCallback((context: Exclude<PhotographerPickerContext, null>) => {
    const initialSelection = context.categoryKey
      ? perCategoryPhotographers[context.categoryKey] || selectedPhotographerIdEdit || ''
      : selectedPhotographerIdEdit || '';
    setPhotographerPickerContext(context);
    setSelectedPhotographerId(initialSelection);
    setSearchQuery('');
    setAssignPhotographerOpen(true);
  }, [perCategoryPhotographers, selectedPhotographerIdEdit]);

  const editModePhotographerRows = useMemo(() => {
    const groupedRows = photographerAssignments.groups.map((group) => {
      const selectedId = perCategoryPhotographers[group.key] || group.photographer?.id || selectedPhotographerIdEdit || '';
        return {
          key: group.key,
          name: group.name,
          photographer: resolvePhotographerDetails(String(selectedId)) || group.photographer || null,
        };
      });

    const fallbackRows = groupedRows.length > 0
      ? groupedRows
        : [{
            key: 'photographer',
            name: 'Photographer',
            photographer: resolvePhotographerDetails(String(selectedPhotographerIdEdit || shoot.photographer?.id || '')) || shoot.photographer || null,
          }];

    if (!isEditMode || selectedServiceIds.length === 0 || servicesList.length === 0) return fallbackRows;

    const rows = new Map<string, { key: string; name: string; photographer: ReturnType<typeof resolvePhotographerDetails> }>();
    selectedServiceIds.forEach((serviceId) => {
      const service = servicesList.find((serviceOption) => serviceOption.id === serviceId);
      if (!service) return;
      const categoryName = deriveServiceCategoryName(service);
      const categoryKey = normalizeShootServiceCategoryKey(categoryName);
      const existingGroup = photographerAssignments.groups.find((group) => group.key === categoryKey);
      const selectedId = perCategoryPhotographers[categoryKey] || existingGroup?.photographer?.id || selectedPhotographerIdEdit || '';
      rows.set(categoryKey, {
        key: categoryKey,
        name: categoryName,
        photographer: resolvePhotographerDetails(String(selectedId)) || existingGroup?.photographer || null,
      });
    });

    return rows.size > 0 ? Array.from(rows.values()) : fallbackRows;
  }, [
    isEditMode,
    perCategoryPhotographers,
    photographerAssignments.groups,
    resolvePhotographerDetails,
    selectedPhotographerIdEdit,
    selectedServiceIds,
    servicesList,
    shoot.photographer,
  ]);

  const handleAssignPhotographer = useCallback(async () => {
    if (!selectedPhotographerId) return;
    const selectedPhotographer = resolvePhotographerDetails(selectedPhotographerId);

    if (isEditMode) {
      const nextPhotographer = {
        id: selectedPhotographerId,
        name: selectedPhotographer?.name || 'Selected photographer',
        email: selectedPhotographer?.email || '',
      };

      if (photographerPickerContext?.categoryKey) {
        const { categoryKey, categoryName } = photographerPickerContext;
        setPerCategoryPhotographers((current) => ({ ...current, [categoryKey]: selectedPhotographerId }));
        updateField(`perCategoryPhotographers.${categoryKey}`, selectedPhotographerId);

        if (editModePhotographerRows.length === 1) {
          setSelectedPhotographerIdEdit(selectedPhotographerId);
          updateField('photographer', nextPhotographer);
        }

        toast({
          title: 'Photographer updated',
          description: categoryName
            ? `${nextPhotographer.name} is selected for ${categoryName}.`
            : 'Photographer selection updated.',
        });
      } else {
        setSelectedPhotographerIdEdit(selectedPhotographerId);
        updateField('photographer', nextPhotographer);
        toast({
          title: 'Photographer updated',
          description: `${nextPhotographer.name} is selected for this shoot.`,
        });
      }

      closePhotographerPicker();
      return;
    }

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ photographer_id: selectedPhotographerId }),
      });
      if (!response.ok) throw new Error('Failed to assign photographer');

      toast({
        title: 'Success',
        description: 'Photographer assigned successfully',
      });
      closePhotographerPicker();
      refreshShootMutations(shoot.id);
      onShootUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign photographer',
        variant: 'destructive',
      });
    }
  }, [
    closePhotographerPicker,
    editModePhotographerRows.length,
    isEditMode,
    onShootUpdate,
    photographerPickerContext,
    refreshShootMutations,
    resolvePhotographerDetails,
    selectedPhotographerId,
    shoot.id,
    toast,
    updateField,
  ]);

  const formatLocationLabel = useCallback((location?: { address?: string; city?: string; state?: string; zip?: string }) => {
    if (!location) return '';
    return [location.address, location.city, location.state, location.zip]
      .filter((part) => part && String(part).trim().length > 0)
      .join(', ');
  }, []);

  const timeToMinutes = useCallback((time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    if (!Number.isFinite(hours)) return 0;
    return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
  }, []);

  const buildAvailabilitySegments = useCallback((slots: Array<{ start_time: string; end_time: string }> = []) => {
    const segments: boolean[] = [];
    for (let hour = 8; hour < 20; hour += 1) {
      const segmentStart = hour * 60;
      const segmentEnd = (hour + 1) * 60;
      const hasSlot = slots.some((slot) => {
        const slotStart = timeToMinutes(slot.start_time);
        const slotEnd = timeToMinutes(slot.end_time);
        return slotStart < segmentEnd && slotEnd > segmentStart;
      });
      segments.push(hasSlot);
    }
    return segments;
  }, [timeToMinutes]);

  const formatAvailabilitySummary = useCallback((slots: Array<{ start_time: string; end_time: string }> = []) =>
    slots
      .slice(0, 3)
      .map((slot) => `${to12Hour(slot.start_time)}-${to12Hour(slot.end_time)}`)
      .join(', '), []);

  return {
    state: {
      editedShoot,
      taxAmountDirty,
      clients,
      selectedClientId,
      clientSearchOpen,
      editPhotographers: safeEditPhotographers,
      selectedPhotographerIdEdit,
      photographerSearchOpen,
      perCategoryPhotographers,
      perCategoryPopoverOpen,
      servicesList,
      selectedServiceIds,
      servicePrices,
      servicePhotographerPays,
      serviceSchedules,
      serviceDialogOpen,
      servicePanelCategory,
      serviceModalSearch,
      presenceOption,
      lockboxCode,
      lockboxLocation,
      accessContactName,
      accessContactPhone,
      propertyMetricsEdit,
      addressInput,
      assignPhotographerOpen,
      selectedPhotographerId,
      photographerPickerContext,
      photographers,
      searchQuery,
      sortBy,
      showAllPhotographers,
      isCalculatingDistances,
      isLoadingAvailability,
    },
    actions: {
      setTaxAmountDirty,
      setSelectedClientId,
      setClientSearchOpen,
      setSelectedPhotographerIdEdit,
      setPhotographerSearchOpen,
      setPerCategoryPhotographers,
      setPerCategoryPopoverOpen,
      setServicePrices,
      setServicePhotographerPays,
      updateServiceSchedule,
      setServiceDialogOpen,
      setServicePanelCategory,
      setServiceModalSearch,
      setPresenceOption,
      setLockboxCode,
      setLockboxLocation,
      setAccessContactName,
      setAccessContactPhone,
      setPropertyMetricsEdit,
      setAddressInput,
      setAssignPhotographerOpen,
      setSelectedPhotographerId,
      setSearchQuery,
      setSortBy,
      setShowAllPhotographers,
      updateField,
      handleSave,
      handleCancel,
      clearAddressDerivedState,
      handleAddressSelect,
      resolveServicePrice,
      toggleServiceSelection,
      resolvePhotographerDetails,
      closePhotographerPicker,
      openEditPhotographerPicker,
      handleAssignPhotographer,
      formatLocationLabel,
      buildAvailabilitySegments,
      formatAvailabilitySummary,
    },
    photographerAssignments,
    isAdminOrRep,
    effectiveSqft,
    serviceCategoryOptions,
    panelServices,
    filteredAndSortedPhotographers,
    editModePhotographerRows,
  };
}

export type {
  AddressDetailsForLookup,
  ClientOption,
  PhotographerPickerOption,
  ServiceCategoryOption,
  ServiceOption,
};
