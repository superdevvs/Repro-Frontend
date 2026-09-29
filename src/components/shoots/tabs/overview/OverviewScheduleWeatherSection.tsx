import { CalendarIcon, ClockIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { buildServiceTimeOptions, ServiceDatePicker, ServiceTimePicker } from '@/components/shoots/ServiceSchedulePicker';
import { ShootData } from '@/types/shoots';

type OverviewScheduleWeatherSectionProps = {
  isEditMode: boolean;
  editedShoot: Partial<ShootData>;
  shoot: ShootData;
  scheduleDateDisplay: string;
  scheduleTimeDisplay: string | null;
  hasWeatherDetails: boolean;
  formattedTemperature: string | null;
  weatherDescription: string | null;
  weatherIcon: ReactNode;
  /** Read-only alternate date line; null hides it. */
  alternateScheduleDisplay?: string | null;
  updateField: (field: string, value: unknown) => void;
};

/**
 * Shoot-level date/time (and weather). Restored so undated on-hold imports can
 * be given a schedule in overview Edit — per-service pickers alone were easy to
 * miss and did not update the order-level scheduled_at used by Resume.
 */
export function OverviewScheduleWeatherSection({
  isEditMode,
  editedShoot,
  shoot,
  scheduleDateDisplay,
  scheduleTimeDisplay,
  hasWeatherDetails,
  formattedTemperature,
  weatherDescription,
  weatherIcon,
  alternateScheduleDisplay,
  updateField,
}: OverviewScheduleWeatherSectionProps) {
  // Keep undated shoots empty in edit (Select date/time) instead of fabricating today.
  const currentDateValue =
    typeof editedShoot.scheduledDate === 'string'
      ? editedShoot.scheduledDate
      : (shoot.scheduledDate ?? '');
  const currentTimeValue = String(editedShoot.time ?? shoot.time ?? '');
  const needsSchedule = !currentDateValue;

  return (
    <div className="space-y-1.5" data-testid="overview-schedule-weather">
      {isEditMode && needsSchedule && (
        <p className="px-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          Date not assigned — set date and time before resuming this on-hold shoot.
        </p>
      )}
      <div
        className={
          isEditMode
            ? 'grid grid-cols-2 gap-1.5 max-[380px]:grid-cols-1 sm:gap-2 sm:grid-cols-[1fr_0.7fr_1.3fr]'
            : 'grid grid-cols-[1fr_0.78fr_1fr] gap-1.5 max-[380px]:grid-cols-1 sm:gap-2 sm:grid-cols-[1fr_0.7fr_1.3fr]'
        }
      >
        <div className="min-w-0 rounded-lg border bg-card p-2 sm:p-2.5">
          {isEditMode ? (
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Date</span>
              <ServiceDatePicker
                value={currentDateValue}
                onChange={(value) => updateField('scheduledDate', value)}
                triggerClassName="h-10 w-full min-w-0 rounded-xl px-3 text-sm sm:h-8 sm:text-xs"
              />
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span
                className={`truncate text-xs font-medium sm:text-sm ${
                  scheduleDateDisplay === 'Date not assigned' || scheduleDateDisplay === 'Not scheduled'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-foreground'
                }`}
              >
                {scheduleDateDisplay}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-lg border bg-card p-2 sm:p-2.5">
          {isEditMode ? (
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Time</span>
              <ServiceTimePicker
                value={currentTimeValue}
                options={buildServiceTimeOptions(currentTimeValue)}
                onChange={(value) => updateField('time', value)}
                triggerClassName="h-10 w-full min-w-0 rounded-xl px-3 text-sm sm:h-8 sm:text-xs"
              />
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
              <ClockIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span
                className={`truncate text-xs font-medium sm:text-sm ${
                  !scheduleTimeDisplay ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'
                }`}
              >
                {scheduleTimeDisplay || 'Awaiting confirmation'}
              </span>
            </div>
          )}
        </div>

        <div
          className={
            isEditMode
              ? 'hidden min-w-0 rounded-lg border bg-card p-2 sm:block sm:p-2.5'
              : 'min-w-0 rounded-lg border bg-card p-2 sm:p-2.5'
          }
        >
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            {weatherIcon}
            {hasWeatherDetails ? (
              <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
                {formattedTemperature && (
                  <span className="shrink-0 text-xs font-medium text-foreground sm:text-sm">
                    {formattedTemperature}
                  </span>
                )}
                {weatherDescription && (
                  <span className="truncate text-xs capitalize text-muted-foreground sm:text-sm">
                    {weatherDescription}
                  </span>
                )}
              </div>
            ) : (
              <span className="truncate text-xs text-muted-foreground sm:text-sm">No data</span>
            )}
          </div>
        </div>
      </div>

      {alternateScheduleDisplay && (
        <div className="flex items-center gap-1.5 px-0.5 text-xs text-muted-foreground sm:text-sm">
          <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-medium text-foreground">Alternate:</span>
          <span className="truncate">{alternateScheduleDisplay}</span>
        </div>
      )}
    </div>
  );
}
