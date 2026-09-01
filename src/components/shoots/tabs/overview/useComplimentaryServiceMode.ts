import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { CompReshootReasonCode } from '@/features/complimentary-reshoots/model';
import type { ShootData } from '@/types/shoots';
import { getShootServiceItems } from '@/utils/shootServiceItems';
import { buildScheduledAtIso } from './shootOverviewEditorSupport';
import type {
  ServiceOption,
  ServiceScheduleFields,
  UseShootOverviewEditorArgs,
} from './shootOverviewEditorSupport';
import type { ComplimentaryServiceOptionsPayload } from './shootOverviewUpdateTypes';

export type ComplimentarySourceServiceOption = ServiceOption & {
  sourceShootServiceId: string;
  catalogServiceId: string;
  defaultPhotographerId?: string;
};

type UseComplimentaryServiceModeArgs = {
  shoot: ShootData;
  isAdmin: boolean;
  isEditMode: boolean;
  selectedPhotographerId: string;
  toast: UseShootOverviewEditorArgs['toast'];
};

const EMPTY_SCHEDULE: ServiceScheduleFields = { date: '', time: '' };

export function useComplimentaryServiceMode({
  shoot,
  isAdmin,
  isEditMode,
  selectedPhotographerId,
  toast,
}: UseComplimentaryServiceModeArgs) {
  const [enabled, setEnabled] = useState(false);
  const [selectedSourceServiceIds, setSelectedSourceServiceIds] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<Record<string, ServiceScheduleFields>>({});
  const [photographerIds, setPhotographerIds] = useState<Record<string, string>>({});
  const [reasonCode, setReasonCode] = useState<CompReshootReasonCode | ''>('');
  const [reasonNote, setReasonNote] = useState('');
  const [payPhotographer, setPayPhotographer] = useState(false);
  const [paySalesRep, setPaySalesRep] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuidv4());
  const ordinaryServiceMutationTouchedRef = useRef(false);

  const hasAssignedSalesRep = Boolean(shoot.client?.rep?.id ?? shoot.rep?.id);
  const sourceServiceOptions = useMemo<ComplimentarySourceServiceOption[]>(() => (
    getShootServiceItems(shoot).flatMap((item) => {
      if (item.isInvoiceAdjustment || !item.shootServiceId || !item.serviceId) return [];
      const source = item.source as unknown as Record<string, unknown>;
      const photographer = source.photographer && typeof source.photographer === 'object'
        ? source.photographer as Record<string, unknown>
        : null;
      const resolvedPhotographer = source.resolved_photographer && typeof source.resolved_photographer === 'object'
        ? source.resolved_photographer as Record<string, unknown>
        : null;
      const defaultPhotographerId = String(
        source.photographer_id
          ?? source.photographerId
          ?? photographer?.id
          ?? resolvedPhotographer?.id
          ?? shoot.photographer?.id
          ?? '',
      );
      const category = source.category as ServiceOption['category'];

      return [{
        id: item.shootServiceId,
        sourceShootServiceId: item.shootServiceId,
        catalogServiceId: item.serviceId,
        name: item.name,
        description: typeof source.description === 'string'
          ? source.description
          : 'Add this service to the complimentary return visit.',
        price: 0,
        category: category ?? null,
        photographer_pay: source.photographer_pay == null ? null : Number(source.photographer_pay),
        defaultPhotographerId: defaultPhotographerId || undefined,
      }];
    })
  ), [shoot]);

  const reset = useCallback(() => {
    ordinaryServiceMutationTouchedRef.current = false;
    setEnabled(false);
    setSelectedSourceServiceIds([]);
    setSchedules({});
    setPhotographerIds({});
    setReasonCode('');
    setReasonNote('');
    setPayPhotographer(false);
    setPaySalesRep(false);
    setIdempotencyKey(uuidv4());
  }, []);

  useEffect(() => reset(), [isEditMode, reset, shoot.id]);

  const setModeEnabled = useCallback((nextEnabled: boolean) => {
    if (isAdmin) setEnabled(nextEnabled);
  }, [isAdmin]);

  const toggleServiceSelection = useCallback((sourceShootServiceId: string) => {
    if (!isAdmin) return;
    const sourceService = sourceServiceOptions.find(
      (service) => service.sourceShootServiceId === sourceShootServiceId,
    );
    if (!sourceService) return;

    setSelectedSourceServiceIds((current) => {
      if (current.includes(sourceShootServiceId)) {
        setSchedules((currentSchedules) => {
          const next = { ...currentSchedules };
          delete next[sourceShootServiceId];
          return next;
        });
        setPhotographerIds((currentPhotographers) => {
          const next = { ...currentPhotographers };
          delete next[sourceShootServiceId];
          return next;
        });
        return current.filter((id) => id !== sourceShootServiceId);
      }

      setSchedules((currentSchedules) => ({
        ...currentSchedules,
        [sourceShootServiceId]: currentSchedules[sourceShootServiceId] || EMPTY_SCHEDULE,
      }));
      const defaultPhotographerId = sourceService.defaultPhotographerId || selectedPhotographerId;
      if (defaultPhotographerId) {
        setPhotographerIds((currentPhotographers) => ({
          ...currentPhotographers,
          [sourceShootServiceId]: currentPhotographers[sourceShootServiceId] || defaultPhotographerId,
        }));
      }
      return [...current, sourceShootServiceId];
    });
  }, [isAdmin, selectedPhotographerId, sourceServiceOptions]);

  const updateServiceSchedule = useCallback((
    sourceShootServiceId: string,
    field: keyof ServiceScheduleFields,
    value: string,
  ) => {
    if (!isAdmin) return;
    setSchedules((current) => ({
      ...current,
      [sourceShootServiceId]: {
        ...(current[sourceShootServiceId] || EMPTY_SCHEDULE),
        [field]: value,
      },
    }));
  }, [isAdmin]);

  const setServicePhotographer = useCallback((sourceShootServiceId: string, photographerId: string) => {
    setPhotographerIds((current) => ({ ...current, [sourceShootServiceId]: photographerId }));
  }, []);

  const getServicePhotographer = useCallback((sourceShootServiceId: string) => (
    photographerIds[sourceShootServiceId]
      || sourceServiceOptions.find((service) => service.sourceShootServiceId === sourceShootServiceId)?.defaultPhotographerId
      || selectedPhotographerId
      || ''
  ), [photographerIds, selectedPhotographerId, sourceServiceOptions]);

  const markOrdinaryServiceMutationTouched = useCallback(() => {
    ordinaryServiceMutationTouchedRef.current = true;
  }, []);

  const hasSelectedServices = isAdmin && selectedSourceServiceIds.length > 0;
  const validateBeforeSave = useCallback(() => {
    if (!hasSelectedServices) return true;
    if (ordinaryServiceMutationTouchedRef.current) {
      toast({
        title: 'Save standard service changes first',
        description: 'Comp services keep a separate billing trail. Save changes to the original services, then add the comp return visit.',
        variant: 'destructive',
      });
      return false;
    }
    if (!reasonCode) {
      toast({
        title: 'Choose a comp reason',
        description: 'Select why the return visit is complimentary before saving.',
        variant: 'destructive',
      });
      return false;
    }
    if (reasonCode === 'other' && !reasonNote.trim()) {
      toast({
        title: 'Add an internal reason',
        description: 'Describe why this return visit is complimentary before saving.',
        variant: 'destructive',
      });
      return false;
    }

    const incompleteServiceId = selectedSourceServiceIds.find((sourceShootServiceId) => {
      const schedule = schedules[sourceShootServiceId];
      const photographerId = Number(photographerIds[sourceShootServiceId]);
      return !schedule?.date || !schedule.time || !Number.isFinite(photographerId) || photographerId <= 0;
    });
    if (!incompleteServiceId) return true;

    const serviceName = sourceServiceOptions.find(
      (service) => service.sourceShootServiceId === incompleteServiceId,
    )?.name;
    toast({
      title: 'Finish the comp schedule',
      description: `${serviceName || 'Each complimentary service'} needs a date, time, and photographer.`,
      variant: 'destructive',
    });
    return false;
  }, [hasSelectedServices, photographerIds, reasonCode, reasonNote, schedules, selectedSourceServiceIds, sourceServiceOptions, toast]);

  const buildPayload = useCallback((): ComplimentaryServiceOptionsPayload | undefined => {
    if (!hasSelectedServices || !reasonCode) return undefined;

    return {
      idempotency_key: idempotencyKey,
      reason_code: reasonCode,
      ...(reasonNote.trim() ? { reason_note: reasonNote.trim() } : {}),
      pay_photographer: payPhotographer,
      pay_sales_rep: hasAssignedSalesRep && paySalesRep,
      service_items: selectedSourceServiceIds.map((sourceShootServiceId) => {
        const service = sourceServiceOptions.find(
          (option) => option.sourceShootServiceId === sourceShootServiceId,
        );
        const schedule = schedules[sourceShootServiceId];
        return {
          source_shoot_service_id: Number(sourceShootServiceId),
          service_id: Number(service?.catalogServiceId),
          photographer_id: Number(photographerIds[sourceShootServiceId]),
          scheduled_at: buildScheduledAtIso(schedule.date, schedule.time) as string,
        };
      }),
    };
  }, [hasAssignedSalesRep, hasSelectedServices, idempotencyKey, payPhotographer, paySalesRep, photographerIds, reasonCode, reasonNote, schedules, selectedSourceServiceIds, sourceServiceOptions]);

  return {
    state: {
      enabled,
      selectedSourceServiceIds,
      schedules,
      photographerIds,
      reasonCode,
      reasonNote,
      payPhotographer,
      paySalesRep,
    },
    actions: {
      setModeEnabled,
      toggleServiceSelection,
      updateServiceSchedule,
      setServicePhotographer,
      setReasonCode,
      setReasonNote,
      setPayPhotographer,
      setPaySalesRep,
      getServicePhotographer,
      markOrdinaryServiceMutationTouched,
      validateBeforeSave,
      buildPayload,
      reset,
    },
    sourceServiceOptions,
    hasAssignedSalesRep,
    hasSelectedServices,
  };
}
