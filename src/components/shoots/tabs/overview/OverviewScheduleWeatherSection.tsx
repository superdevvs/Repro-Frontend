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
  formatDateForInput: (dateString?: string | null) => string;
  updateField: (field: string, value: unknown) => void;
};

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
  formatDateForInput,
  updateField,
}: OverviewScheduleWeatherSectionProps) {
  const currentDateValue = editedShoot.scheduledDate ?? formatDateForInput(shoot.scheduledDate);
  const currentTimeValue = String(editedShoot.time ?? shoot.time ?? '');

  return (
    <div className={isEditMode ? 'grid grid-cols-2 gap-1.5 sm:gap-2 sm:grid-cols-[1fr_0.7fr_1.3fr]' : 'grid grid-cols-[1fr_0.78fr_1fr] gap-1.5 sm:gap-2 sm:grid-cols-[1fr_0.7fr_1.3fr]'}>
      <div className="min-w-0 p-2 border rounded-lg bg-card sm:p-2.5">
        {isEditMode ? (
          <div className="flex items-center min-w-0">
            <ServiceDatePicker
              value={currentDateValue}
              onChange={(value) => updateField('scheduledDate', value)}
              triggerClassName="h-10 w-full min-w-0 rounded-xl px-3 text-sm sm:h-8 sm:text-xs"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1 min-w-0 sm:gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate text-xs font-medium text-foreground sm:text-sm">{scheduleDateDisplay}</span>
          </div>
        )}
      </div>

      <div className="min-w-0 p-2 border rounded-lg bg-card sm:p-2.5">
        {isEditMode ? (
          <div className="flex items-center min-w-0">
            <ServiceTimePicker
              value={currentTimeValue}
              options={buildServiceTimeOptions(currentTimeValue)}
              onChange={(value) => updateField('time', value)}
              triggerClassName="h-10 w-full min-w-0 rounded-xl px-3 text-sm sm:h-8 sm:text-xs"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1 min-w-0 sm:gap-1.5">
            <ClockIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate text-xs font-medium text-foreground sm:text-sm">{scheduleTimeDisplay || 'Not set'}</span>
          </div>
        )}
      </div>

      <div className={isEditMode ? 'hidden min-w-0 p-2 border rounded-lg bg-card sm:block sm:p-2.5' : 'min-w-0 p-2 border rounded-lg bg-card sm:p-2.5'}>
        <div className="flex items-center gap-1 min-w-0 sm:gap-2">
          {weatherIcon}
          {hasWeatherDetails ? (
            <div className="flex items-center gap-1 min-w-0 sm:gap-1.5">
              {formattedTemperature && (
                <span className="shrink-0 text-xs font-medium text-foreground sm:text-sm">{formattedTemperature}</span>
              )}
              {weatherDescription && (
                <span className="truncate text-xs text-muted-foreground capitalize sm:text-sm">{weatherDescription}</span>
              )}
            </div>
          ) : (
            <span className="truncate text-xs text-muted-foreground sm:text-sm">No data</span>
          )}
        </div>
      </div>
    </div>
  );
}
