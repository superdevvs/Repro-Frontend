import { ReactNode, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon, ClockIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const currentDateValue = editedShoot.scheduledDate ?? formatDateForInput(shoot.scheduledDate);
  const parsedSelectedDate = currentDateValue ? parseISO(currentDateValue) : null;
  const selectedDate = parsedSelectedDate && isValid(parsedSelectedDate) ? parsedSelectedDate : undefined;
  const selectedDateLabel = selectedDate ? format(selectedDate, 'MM/dd/yyyy') : 'Select date';

  return (
    <div className="grid grid-cols-[1fr_0.7fr_1.3fr] gap-2">
      <div className="p-2.5 border rounded-lg bg-card">
        {isEditMode ? (
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 flex-1 justify-between bg-background px-3 text-xs font-normal hover:bg-background"
                >
                  <span className="truncate">{selectedDateLabel}</span>
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto border-border bg-popover p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (!date) return;
                    updateField('scheduledDate', format(date, 'yyyy-MM-dd'));
                    setIsDatePickerOpen(false);
                  }}
                  initialFocus
                  className="rounded-md bg-popover text-popover-foreground"
                />
              </PopoverContent>
            </Popover>
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
            <div className="relative flex-1">
              <Input
                type="time"
                value={editedShoot.time ?? shoot.time ?? ''}
                onChange={(e) => updateField('time', e.target.value)}
                className="h-7 pr-8 text-xs [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
              />
              <ClockIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
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
