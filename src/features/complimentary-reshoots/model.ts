import { resolveSelectedServicePrice, type ServicePackage } from '@/pages/bookShootModel';

export type CompReshootReasonCode =
  | 'missed_area'
  | 'quality_correction'
  | 'company_error'
  | 'client_accommodation'
  | 'weather_access'
  | 'other';

export type CompensationMode = 'none' | 'standard' | 'custom';

export type CompReshootResponsibility =
  | 'photographer'
  | 'company'
  | 'client'
  | 'weather_access'
  | 'other';

export const COMP_RESHOOT_REASON_OPTIONS: Array<{
  value: CompReshootReasonCode;
  label: string;
  description: string;
}> = [
  { value: 'missed_area', label: 'Missed area', description: 'A requested room or area was not captured.' },
  { value: 'quality_correction', label: 'Quality correction', description: 'The original capture needs to be corrected.' },
  { value: 'company_error', label: 'Company error', description: 'An internal planning or processing issue caused the return visit.' },
  { value: 'client_accommodation', label: 'Client accommodation', description: 'A courtesy return visit requested for the client.' },
  { value: 'weather_access', label: 'Weather or access', description: 'Weather or property access prevented completion.' },
  { value: 'other', label: 'Other', description: 'Another reason that requires an internal note.' },
];

export const COMP_RESHOOT_RESPONSIBILITY_OPTIONS: Array<{
  value: CompReshootResponsibility;
  label: string;
}> = [
  { value: 'photographer', label: 'Photographer' },
  { value: 'company', label: 'Company' },
  { value: 'client', label: 'Client' },
  { value: 'weather_access', label: 'Weather / access' },
  { value: 'other', label: 'Other' },
];

export type CompReshootSuggestedPolicy = {
  photographerMode: CompensationMode | null;
  repMode: CompensationMode | null;
  suggestedRepMode: CompensationMode | null;
  responsibility: CompReshootResponsibility | null;
};

export type CompReshootReasonOption = {
  code: CompReshootReasonCode;
  label: string;
  suggestedResponsibility: CompReshootResponsibility | null;
  suggestedPhotographerMode: CompensationMode | null;
  suggestedSalesRepMode: CompensationMode | null;
  requiresNote: boolean;
  requiresExplicitCompensation: boolean;
  requiresExplicitSalesRepChoice: boolean;
};

export const getCompReshootSuggestedPolicy = (
  reason: CompReshootReasonCode,
  serverOptions: CompReshootReasonOption[] = [],
): CompReshootSuggestedPolicy => {
  const serverOption = serverOptions.find((option) => option.code === reason);
  if (serverOption) {
    return {
      photographerMode: serverOption.requiresExplicitCompensation
        ? null
        : serverOption.suggestedPhotographerMode,
      repMode: serverOption.requiresExplicitSalesRepChoice
        ? null
        : serverOption.suggestedSalesRepMode,
      suggestedRepMode: serverOption.suggestedSalesRepMode,
      responsibility: serverOption.suggestedResponsibility,
    };
  }
  switch (reason) {
    case 'missed_area':
    case 'quality_correction':
      return { photographerMode: 'none', repMode: 'none', suggestedRepMode: 'none', responsibility: 'photographer' };
    case 'company_error':
      return { photographerMode: 'standard', repMode: 'none', suggestedRepMode: 'none', responsibility: 'company' };
    case 'client_accommodation':
      return { photographerMode: 'standard', repMode: null, suggestedRepMode: 'none', responsibility: 'client' };
    case 'weather_access':
      return { photographerMode: 'standard', repMode: 'none', suggestedRepMode: 'none', responsibility: 'weather_access' };
    case 'other':
      return { photographerMode: null, repMode: null, suggestedRepMode: null, responsibility: null };
  }
};

export const getCompReshootReasonLabel = (reason?: string | null) =>
  COMP_RESHOOT_REASON_OPTIONS.find((option) => option.value === reason)?.label || 'Complimentary reshoot';

