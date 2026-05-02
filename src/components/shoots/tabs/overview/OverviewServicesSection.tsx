import { Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { buildServiceTimeOptions, ServiceDatePicker, ServiceTimePicker } from '@/components/shoots/ServiceSchedulePicker';
import { cn } from '@/lib/utils';
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
  return (
    <div className="p-2.5 border rounded-lg bg-card">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Services</span>
      {isEditMode ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">
              {selectedServiceIds.length ? `${selectedServiceIds.length} service${selectedServiceIds.length > 1 ? 's' : ''} selected` : 'None selected'}
            </p>
            <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  {selectedServiceIds.length ? 'Edit services' : 'Select services'}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-4xl w-[96vw] max-h-[85vh] p-0 overflow-hidden">
                <DialogHeader className="px-4 py-3 border-b">
                  <DialogTitle className="text-base">Select services</DialogTitle>
                  <DialogDescription className="text-xs">
                    Pick services for this shoot. Categories on left, services on right.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col sm:flex-row h-full sm:h-[60vh]">
                  <aside className="border-b sm:border-b-0 sm:border-r p-3 sm:w-48 flex-shrink-0 sm:overflow-y-auto sm:max-h-[60vh]">
                    <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-col sm:overflow-visible sm:pb-0 sm:space-y-1">
                      {serviceCategoryOptions.map((category) => {
                        const isActive = category.id === servicePanelCategory;
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => setServicePanelCategory(category.id)}
                            className={cn(
                              'rounded-lg border px-3 py-2 text-left transition-colors flex-shrink-0 text-xs',
                              isActive
                                ? 'border-primary/60 bg-primary/5 text-primary'
                                : 'border-transparent hover:bg-muted/40 text-muted-foreground',
                            )}
                          >
                            <p className="font-medium">{category.name}</p>
                            <p className="text-[10px] text-muted-foreground">{category.count} items</p>
                          </button>
                        );
                      })}
                    </div>
                  </aside>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh] sm:max-h-none">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search services..."
                        value={serviceModalSearch}
                        onChange={(event) => setServiceModalSearch(event.target.value)}
                        className="h-8 text-xs pl-8"
                      />
                    </div>
                    {panelServices.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-6">
                        No services in this category.
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {panelServices.map((service) => {
                          const isSelected = selectedServiceIds.includes(service.id);
                          const categoryBadgeName = getServiceCategoryBadgeName(service);
                          return (
                            <div
                              key={service.id}
                              className={cn(
                                'rounded-lg border p-3 cursor-pointer transition-all text-xs',
                                isSelected
                                  ? 'border-primary/60 bg-primary/5'
                                  : 'border-border hover:border-primary/40',
                              )}
                              onClick={() => toggleServiceSelection(service.id)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="font-medium">{service.name}</p>
                                  {service.pricing_type === 'variable' && (
                                    <p className="text-[10px] text-muted-foreground uppercase">Variable pricing</p>
                                  )}
                                </div>
                                <Checkbox checked={isSelected} onCheckedChange={() => toggleServiceSelection(service.id)} />
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="font-semibold">{getServiceDisplayPrice(service)}</span>
                                {categoryBadgeName && (
                                  <Badge variant="outline" className="text-[9px] uppercase">
                                    {categoryBadgeName}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter className="px-4 py-3 border-t gap-2">
                  <DialogClose asChild>
                    <Button size="sm" className="w-full sm:w-auto">Done</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {selectedServiceIds.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
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
                    className="border rounded-md p-2 bg-primary/5 border-primary/30"
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
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-medium text-muted-foreground">Schedule date</span>
                        <ServiceDatePicker
                          value={schedule.date}
                          onChange={(value) => updateServiceSchedule(serviceId, 'date', value)}
                          triggerClassName="h-8 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-medium text-muted-foreground">Schedule time</span>
                        <ServiceTimePicker
                          value={schedule.time}
                          options={buildServiceTimeOptions(schedule.time)}
                          onChange={(value) => updateServiceSchedule(serviceId, 'time', value)}
                          triggerClassName="h-8 rounded-lg"
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
