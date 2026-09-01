import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { normalizeState } from '@/utils/stateUtils';
import type { PropertyDetailsData, ServicePackage } from '@/pages/bookShootModel';
import { getComplimentaryReshootTemplate } from './api';
import {
  calculateSelectedReturnRepStandard,
  currencyInputValue,
  findUnassignedCompensatedServices,
  getCompReshootSuggestedPolicy,
  repCompensationHasRecipient,
  resolveStandardPhotographerPay,
  type CompensationMode,
  type CompReshootReasonCode,
  type CompReshootResponsibility,
  type CompReshootServiceCompensation,
  type CompReshootServiceMapping,
  type CompReshootTemplate,
} from './model';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

type UseCompReshootBookingOptions = {
  enabled: boolean;
  sourceShootId: string | null;
  selectedServices: ServicePackage[];
  photographerId: string;
  servicePhotographers: Record<string, string>;
  propertySqft: number | null;
  setClient: SetState<string>;
  setAddress: SetState<string>;
  setCity: SetState<string>;
  setState: SetState<string>;
  setZip: SetState<string>;
  setPropertyDetails: SetState<PropertyDetailsData | null>;
  setPropertySqft: SetState<number | null>;
  setSelectedServices: (services: ServicePackage[]) => void;
  setServicePhotographers: SetState<Record<string, string>>;
  setServiceSchedules: SetState<Record<string, { date?: string; time?: string }>>;
  setShootType: (value: 'complimentary_reshoot') => void;
  setBypassPayment: SetState<boolean>;
  setAdjustedTotalInput: SetState<string>;
  remountPropertyForm: () => void;
};

const parseSqft = (details?: Record<string, unknown> | null) => {
  const value = details?.sqft ?? details?.livingArea ?? details?.living_area;
  const parsed = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(parsed)
    ? parsed
    : null;
};