export type CompReshootShootSummary = {
  id: string;
  address: string;
  scheduledAt?: string | null;
};

export type CompReshootSourceService = {
  shootServiceId: string;
  serviceId: string;
  name: string;
  nominalPrice: number;
  standardPhotographerPay: number;
  photographerId?: string;
  photographerName?: string;
};

export type CompReshootTemplate = {
  policyVersion: string;
  source: CompReshootShootSummary;
  parent: CompReshootShootSummary;
  root: CompReshootShootSummary;
  client: {
    id: string;
    name?: string;
  };
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    details?: Record<string, unknown> | null;
  };
  sourceServices: CompReshootSourceService[];
  reasonOptions: CompReshootReasonOption[];
  rep?: {
    id?: string;
    name?: string;
    standardCompensation: number;
    basisAmount: number;
    rate: number;
  } | null;
  editor?: {
    name?: string;
    estimatedCompensation?: number | null;
  } | null;
};

export type CompReshootServiceMapping = {
  sourceShootServiceId: string;
  responsibility: CompReshootResponsibility | '';
};

export type CompReshootServiceCompensation = {
  mode: CompensationMode;
  customAmount: string;
};

export type ComplimentaryReshootCreatePayload = Record<string, unknown> & {
  shoot_type: 'complimentary_reshoot';
  policy_version?: string;
  reason_code: CompReshootReasonCode;
  reason_note?: string;
  photographer_compensation_mode: CompensationMode | 'mixed';
  sales_rep_compensation_mode: CompensationMode;
  sales_rep_compensation_amount?: number;
};

