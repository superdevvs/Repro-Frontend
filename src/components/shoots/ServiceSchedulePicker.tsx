import { useEffect, useMemo, useState } from 'react';
import { addMonths, format, setMonth, setYear, subMonths } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type ServiceTimeOption = {
  value: string;
  label: string;
};

type ServiceDatePickerProps = {
  value: string;
  minDate?: string;
  onChange: (value: string) => void;
  triggerClassName?: string;
};

type ServiceTimePickerProps = {
  value: string;
  options: ServiceTimeOption[];
  onChange: (value: string) => void;
  triggerClassName?: string;
};

export const buildServiceTimeOptions = (ensure?: string | null): ServiceTimeOption[] => {
  const options: ServiceTimeOption[] = [];

  for (let hour = 5; hour < 23; hour += 1) {
    for (const minute of ['00', '30']) {
      const value = `${hour.toString().padStart(2, '0')}:${minute}`;
      const hour12 = hour % 12 || 12;
      const period = hour >= 12 ? 'PM' : 'AM';
      options.push({ value, label: `${hour12}:${minute} ${period}` });
    }
  }

  if (ensure && !options.some((option) => option.value === ensure)) {
    const [hourPart, minutePart = '00'] = ensure.split(':');
    const hour = Number(hourPart);
    if (!Number.isNaN(hour)) {
      const hour12 = hour % 12 || 12;
      const period = hour >= 12 ? 'PM' : 'AM';
      options.push({ value: ensure, label: `${hour12}:${minutePart} ${period}` });
      options.sort((first, second) => first.value.localeCompare(second.value));
    }
  }

  return options;
};

const parseInputDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatScheduleDateLabel = (value?: string) => {
  const date = parseInputDate(value);
  return date ? format(date, 'dd-MM-yyyy') : 'Select date';
};

export function ServiceDatePicker({
  value,
  minDate,
  onChange,
  triggerClassName,
}: ServiceDatePickerProps) {
  const selectedDate = parseInputDate(value);
  const minSelectable = parseInputDate(minDate);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [open, setOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => selectedDate ?? minSelectable ?? new Date());
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index,
        label: format(new Date(currentYear, index, 1), 'MMMM'),
      })),
    [currentYear],
  );
  const yearOptions = useMemo(() => {
    const selectedYear = selectedDate?.getFullYear() ?? currentYear;
    const firstYear = Math.min(currentYear - 2, selectedYear - 2);
    return Array.from({ length: 8 }, (_, index) => firstYear + index);
  }, [currentYear, selectedDate]);

  useEffect(() => {
    const nextDate = parseInputDate(value);
    if (nextDate) {
      setCalendarMonth(nextDate);
    }
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-9 w-full justify-start rounded-xl border-border/70 bg-background/80 px-3 text-left text-xs font-semibold',
            !value && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatScheduleDateLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="z-[180] w-[min(92vw,24rem)] max-w-none rounded-2xl border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur-md"
      >
        <div className="mb-4 rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Schedule Date
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {format(calendarMonth, 'MMMM yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl border-border/70 bg-background/80"
                onClick={() => setCalendarMonth((current) => subMonths(current, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl border-border/70 bg-background/80"
                onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Month
              </Label>
              <Select
                value={String(calendarMonth.getMonth())}
                onValueChange={(selectedValue) =>
                  setCalendarMonth((current) => setMonth(current, Number(selectedValue)))
                }
              >
                <SelectTrigger className="h-9 rounded-xl border-border/70 bg-muted/30 px-3 text-xs font-medium">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent className="z-[190]">
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Year
              </Label>
              <Select
                value={String(calendarMonth.getFullYear())}
                onValueChange={(selectedValue) =>
                  setCalendarMonth((current) => setYear(current, Number(selectedValue)))
                }
              >
                <SelectTrigger className="h-9 rounded-xl border-border/70 bg-muted/30 px-3 text-xs font-medium">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="z-[190]">
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Calendar
          mode="single"
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          selected={selectedDate}
          disabled={(date) => {
            if (!minSelectable) return false;
            return date < new Date(minSelectable.getFullYear(), minSelectable.getMonth(), minSelectable.getDate());
          }}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, 'yyyy-MM-dd'));
            setOpen(false);
          }}
          className="w-full p-0"
          classNames={{
            months: 'w-full',
            month: 'w-full space-y-2',
            caption: 'hidden',
            nav: 'hidden',
            table: 'w-full border-collapse',
            head_row: 'flex w-full justify-between',
            head_cell: 'text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground',
            row: 'mt-1.5 flex w-full justify-between',
            cell: 'relative flex-1 p-0 text-center text-sm focus-within:relative focus-within:z-20',
            day: 'h-9 w-9 rounded-xl p-0 font-medium transition-colors aria-selected:opacity-100',
            day_today: 'bg-muted text-foreground ring-1 ring-border/70',
            day_selected: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground',
            day_outside: 'text-muted-foreground/35 opacity-100',
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function ServiceTimePicker({
  value,
  options,
  onChange,
  triggerClassName,
}: ServiceTimePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label || value || 'Select time';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-9 w-full justify-start rounded-xl border-border/70 bg-background/80 px-3 text-left text-xs font-semibold',
            triggerClassName,
          )}
        >
          <Clock className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{selectedLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="z-[180] w-[min(82vw,16rem)] rounded-2xl border-border/80 bg-background/95 p-3 shadow-2xl backdrop-blur-md"
      >
        <div className="mb-3 rounded-xl border border-border/70 bg-muted/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Schedule Time
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{selectedLabel}</p>
        </div>
        <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                'rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors',
                option.value === value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/40 text-foreground hover:bg-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