export const useCompReshootBooking = ({
  enabled,
  sourceShootId,
  selectedServices,
  photographerId,
  servicePhotographers,
  propertySqft,
  setClient,
  setAddress,
  setCity,
  setState,
  setZip,
  setPropertyDetails,
  setPropertySqft,
  setSelectedServices,
  setServicePhotographers,
  setServiceSchedules,
  setShootType,
  setBypassPayment,
  setAdjustedTotalInput,
  remountPropertyForm,
}: UseCompReshootBookingOptions) => {
  const [template, setTemplate] = React.useState<CompReshootTemplate | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [reasonCode, setReasonCode] = React.useState<CompReshootReasonCode | ''>('');
  const [reasonNote, setReasonNote] = React.useState('');
  const [serviceMappings, setServiceMappings] = React.useState<Record<string, CompReshootServiceMapping>>({});
  const [responsibilityDirtyIds, setResponsibilityDirtyIds] = React.useState<Set<string>>(() => new Set());
  const [photographerMode, setPhotographerModeState] = React.useState<CompensationMode | null>(null);
  const [serviceCompensations, setServiceCompensations] = React.useState<Record<string, CompReshootServiceCompensation>>({});
  const [repMode, setRepModeState] = React.useState<CompensationMode | null>(null);
  const [repCustomAmount, setRepCustomAmountState] = React.useState('');
  const [compensationDirty, setCompensationDirty] = React.useState(false);
  const [pendingReasonCode, setPendingReasonCode] = React.useState<CompReshootReasonCode | null>(null);
  const [reasonConfirmationOpen, setReasonConfirmationOpen] = React.useState(false);
  const initializedSourceRef = React.useRef<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => uuidv4());

  React.useEffect(() => {
    if (!enabled || !sourceShootId) {
      setTemplate(null);
      setLoadError(null);
      initializedSourceRef.current = null;
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    void getComplimentaryReshootTemplate(sourceShootId)
      .then((nextTemplate) => {
        if (cancelled) return;
        setTemplate(nextTemplate);
        setClient(nextTemplate.client.id);
        setAddress(nextTemplate.property.address);
        setCity(nextTemplate.property.city);
        setState(normalizeState(nextTemplate.property.state) || nextTemplate.property.state);
        setZip(nextTemplate.property.zip);
        setPropertyDetails(nextTemplate.property.details ?? null);
        setPropertySqft(parseSqft(nextTemplate.property.details));
        setShootType('complimentary_reshoot');
        setBypassPayment(true);
        setAdjustedTotalInput('0.00');

        if (initializedSourceRef.current !== sourceShootId) {
          initializedSourceRef.current = sourceShootId;
          setIdempotencyKey(uuidv4());
          setSelectedServices([]);
          setServicePhotographers({});
          setServiceSchedules({});
          setReasonCode('');
          setReasonNote('');
          setServiceMappings({});
          setResponsibilityDirtyIds(new Set());
          setPhotographerModeState(null);
          setServiceCompensations({});
          setRepModeState(null);
          setRepCustomAmountState('');
          setCompensationDirty(false);
        }
        remountPropertyForm();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'The source shoot could not be loaded.';
        setLoadError(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    reloadToken,
    remountPropertyForm,
    setAddress,
    setAdjustedTotalInput,
    setBypassPayment,
    setCity,
    setClient,
    setPropertyDetails,
    setPropertySqft,
    setSelectedServices,
    setServicePhotographers,
    setServiceSchedules,
    setShootType,
    setState,
    setZip,
    sourceShootId,
  ]);

  const suggestedPolicy = reasonCode
    ? getCompReshootSuggestedPolicy(reasonCode, template?.reasonOptions)
    : null;

  React.useEffect(() => {
    if (!enabled || !template) return;
    setServiceMappings((current) => {
      const next: Record<string, CompReshootServiceMapping> = {};
      selectedServices.forEach((service) => {
        const existing = current[service.id];
        const existingSourceStillAvailable = existing?.sourceShootServiceId
          && template.sourceServices.some((source) => source.shootServiceId === existing.sourceShootServiceId);
        const matches = template.sourceServices.filter((source) => source.serviceId === String(service.id));
        next[service.id] = {
          sourceShootServiceId: existingSourceStillAvailable
            ? existing.sourceShootServiceId
            : matches.length === 1 ? matches[0].shootServiceId : '',
          responsibility: existing?.responsibility
            || suggestedPolicy?.responsibility
            || '',
        };
      });
      return next;
    });
    setServiceCompensations((current) => {
      const next: Record<string, CompReshootServiceCompensation> = {};
      selectedServices.forEach((service) => {
        next[service.id] = current[service.id] ?? { mode: 'standard', customAmount: '' };
      });
      return next;
    });
  }, [enabled, selectedServices, suggestedPolicy?.responsibility, template]);

  const applyReasonPolicy = React.useCallback((nextReason: CompReshootReasonCode) => {
    const policy = getCompReshootSuggestedPolicy(nextReason, template?.reasonOptions);
    setReasonCode(nextReason);
    setPhotographerModeState(policy.photographerMode);
    setRepModeState(policy.repMode);
    setRepCustomAmountState('');
    setServiceCompensations(Object.fromEntries(
      selectedServices.map((service) => [
        service.id,
        { mode: policy.photographerMode ?? 'standard', customAmount: '' },
      ]),
    ));
    setServiceMappings((current) => Object.fromEntries(
      Object.entries(current).map(([serviceId, mapping]) => [
        serviceId,
        {
          ...mapping,
          responsibility: policy.responsibility ?? '',
        },
      ]),
    ));
    setResponsibilityDirtyIds(new Set());
    setCompensationDirty(false);
  }, [selectedServices, template?.reasonOptions]);

  const requestReasonChange = React.useCallback((nextReason: CompReshootReasonCode) => {
    if (nextReason === reasonCode) return;
    if (compensationDirty || responsibilityDirtyIds.size > 0) {
      setPendingReasonCode(nextReason);
      setReasonConfirmationOpen(true);
      return;
    }
    applyReasonPolicy(nextReason);
  }, [applyReasonPolicy, compensationDirty, reasonCode, responsibilityDirtyIds.size]);

  const confirmReasonWithSuggestions = React.useCallback(() => {
    if (pendingReasonCode) applyReasonPolicy(pendingReasonCode);
    setPendingReasonCode(null);
    setReasonConfirmationOpen(false);
  }, [applyReasonPolicy, pendingReasonCode]);

  const confirmReasonKeepChoices = React.useCallback(() => {
    if (pendingReasonCode) setReasonCode(pendingReasonCode);
    setPendingReasonCode(null);
    setReasonConfirmationOpen(false);
  }, [pendingReasonCode]);

  const updateServiceMapping = React.useCallback((
    serviceId: string,
    patch: Partial<CompReshootServiceMapping>,
  ) => {
    setServiceMappings((current) => ({
      ...current,
      [serviceId]: {
        sourceShootServiceId: current[serviceId]?.sourceShootServiceId ?? '',
        responsibility: current[serviceId]?.responsibility ?? '',
        ...patch,
      },
    }));
    if (patch.responsibility !== undefined) {
      setResponsibilityDirtyIds((current) => new Set(current).add(serviceId));
    }
  }, []);

  const setPhotographerMode = React.useCallback((mode: CompensationMode) => {
    setPhotographerModeState(mode);
    if (mode === 'custom') {
      setServiceCompensations((current) => Object.fromEntries(
        selectedServices.map((service) => [
          service.id,
          current[service.id] ?? { mode: 'standard', customAmount: '' },
        ]),
      ));
    }
    setCompensationDirty(true);
  }, [selectedServices]);

  const setServiceCompensationMode = React.useCallback((serviceId: string, mode: CompensationMode) => {
    setServiceCompensations((current) => ({
      ...current,
      [serviceId]: {
        mode,
        customAmount: current[serviceId]?.customAmount ?? '',
      },
    }));
    setCompensationDirty(true);
  }, []);

  const setServiceCustomAmount = React.useCallback((serviceId: string, customAmount: string) => {
    setServiceCompensations((current) => ({
      ...current,
      [serviceId]: {
        mode: current[serviceId]?.mode ?? 'custom',
        customAmount,
      },
    }));
    setCompensationDirty(true);
  }, []);

  const setRepMode = React.useCallback((mode: CompensationMode) => {
    setRepModeState(mode);
    setCompensationDirty(true);
  }, []);

  const setRepCustomAmount = React.useCallback((amount: string) => {
    setRepCustomAmountState(amount);
    setCompensationDirty(true);
  }, []);

  const sourceByShootServiceId = React.useMemo(() => new Map(
    (template?.sourceServices ?? []).map((service) => [service.shootServiceId, service]),
  ), [template]);

  const getMappedSourceService = React.useCallback((serviceId: string) => {
    const sourceShootServiceId = serviceMappings[serviceId]?.sourceShootServiceId;
    return sourceShootServiceId ? sourceByShootServiceId.get(sourceShootServiceId) : undefined;
  }, [serviceMappings, sourceByShootServiceId]);

  const getStandardPay = React.useCallback((service: ServicePackage) => (
    resolveStandardPhotographerPay(service, propertySqft)
  ), [propertySqft]);

  const getServiceCompensation = React.useCallback((service: ServicePackage) => {
    const row = serviceCompensations[service.id] ?? { mode: 'standard' as const, customAmount: '' };
    const mode = photographerMode === 'custom' ? row.mode : photographerMode;
    if (mode === 'none' || !mode) return { mode: mode ?? 'none' as const, amount: 0 };
    if (mode === 'standard') return { mode, amount: getStandardPay(service) };
    return { mode, amount: currencyInputValue(row.customAmount) ?? 0 };
  }, [getStandardPay, photographerMode, serviceCompensations]);

  const photographerCompensationTotal = React.useMemo(() => selectedServices.reduce(
    (total, service) => total + getServiceCompensation(service).amount,
    0,
  ), [getServiceCompensation, selectedServices]);

  const repStandardCompensation = React.useMemo(() => calculateSelectedReturnRepStandard(
    selectedServices,
    propertySqft,
    Number(template?.rep?.rate ?? 15),
  ), [propertySqft, selectedServices, template?.rep?.rate]);
  const repCompensationTotal = repMode === 'standard'
    ? repStandardCompensation
    : repMode === 'custom'
      ? currencyInputValue(repCustomAmount) ?? 0
      : 0;
  const editorCompensationEstimate = template?.editor?.estimatedCompensation ?? null;
  const staffCompensationTotal = photographerCompensationTotal
    + repCompensationTotal
    + Number(editorCompensationEstimate ?? 0);

  const mappedSourceShootServiceIds = selectedServices
    .map((service) => serviceMappings[service.id]?.sourceShootServiceId)
    .filter((value): value is string => Boolean(value));
  const mappingIsComplete = selectedServices.length > 0
    && new Set(mappedSourceShootServiceIds).size === selectedServices.length
    && selectedServices.every((service) => {
    const mapping = serviceMappings[service.id];
    return Boolean(mapping?.sourceShootServiceId && mapping?.responsibility);
  });
  const photographerCompensationIsComplete = Boolean(photographerMode) && (
    photographerMode !== 'custom'
      || selectedServices.every((service) => {
        const row = serviceCompensations[service.id];
        return Boolean(row?.mode) && (row.mode !== 'custom' || currencyInputValue(row.customAmount) !== null);
      })
  );
  const unassignedCompensatedServices = findUnassignedCompensatedServices(
    selectedServices,
    photographerMode,
    serviceCompensations,
    photographerId,
    servicePhotographers,
  );
  const photographerAssignmentsAreComplete = unassignedCompensatedServices.length === 0;
  const repRecipientIsComplete = repCompensationHasRecipient(repMode, template?.rep?.id);
  const repCompensationIsComplete = Boolean(repMode)
    && repRecipientIsComplete
    && (repMode !== 'custom' || currencyInputValue(repCustomAmount) !== null);
  const reasonIsComplete = Boolean(reasonCode)
    && (reasonCode !== 'other' || reasonNote.trim().length > 0);
  const isValid = Boolean(template)
    && !isLoading
    && reasonIsComplete
    && mappingIsComplete
    && photographerCompensationIsComplete
    && photographerAssignmentsAreComplete
    && repCompensationIsComplete;
  const missingPhotographerNames = unassignedCompensatedServices
    .map((service) => service.name)
    .join(', ') || 'each compensated service';
  const scheduleValidationIssue = photographerAssignmentsAreComplete ? null : {
    title: 'Photographer assignment required',
    description: `Assign a photographer for ${missingPhotographerNames}, or choose None compensation on Review.`,
  };
  const submissionValidationIssue = !photographerAssignmentsAreComplete
    ? {
        title: 'Photographer assignment required',
        description: `Go back to Schedule and assign a photographer for ${missingPhotographerNames}, or choose None compensation.`,
      }
    : !repRecipientIsComplete
      ? {
          title: 'Sales rep unavailable',
          description: 'This source shoot has no assigned sales rep. Choose None for rep compensation.',
        }
      : !isValid
        ? {
            title: 'Complete comp reshoot details',
            description: 'Confirm the reason, affected source items, responsibility, and both compensation choices.',
          }
        : null;

  return {
    enabled,
    sourceShootId,
    template,
    isLoading,
    loadError,
    retry: () => setReloadToken((value) => value + 1),
    reasonCode,
    reasonNote,
    setReasonNote,
    suggestedPolicy,
    requestReasonChange,
    pendingReasonCode,
    reasonConfirmationOpen,
    setReasonConfirmationOpen,
    confirmReasonWithSuggestions,
    confirmReasonKeepChoices,
    serviceMappings,
    updateServiceMapping,
    getMappedSourceService,
    photographerMode,
    setPhotographerMode,
    serviceCompensations,
    setServiceCompensationMode,
    setServiceCustomAmount,
    getStandardPay,
    getServiceCompensation,
    repMode,
    setRepMode,
    repCustomAmount,
    setRepCustomAmount,
    photographerCompensationTotal,
    repCompensationTotal,
    repStandardCompensation,
    editorCompensationEstimate,
    staffCompensationTotal,
    mappingIsComplete,
    reasonIsComplete,
    photographerCompensationIsComplete,
    photographerAssignmentsAreComplete,
    unassignedCompensatedServices,
    repCompensationIsComplete,
    repRecipientIsComplete,
    scheduleValidationIssue,
    submissionValidationIssue,
    isValid,
    compensationDirty,
    idempotencyKey,
    rotateIdempotencyKey: () => setIdempotencyKey(uuidv4()),
  };
};

export type CompReshootBookingController = ReturnType<typeof useCompReshootBooking>;
