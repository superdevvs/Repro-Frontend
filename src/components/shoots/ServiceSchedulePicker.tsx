import { useEffect, useMemo, useState } from 'react';
import { addMonths, format, setMonth, setYear, subMonths } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { TimeSelect } from '@/components/ui/time-select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type ServiceTimeOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type ServiceDatePickerProps = {
  value: string;
  minDate?: string;
  onChange: (value: string) => void;
  triggerClassName?: string;
  showIcon?: boolean;
};

type ServiceTimePickerProps = {
  value: string;
  options: ServiceTimeOption[];
  onChange: (value: string) => void;
  triggerClassName?: string;
  isTimeDisabled?: (value: string) => boolean;
  showIcon?: boolean;
};

export const buildServiceTimeOptions = (ensure?: string | null): ServiceTimeOption[] => {
  const options: ServiceTimeOption[] = [];

  for (let hour = 8; hour <= 19; hour += 1) {
    for (let minuteValue = 0; minuteValue < 60; minuteValue += 5) {
      if (hour === 19 && minuteValue !== 0) continue;
      const minute = String(minuteValue).padStart(2, '0');
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

const normalizeManualTime = (value: string): string | null => {
  const normalized = value.trim().replace(';', ':');
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  if (period === 'AM' && hour === 12) hour = 0;
  if (period === 'PM' && hour !== 12) hour += 12;
  if (hour < 0 || hour > 23) return null;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const parseInputDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatScheduleDateLabel = (value?: string) => {
  const date = parseInputDate(value);
  return date ? format(date, 'dd MMM yyyy') : 'Select date';
};

export function ServiceDatePicker({
  value,
  minDate,
  onChange,
  triggerClassName,
  showIcon = true,
}: ServiceDatePickerProps) {
  const selectedDate = parseInputDate(value);
  const minSelectable = parseInputDate(minDate);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
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

  const selectedLabel = formatScheduleDateLabel(value);
  const trigger = (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'h-9 w-full justify-start rounded-xl border-border/70 bg-background/80 px-3 text-left text-xs font-semibold',
        !value && 'text-muted-foreground',
        triggerClassName,
      )}
    >
      {showIcon ? <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
      <span className="truncate">{selectedLabel}</span>
    </Button>
  );

  const picker = (closeOnSelect: boolean) => (
    <>
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
            if (closeOnSelect) setOpen(false);
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
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="flex h-auto max-h-[76dvh] flex-col">
          <DrawerHeader className="pb-2 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle>Select Date</DrawerTitle>
                <DrawerDescription>Choose a service schedule date</DrawerDescription>
              </div>
              <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-blue-600 dark:bg-slate-800 dark:text-blue-400">
                {selectedLabel}
              </span>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            {picker(false)}
          </div>

          <DrawerFooter className="sticky bottom-0 z-10 shrink-0 border-t border-border/70 bg-background/95 pt-3 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button type="button" className="h-11 w-full" onClick={() => setOpen(false)}>
              Select
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="z-[180] w-[min(92vw,24rem)] max-w-none rounded-2xl border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur-md"
      >
        {picker(true)}
      </PopoverContent>
    </Popover>
  );
}

export function ServiceTimePicker({
  value,
  options,
  onChange,
  triggerClassName,
  isTimeDisabled,
  showIcon = true,
}: ServiceTimePickerProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const selectedLabel = options.find((option) => option.value === value)?.label || value || 'Select time';
  const pickerValue = value ? selectedLabel : '';
  const availableTimes = options
    .filter((option) => !option.disabled && !isTimeDisabled?.(option.value))
    .map((option) => option.label);
  const handleTimeChange = (nextValue: string) => {
    const normalized = normalizeManualTime(nextValue);
    if (!normalized) return;
    const option = options.find((item) => item.value === normalized);
    if (option?.disabled || isTimeDisabled?.(normalized)) return;
    onChange(normalized);
  };
  const trigger = (
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
  );
  const picker = (footerAction?: React.ReactNode) => (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-2">
      <TimeSelect
        value={pickerValue}
        onChange={handleTimeChange}
        startHour={8}
        endHour={19}
        interval={5}
        availableTimes={availableTimes}
        placeholder="Select time"
        footerAction={footerAction}
      />
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="flex h-auto max-h-[66vh] flex-col">
          <DrawerHeader className="pb-2 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle>Select Time</DrawerTitle>
                <DrawerDescription>Choose a service schedule time</DrawerDescription>
              </div>
              <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-blue-600 dark:bg-slate-800 dark:text-blue-400">
                {selectedLabel}
              </span>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            <div className="mb-3 rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Schedule Time
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{selectedLabel}</p>
            </div>
            {picker()}
          </div>

          <DrawerFooter className="sticky bottom-0 z-10 shrink-0 border-t border-border/70 bg-background/95 pt-3 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button type="button" className="h-11 w-full" onClick={() => setOpen(false)}>
              Select
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
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
        {picker(
          <Button type="button" size="sm" className="h-8 rounded-xl px-4" onClick={() => setOpen(false)}>
            Select
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
