import React, { useEffect, useMemo, useState } from 'react';
import { addMonths, format, isValid, parseISO, setMonth, setYear, subMonths } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type DateRangeValue = {
  startDate: string;
  endDate: string;
};

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  placeholder?: string;
  disabled?: boolean;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  triggerClassName?: string;
  contentClassName?: string;
  calendarClassName?: string;
}

const toFilterDate = (value: string) => {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
};

const toFilterValue = (date?: Date) => (date ? format(date, 'yyyy-MM-dd') : '');

const formatFilterDate = (value: string) => {
  const parsed = toFilterDate(value);
  return parsed ? format(parsed, 'dd-MM-yyyy') : 'dd-mm-yyyy';
};

const formatDateRangeLabel = ({ startDate, endDate }: DateRangeValue, placeholder: string) => {
  if (startDate && endDate) {
    return `${formatFilterDate(startDate)} - ${formatFilterDate(endDate)}`;
  }
  if (startDate) {
    return `${formatFilterDate(startDate)} - End date`;
  }
  return placeholder;
};

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Choose date range',
  disabled = false,
  align = 'center',
  sideOffset = 10,
  triggerClassName,
  contentClassName,
  calendarClassName,
}: DateRangePickerProps) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [calendarMonth, setCalendarMonth] = useState(() => toFilterDate(value.startDate) ?? new Date());
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index,
        label: format(new Date(currentYear, index, 1), 'MMMM'),
      })),
    [currentYear],
  );
  const yearOptions = useMemo(
    () => Array.from({ length: 9 }, (_, index) => currentYear - 5 + index),
    [currentYear],
  );

  useEffect(() => {
    const rangeStart = toFilterDate(value.startDate);
    if (rangeStart) {
      setCalendarMonth(rangeStart);
    }
  }, [value.startDate]);

  const selectedRange: DateRange | undefined = value.startDate
    ? {
        from: toFilterDate(value.startDate),
        to: toFilterDate(value.endDate) ?? toFilterDate(value.startDate),
      }
    : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-10 w-full justify-start text-left font-normal',
            !value.startDate && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{formatDateRangeLabel(value, placeholder)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[100] w-[min(92vw,26rem)] max-w-none rounded-2xl border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur-md',
          contentClassName,
        )}
      >
        <div className="mb-4 rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Browse Period
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {format(calendarMonth, 'MMMM yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl border-border/70 bg-background/80"
                onClick={() => setCalendarMonth((current) => subMonths(current, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl border-border/70 bg-background/80"
                onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Month
              </label>
              <Select
                value={String(calendarMonth.getMonth())}
                onValueChange={(selectedValue) =>
                  setCalendarMonth((current) => setMonth(current, Number(selectedValue)))
                }
              >
                <SelectTrigger className="h-10 rounded-xl border-border/70 bg-muted/30 px-3 text-sm font-medium text-foreground [&>svg]:-translate-x-[3px]">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent className="z-[140]">
                  <SelectGroup>
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={String(month.value)}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Year
              </label>
              <Select
                value={String(calendarMonth.getFullYear())}
                onValueChange={(selectedValue) =>
                  setCalendarMonth((current) => setYear(current, Number(selectedValue)))
                }
              >
                <SelectTrigger className="h-10 rounded-xl border-border/70 bg-muted/30 px-3 text-sm font-medium text-foreground [&>svg]:-translate-x-[3px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="z-[140]">
                  <SelectGroup>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Calendar
          mode="range"
          numberOfMonths={1}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          selected={selectedRange}
          onSelect={(range) => {
            onChange({
              startDate: toFilterValue(range?.from),
              endDate: toFilterValue(range?.to ?? range?.from),
            });
          }}
          className={cn('w-full p-0', calendarClassName)}
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
            day: 'h-10 w-10 rounded-xl p-0 font-medium transition-colors aria-selected:opacity-100',
            day_today: 'bg-muted text-foreground ring-1 ring-border/70',
            day_selected:
              'bg-primary text-primary-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_25px_rgba(37,99,235,0.25)] hover:bg-primary hover:text-primary-foreground',
            day_range_middle: 'bg-primary/12 text-foreground',
            day_outside: 'text-muted-foreground/35 opacity-100',
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
