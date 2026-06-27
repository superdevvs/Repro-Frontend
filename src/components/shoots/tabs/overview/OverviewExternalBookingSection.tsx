import React, { forwardRef, useMemo } from 'react';
import { AlertTriangle, CalendarClock, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ShootData } from '@/types/shoots';

type ExternalBookingMappingStatus =
  | 'fully_mapped'
  | 'partially_mapped'
  | 'needs_review'
  | string;

type OverviewExternalBookingSectionProps = {
  shoot: ShootData;
  formatDate: (dateString?: string | null) => string;
  formatTime: (timeString?: string | null) => string;
  /**
   * Best-effort lookup of photographer id -> display name. Built from the
   * resolved per-service photographers already loaded by the modal. When an id
   * is missing from the map the panel falls back to a "Photographer #<id>"
   * label.
   */
  resolvePhotographerName?: (id: string | number) => string | null;
};

const TIME_NOT_SPECIFIED = 'time not specified';

const STATUS_LABELS: Record<string, string> = {
  fully_mapped: 'Fully mapped',
  partially_mapped: 'Partially mapped',
  needs_review: 'Needs review',
};

const getStatusVariant = (
  status: ExternalBookingMappingStatus | null | undefined,
): React.ComponentProps<typeof Badge>['variant'] => {
  switch (status) {
    case 'fully_mapped':
      return 'default';
    case 'partially_mapped':
      return 'secondary';
    case 'needs_review':
      return 'destructive';
    default:
      return 'outline';
  }
};

const getStatusLabel = (status: ExternalBookingMappingStatus | null | undefined) => {
  if (!status) return null;
  return (
    STATUS_LABELS[status] ||
    status
      .split('_')
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join(' ')
  );
};

const toIsoTime = (value?: string | null) => {
  if (!value) return null;
  // `scheduled_at` is a datetime; extract the HH:mm portion when present so the
  // shared time formatter renders it consistently with the rest of the modal.
  const match = String(value).match(/[T\s](\d{2}:\d{2})/);
  return match ? match[1] : null;
};

export const OverviewExternalBookingSection = forwardRef<
  HTMLDivElement,
  OverviewExternalBookingSectionProps
>(function OverviewExternalBookingSection(
  { shoot, formatDate, formatTime, resolvePhotographerName },
  ref,
) {
  const warnings = useMemo(() => {
    const raw = shoot.external_booking_warnings;
    if (!Array.isArray(raw)) return [] as string[];
    return raw.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  }, [shoot.external_booking_warnings]);

  const requestedPhotographers = useMemo(() => {
    const raw = shoot.requested_photographers;
    if (!Array.isArray(raw)) return [] as string[];
    return raw
      .map((entry) => {
        if (entry == null) return null;
        if (typeof entry === 'number' || typeof entry === 'string') {
          const resolved = resolvePhotographerName?.(entry);
          return resolved || `Photographer #${entry}`;
        }
        if (typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          const id = record.id ?? record.photographer_id ?? record.user_id;
          const name =
            (typeof record.name === 'string' && record.name) ||
            (typeof record.full_name === 'string' && record.full_name) ||
            (typeof record.display_name === 'string' && record.display_name) ||
            (id != null ? resolvePhotographerName?.(id as string | number) : null);
          if (name) return name;
          return id != null ? `Photographer #${id}` : null;
        }
        return null;
      })
      .filter((value): value is string => Boolean(value));
  }, [shoot.requested_photographers, resolvePhotographerName]);

  const mappedServices = useMemo(() => {
    const services = Array.isArray(shoot.serviceObjects) ? shoot.serviceObjects : [];
    return services.map((service) => {
      const photographerName = service.photographer?.name || null;
      const scheduledAt = service.scheduled_at ?? service.scheduledAt ?? null;
      return {
        id: service.id,
        name: service.name || 'Service',
        photographerName,
        scheduledDate: scheduledAt ? formatDate(scheduledAt) : null,
        scheduledTime: toIsoTime(scheduledAt) ? formatTime(toIsoTime(scheduledAt)) : null,
      };
    });
  }, [shoot.serviceObjects, formatDate, formatTime]);

  const status = shoot.external_booking_mapping_status ?? null;
  const statusLabel = getStatusLabel(status);

  // Preferred schedule comes from the shoot-level fields; alternate from the
  // dedicated external-booking columns.
  const preferredDate = shoot.scheduledDate || (shoot as unknown as { scheduled_date?: string }).scheduled_date || null;
  const preferredTime = shoot.time || null;
  const alternateDate = shoot.alternate_scheduled_date || null;
  const alternateTime = shoot.alternate_time || null;

  const renderSchedule = (date?: string | null, time?: string | null) => {
    if (!date) {
      return <span className="text-muted-foreground">Not provided</span>;
    }
    return (
      <span className="font-medium text-right">
        {formatDate(date)}
        {' · '}
        {time ? (
          formatTime(time)
        ) : (
          <span className="italic text-muted-foreground">{TIME_NOT_SPECIFIED}</span>
        )}
      </span>
    );
  };

  return (
    <div
      ref={ref}
      data-section="external-booking-mapping"
      className="p-2.5 border rounded-lg bg-card scroll-mt-4"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase truncate">
            External Booking Mapping
          </span>
        </div>
        {statusLabel && (
          <Badge variant={getStatusVariant(status)} className="text-[10px]">
            {statusLabel}
          </Badge>
        )}
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between items-start gap-2">
          <span className="text-muted-foreground">Preferred:</span>
          {renderSchedule(preferredDate, preferredTime)}
        </div>
        <div className="flex justify-between items-start gap-2">
          <span className="text-muted-foreground">Alternate:</span>
          {renderSchedule(alternateDate, alternateTime)}
        </div>
      </div>

      {mappedServices.length > 0 && (
        <>
          <Separator className="my-2" />
          <div className="flex items-center gap-1.5 mb-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">
              Auto-mapped services
            </span>
          </div>
          <div className="space-y-1.5">
            {mappedServices.map((service) => (
              <div
                key={service.id}
                className="rounded-md border bg-background/60 px-2 py-1.5 text-xs"
              >
                <div className="font-medium">{service.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
                  <span>
                    Photographer:{' '}
                    <span className="text-foreground">
                      {service.photographerName || 'Unassigned'}
                    </span>
                  </span>
                  <span>
                    Schedule:{' '}
                    <span className="text-foreground">
                      {service.scheduledDate ? (
                        <>
                          {service.scheduledDate}
                          {' · '}
                          {service.scheduledTime ?? (
                            <span className="italic">{TIME_NOT_SPECIFIED}</span>
                          )}
                        </>
                      ) : (
                        'Not scheduled'
                      )}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {requestedPhotographers.length > 0 && (
        <>
          <Separator className="my-2" />
          <div className="text-xs">
            <span className="text-muted-foreground">Requested photographers: </span>
            <span className="font-medium">{requestedPhotographers.join(', ')}</span>
          </div>
        </>
      )}

      {warnings.length > 0 && (
        <>
          <Separator className="my-2" />
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase">
              Warnings
            </span>
          </div>
          <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300 list-disc pl-4">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
});
