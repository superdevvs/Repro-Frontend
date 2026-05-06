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
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_0.7fr_1.3fr]">
      <div className="p-2.5 border rounded-lg bg-card">
        {isEditMode ? (
          <div className="flex items-center">
            <ServiceDatePicker
              value={currentDateValue}
              onChange={(value) => updateField('scheduledDate', value)}
              triggerClassName="h-10 rounded-xl px-3 text-sm sm:h-8 sm:text-xs"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium text-foreground">{scheduleDateDisplay}</span>
          </div>
        )}
      </div>

      <div className="p-2.5 border rounded-lg bg-card">
        {isEditMode ? (
          <div className="flex items-center">
            <ServiceTimePicker
              value={currentTimeValue}
              options={buildServiceTimeOptions(currentTimeValue)}
              onChange={(value) => updateField('time', value)}
              triggerClassName="h-10 rounded-xl px-3 text-sm sm:h-8 sm:text-xs"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <ClockIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium text-foreground">{scheduleTimeDisplay || 'Not set'}</span>
          </div>
        )}
      </div>

      <div className="p-2.5 border rounded-lg bg-card">
        <div className="flex items-center gap-2">
          {weatherIcon}
          {hasWeatherDetails ? (
            <div className="flex items-center gap-1.5">
              {formattedTemperature && (
                <span className="text-sm font-medium text-foreground">{formattedTemperature}</span>
              )}
              {weatherDescription && (
                <span className="text-sm text-muted-foreground capitalize">{weatherDescription}</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No data</span>
          )}
        </div>
      </div>
    </div>
  );
}