export type ShootCompensationPayload = {
  compensations: Array<{
    id: string | number;
    mode: CompensationMode;
    amount?: number;
    expected_updated_at?: string;
  }>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const firstNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (value !== null && value !== undefined && value !== '' && Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const normalizeShootSummary = (
  value: unknown,
  fallback?: Record<string, unknown>,
): CompReshootShootSummary => {
  const record = asRecord(value);
  const location = asRecord(record.location);
  const fallbackLocation = asRecord(fallback?.location);
  const address = firstString(
    record.full_address,
    record.fullAddress,
    location.fullAddress,
    record.address,
    location.address,
    fallback?.full_address,
    fallback?.fullAddress,
    fallbackLocation.fullAddress,
    fallback?.address,
    fallbackLocation.address,
  );
  return {
    id: firstString(record.id, fallback?.id),
    address,
    scheduledAt: firstString(
      record.scheduled_at,
      record.scheduledAt,
      record.scheduled_date,
      fallback?.scheduled_at,
      fallback?.scheduledAt,
      fallback?.scheduled_date,
    ) || null,
  };
};

export const normalizeCompReshootTemplate = (payload: unknown): CompReshootTemplate => {
  const envelope = asRecord(payload);
  const data = asRecord(envelope.data ?? payload);
  const sourceRecord = asRecord(data.source_shoot ?? data.sourceShoot ?? data.shoot ?? data.source);
  const sourceLocation = asRecord(sourceRecord.location);
  const clientRecord = asRecord(data.client ?? sourceRecord.client);
  const propertyContainer = asRecord(data.property);
  const nestedPropertyDetails = asRecord(
    propertyContainer.property_details
      ?? propertyContainer.propertyDetails
      ?? data.property_details
      ?? sourceRecord.property_details
      ?? sourceRecord.propertyDetails,
  );
  const propertyRecord = Object.keys(nestedPropertyDetails).length
    ? nestedPropertyDetails
    : propertyContainer;
  const sourceServicesRaw = asArray(
    data.source_service_items ?? data.sourceServiceItems ?? data.source_services ?? data.sourceServices
      ?? sourceRecord.service_items ?? sourceRecord.serviceItems ?? sourceRecord.services,
  );
  const sourceServices = sourceServicesRaw.map((value) => {
    const row = asRecord(value);
    const service = asRecord(row.service);
    const photographer = asRecord(row.photographer ?? row.resolved_photographer);
    return {
      shootServiceId: firstString(row.shoot_service_id, row.shootServiceId, row.id),
      serviceId: firstString(row.service_id, row.serviceId, service.id, row.id),
      name: firstString(row.service_name, row.serviceName, row.name, service.name) || 'Service',
      nominalPrice: firstNumber(
        row.nominal_total,
        row.nominalTotal,
        row.nominal_unit_price,
        row.nominalUnitPrice,
        row.nominal_price,
        row.nominalPrice,
        row.subtotal,
        row.price,
        service.price,
      ),
      standardPhotographerPay: firstNumber(
        row.standard_photographer_pay,
        row.standardPhotographerPay,
        row.photographer_pay,
        row.photographerPay,
        service.photographer_pay,
        service.photographerPay,
      ),
      photographerId: firstString(
        row.photographer_id,
        row.photographerId,
        row.resolved_photographer_id,
        photographer.id,
      ) || undefined,
      photographerName: firstString(
        row.photographer_name,
        row.photographerName,
        row.resolved_photographer_name,
        photographer.name,
      ) || undefined,
    };
  }).filter((service) => service.shootServiceId && service.serviceId);
  const source = normalizeShootSummary(sourceRecord, data);
  const parent = normalizeShootSummary(
    data.parent ?? data.parent_shoot ?? data.parentShoot ?? data.immediate_parent ?? data.immediateParent,
    sourceRecord,
  );
  const root = normalizeShootSummary(
    data.root ?? data.root_shoot ?? data.rootShoot ?? data.original_shoot ?? data.originalShoot,
    sourceRecord,
  );
  const repRecord = asRecord(data.sales_rep ?? data.salesRep ?? data.rep ?? sourceRecord.rep ?? clientRecord.rep);
  const repStandardRecord = asRecord(data.sales_rep_standard ?? data.salesRepStandard);
  const reasonOptions = asArray(data.reason_options ?? data.reasonOptions).map((value) => {
    const option = asRecord(value);
    const code = firstString(option.code, option.value) as CompReshootReasonCode;
    if (!COMP_RESHOOT_REASON_OPTIONS.some((known) => known.value === code)) return null;
    const responsibility = firstString(option.suggested_responsibility, option.suggestedResponsibility);
    const photographerMode = firstString(option.suggested_photographer_mode, option.suggestedPhotographerMode);
    const salesRepMode = firstString(option.suggested_sales_rep_mode, option.suggestedSalesRepMode);
    return {
      code,
      label: firstString(option.label) || getCompReshootReasonLabel(code),
      suggestedResponsibility: (responsibility || null) as CompReshootResponsibility | null,
      suggestedPhotographerMode: (photographerMode || null) as CompensationMode | null,
      suggestedSalesRepMode: (salesRepMode || null) as CompensationMode | null,
      requiresNote: Boolean(option.requires_note ?? option.requiresNote),
      requiresExplicitCompensation: Boolean(
        option.requires_explicit_compensation ?? option.requiresExplicitCompensation,
      ),
      requiresExplicitSalesRepChoice: Boolean(
        option.requires_explicit_sales_rep_choice ?? option.requiresExplicitSalesRepChoice,
      ),
    } satisfies CompReshootReasonOption;
  }).filter((option): option is CompReshootReasonOption => Boolean(option));
  const editorRecord = asRecord(data.editor ?? sourceRecord.editor);
  return {
    policyVersion: firstString(data.policy_version, data.policyVersion) || 'unknown',
    source,
    parent: parent.id ? parent : source,
    root: root.id ? root : source,
    client: {
      id: firstString(data.client_id, data.clientId, clientRecord.id, sourceRecord.client_id),
      name: firstString(clientRecord.name, data.client_name, data.clientName) || undefined,
    },
    property: {
      address: firstString(propertyContainer.address, data.address, sourceRecord.address, sourceLocation.address),
      city: firstString(propertyContainer.city, data.city, sourceRecord.city, sourceLocation.city),
      state: firstString(propertyContainer.state, data.state, sourceRecord.state, sourceLocation.state),
      zip: firstString(propertyContainer.zip, data.zip, sourceRecord.zip, sourceLocation.zip),
      details: Object.keys(propertyRecord).length ? propertyRecord : null,
    },
    sourceServices,
    reasonOptions,
    rep: Object.keys(repRecord).length ? {
      id: firstString(repRecord.id) || undefined,
      name: firstString(repRecord.name) || undefined,
      standardCompensation: firstNumber(
        data.standard_sales_rep_compensation,
        data.standardSalesRepCompensation,
        repStandardRecord.amount,
        repRecord.standard_compensation,
        repRecord.standardCompensation,
        repRecord.estimated_commission,
      ),
      basisAmount: firstNumber(repStandardRecord.basis_amount, repStandardRecord.basisAmount),
      rate: firstNumber(repStandardRecord.rate) || 15,
    } : null,
    editor: Object.keys(editorRecord).length || data.editor_estimated_compensation !== undefined ? {
      name: firstString(editorRecord.name) || undefined,
      estimatedCompensation: data.editor_estimated_compensation === null
        ? null
        : firstNumber(
          data.editor_estimated_compensation,
          data.editorEstimatedCompensation,
          editorRecord.estimated_compensation,
          editorRecord.estimatedCompensation,
        ),
    } : null,
  };
};

export const resolveStandardPhotographerPay = (
  service: ServicePackage,
  sqft: number | null | undefined,
) => {
  if (service.pricing_type === 'variable' && sqft && service.sqft_ranges?.length) {
    const range = service.sqft_ranges.find((item) => sqft >= item.sqft_from && sqft <= item.sqft_to);
    if (range?.photographer_pay !== null && range?.photographer_pay !== undefined) {
      return Number(range.photographer_pay) || 0;
    }
  }
  return Number(service.photographer_pay ?? 0) || 0;
};

export const calculateSelectedReturnRepStandard = (
  services: ServicePackage[],
  sqft: number | null | undefined,
  rate: number,
) => {
  const basis = services.reduce((total, service) => {
    if (service.exclude_from_sales_commission) return total;
    const quantity = Math.max(Number(service.quantity ?? 1) || 1, 1);
    return total + resolveSelectedServicePrice(service, sqft) * quantity;
  }, 0);
  return Math.round(basis * (Math.max(rate, 0) / 100) * 100) / 100;
};

export const currencyInputValue = (value: string) => {
  const parsed = Number(value);
  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
};

export const getEffectivePhotographerCompensationMode = (
  serviceId: string,
  photographerMode: CompensationMode | null,
  serviceCompensations: Record<string, CompReshootServiceCompensation>,
): CompensationMode | null => (
  photographerMode === 'custom'
    ? serviceCompensations[serviceId]?.mode ?? 'standard'
    : photographerMode
);

export const findUnassignedCompensatedServices = (
  services: ServicePackage[],
  photographerMode: CompensationMode | null,
  serviceCompensations: Record<string, CompReshootServiceCompensation>,
  photographerId: string,
  servicePhotographers: Record<string, string>,
) => services.filter((service) => {
  const mode = getEffectivePhotographerCompensationMode(
    service.id,
    photographerMode,
    serviceCompensations,
  );
  if (!mode || mode === 'none') return false;
  return !(servicePhotographers[service.id] || photographerId).trim();
});

export const repCompensationHasRecipient = (
  mode: CompensationMode | null,
  repId?: string | null,
) => !mode || mode === 'none' || Boolean(repId?.trim());
