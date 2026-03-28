import { ReactNode } from 'react';
import { CalendarIcon, ClockIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  return (
    <div className="grid grid-cols-[1fr_0.7fr_1.3fr] gap-2">
      <div className="p-2.5 border rounded-lg bg-card">
        {isEditMode ? (
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <Input
              type="date"
              value={editedShoot.scheduledDate || formatDateForInput(shoot.scheduledDate)}
              onChange={(e) => updateField('scheduledDate', e.target.value)}
              className="h-7 text-xs [&::-webkit-calendar-picker-indicator]:opacity-100"
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
          <div className="flex items-center gap-1.5">
            <ClockIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <Input
              type="time"
              value={editedShoot.time ?? shoot.time ?? ''}
              onChange={(e) => updateField('time', e.target.value)}
              className="h-7 text-xs"
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
