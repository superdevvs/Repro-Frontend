import { X } from 'lucide-react';
import { ServiceSelectionDialog } from '@/components/booking/ServiceSelectionDialog';
import type { ServiceSelectionOption } from '@/components/booking/ServiceSelectionDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buildServiceTimeOptions, ServiceDatePicker, ServiceTimePicker } from '@/components/shoots/ServiceSchedulePicker';
import { ShootData } from '@/types/shoots';
import type { ServiceCategoryOption, ServiceOption } from './useShootOverviewEditor';
import {
  formatDateForWallClockInput,
  formatTimeForWallClockInput,
} from '@/utils/wallClockDateTime';

type OverviewServicesSectionProps = {
  isEditMode: boolean;
  shoot: ShootData;
  services: any[];
  servicesList: ServiceOption[];
  selectedServiceIds: string[];
  serviceSchedules: Record<string, { date: string; time: string }>;
  updateServiceSchedule: (serviceId: string, field: 'date' | 'time', value: string) => void;
  serviceDialogOpen: boolean;
  setServiceDialogOpen: (open: boolean) => void;
  serviceCategoryOptions: ServiceCategoryOption[];
  servicePanelCategory: string;
  setServicePanelCategory: (categoryId: string) => void;
  serviceModalSearch: string;
  setServiceModalSearch: (value: string) => void;
  panelServices: ServiceOption[];
  toggleServiceSelection: (serviceId: string) => void;
  formatServiceLabel: (service: any) => string;
  getServiceCountBadge: (service: any) => string | null;
  getServiceDisplayPrice: (service: ServiceOption) => string;
  getReadonlyServiceDisplayPrice: (service: any) => string;
  getServiceCategoryBadgeName: (service: ServiceOption) => string | null;
  effectiveSqft: number | null;
};

const parseScheduleDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateValue = (value?: string | null) => {
  const wallClockDate = formatDateForWallClockInput(value);
  if (wallClockDate) return wallClockDate;

  const parsed = parseScheduleDate(value);
  if (!parsed) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimeValue = (value?: string | null) => {
  if (!value) return '';
  const wallClockTime = formatTimeForWallClockInput(value);
  if (wallClockTime) return wallClockTime;

  const parsed = parseScheduleDate(value);
  if (parsed) {
    return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
  }
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
};

const getShootServiceSchedule = (shoot: ShootData, serviceId: string) => {
  const sources = [
    ...((shoot as any).serviceItems || []),
    ...((shoot as any).service_items || []),
    ...(shoot.serviceObjects || []),
  ];
  const item = sources.find((source: any) => {
    if (!source || typeof source !== 'object') return false;
    const rawId = source.service_id ?? source.serviceId ?? source.id;
    return rawId !== null && rawId !== undefined && String(rawId) === serviceId;
  });
  const scheduledAt = item?.scheduled_at ?? item?.scheduledAt;
  if (!scheduledAt) return null;
  return {
    date: formatDateValue(String(scheduledAt)),
    time: formatTimeValue(String(scheduledAt)),
  };
};

export function OverviewServicesSection({
  isEditMode,
  shoot,
  services,
  servicesList,
  selectedServiceIds,
  serviceSchedules,
  updateServiceSchedule,
  serviceDialogOpen,
  setServiceDialogOpen,
  serviceCategoryOptions,
  servicePanelCategory,
  setServicePanelCategory,
  serviceModalSearch,
  setServiceModalSearch,
  panelServices,
  toggleServiceSelection,
  formatServiceLabel,
  getServiceCountBadge,
  getServiceDisplayPrice,
  getReadonlyServiceDisplayPrice,
  getServiceCategoryBadgeName,
  effectiveSqft,
}: OverviewServicesSectionProps) {
  const selectedServicesForDialog = servicesList.filter((service) => selectedServiceIds.includes(String(service.id)));
  const handleSelectedServicesChange = (nextServices: ServiceSelectionOption[]) => {
    const currentIds = new Set(selectedServiceIds.map(String));
    const nextIds = new Set(nextServices.map((service) => String(service.id)));

    selectedServiceIds.forEach((serviceId) => {
      if (!nextIds.has(String(serviceId))) {
        toggleServiceSelection(String(serviceId));
      }
    });

    nextServices.forEach((service) => {
      const serviceId = String(service.id);
      if (!currentIds.has(serviceId)) {
        toggleServiceSelection(serviceId);
      }
    });
  };

  return (
    <div className="p-2.5 border rounded-lg bg-card">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Services</span>
      {isEditMode ? (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
              <p className="text-xs font-medium">Selected services</p>
              <Badge variant={selectedServiceIds.length ? 'default' : 'secondary'} className="shrink-0 rounded-full px-2 py-0.5 text-[10px]">
                {selectedServiceIds.length} selected
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs sm:w-auto"
              onClick={() => setServiceDialogOpen(true)}
            >
              {selectedServiceIds.length ? 'Edit services' : 'Select services'}
            </Button>
            <ServiceSelectionDialog
              open={serviceDialogOpen}
              onOpenChange={setServiceDialogOpen}
              services={servicesList}
              selectedServices={selectedServicesForDialog}
              onSelectedServicesChange={handleSelectedServicesChange}
              effectiveSqft={effectiveSqft}
            />
          </div>
          {selectedServiceIds.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto overflow-x-hidden pr-1">
              {selectedServiceIds.map((serviceId) => {
                const service = servicesList.find((serviceOption) => serviceOption.id === serviceId);
                if (!service) return null;
                const existingSchedule = getShootServiceSchedule(shoot, serviceId);
                const orderSchedule = {
                  date: formatDateValue(shoot.scheduledDate),
                  time: formatTimeValue(shoot.time) || '10:00',
                };
                const savedSchedule = serviceSchedules[serviceId];
                const schedule =
                  existingSchedule &&
                  savedSchedule &&
                  savedSchedule.date === orderSchedule.date &&
                  savedSchedule.time === orderSchedule.time
                    ? existingSchedule
                    : (savedSchedule || existingSchedule || { date: '', time: '10:00' });

                return (
                  <div
                    key={serviceId}
                    className="min-w-0 rounded-md border border-primary/30 bg-primary/5 p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-xs truncate block">{service.name}</span>
                        {service.pricing_type === 'variable' && effectiveSqft && (
                          <span className="text-[10px] text-muted-foreground">
                            Variable • {effectiveSqft.toLocaleString()} sqft
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{getServiceDisplayPrice(service)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 flex-shrink-0"
                          onClick={() => toggleServiceSelection(serviceId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-medium text-muted-foreground">Schedule date</span>
                        <ServiceDatePicker
                          value={schedule.date}
                          onChange={(value) => updateServiceSchedule(serviceId, 'date', value)}
                          triggerClassName="h-10 rounded-lg sm:h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-medium text-muted-foreground">Schedule time</span>
                        <ServiceTimePicker
                          value={schedule.time}
                          options={buildServiceTimeOptions(schedule.time)}
                          onChange={(value) => updateServiceSchedule(serviceId, 'time', value)}
                          triggerClassName="h-10 rounded-lg sm:h-8"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : shoot.serviceObjects && shoot.serviceObjects.length > 0 ? (
        <div className="space-y-1">
          {shoot.serviceObjects.map((serviceObject) => (
            <div key={serviceObject.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate">{serviceObject.name}</span>
                {getServiceCountBadge(serviceObject) && (
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                    {getServiceCountBadge(serviceObject)}
                  </span>
                )}
              </div>
              <span className="font-medium text-muted-foreground whitespace-nowrap">
                {getReadonlyServiceDisplayPrice(serviceObject)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {services.length > 0 ? (
            services.map((service, index) => (
              <Badge key={index} variant="outline" className="text-[10px] px-1.5 py-0.5">
                {formatServiceLabel(service)}
              </Badge>
            ))
          ) : (
            <div className="text-xs text-muted-foreground">No services</div>
          )}
        </div>
      )}
    </div>
  );
}
