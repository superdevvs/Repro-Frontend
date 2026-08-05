import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { TimeSelect } from '@/components/ui/time-select';
import { format } from 'date-fns';
import { AlertTriangle, ArrowRight, ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { SchedulingPhotographerSection } from './SchedulingPhotographerSection';
import type { SchedulingFormController } from './useSchedulingFormController';

export function SchedulingFormView({ controller }: { controller: SchedulingFormController }) {
  const {
    date, time, formErrors, handleSubmit, goBack, sameDayAddressWarningMessage,
    disabledDates, today, isMobile, timeDialogOpen, tempTime, availabilityPanel,
    suggestedTimesRailRef, canScrollSuggestedTimesLeft, canScrollSuggestedTimesRight,
    calendarMonth, setCalendarMonth, calendarAvailability, calendarAvailableDays,
    calendarUnavailableDays, onDateChange, onTimeChange, handleTimeDialogOpen,
    handleTimeConfirm, handleQuickTimeSelect, photographer,
    isPhotographerTimeDisabled, availableTimesForSelectedPhotographer, suggestedTimes,
    updateSuggestedTimesScrollState, scrollSuggestedTimesBy,
  } = controller;
  return (
    <div className="space-y-5 sm:space-y-6 text-slate-900 dark:text-slate-100">
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-card/40 rounded-2xl p-3 sm:p-6 space-y-3 sm:space-y-4 border border-slate-200 dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Select Date</h2>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {date ? format(date, "MMMM d, yyyy") : "Choose a date"}
            </span>
          </div>
          <div className="rounded-lg border border-gray-100 dark:border-muted/40 bg-gray-50 dark:bg-card/40 p-2.5 sm:p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={onDateChange}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              disabled={disabledDates}
              defaultMonth={date ?? today}
              fromMonth={today}
              modifiers={{
                available: calendarAvailableDays,
                unavailable: calendarUnavailableDays,
              }}
              modifiersClassNames={{
                available: "after:absolute after:bottom-0.5 after:left-1/2 after:h-px after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-emerald-400",
                unavailable: "after:absolute after:bottom-0.5 after:left-1/2 after:h-px after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-amber-400",
              }}
              className="border-none bg-transparent p-0 pointer-events-auto"
              classNames={{
                caption: "relative flex items-center justify-center",
                caption_label: "text-base font-semibold",
                nav: "absolute inset-y-0 w-full flex items-center justify-between",
                nav_button: "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100",
                nav_button_previous: "static",
                nav_button_next: "static",
                head_cell: "text-slate-500 rounded-md w-full font-medium text-xs sm:text-sm flex-1 text-center",
                day: "relative h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-xl text-sm sm:text-base font-medium aria-selected:opacity-100",
                day_selected: "bg-primary text-primary-foreground rounded-xl",
                day_today: "bg-accent text-accent-foreground rounded-xl",
                cell: "relative p-0 text-center text-sm sm:text-base focus-within:relative focus-within:z-20 [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md flex-1",
              }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-px w-4 rounded-full bg-emerald-400" />
                Availability
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-px w-4 rounded-full bg-amber-400" />
                No availability
              </span>
              {calendarAvailability.loading && <span>Checking dates...</span>}
            </div>
          </div>
          {formErrors['date'] && (
            <p className="text-sm font-medium text-destructive mt-1">{formErrors['date']}</p>
          )}
        </div>
        {sameDayAddressWarningMessage && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 shadow-sm dark:text-amber-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600 dark:text-amber-300" />
              <p className="leading-5">{sameDayAddressWarningMessage}</p>
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-card/40 rounded-2xl p-3 sm:p-6 space-y-3 sm:space-y-4 border border-slate-200 dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Time</h2>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {time || "Select a time"}
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Suggested times
            </p>
            {availabilityPanel?.kind === 'loading' ? (
              // Distinct loading state while a request is in flight (Req 5.3).
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-muted/40 dark:bg-card/30 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking availability...
              </div>
            ) : availabilityPanel?.kind === 'error' ? (
              // Explicit error state for genuine non-abort failures — NOT the
              // "no availability" panel (Req 6.3).
              <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{availabilityPanel.message}</span>
              </div>
            ) : availabilityPanel?.kind === 'not-configured' ? (
              // Neither configured hours nor a fallback window apply (Req 5.2).
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-muted/40 dark:bg-card/30 dark:text-slate-400">
                Availability not configured for this photographer on the selected day. Choose another photographer or date.
              </div>
            ) : availabilityPanel?.kind === 'empty' ? (
              // Fetched successfully but zero bookable slots that day (Req 5.4).
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-muted/40 dark:bg-card/30 dark:text-slate-400">
                No bookable times available for the selected day. Choose another photographer or date.
              </div>
            ) : suggestedTimes.length > 0 ? (
              <div className="relative overflow-hidden bg-white dark:bg-card/40">
                <div
                  ref={suggestedTimesRailRef}
                  className="flex gap-2 overflow-x-auto overflow-y-hidden py-1 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  onScroll={updateSuggestedTimesScrollState}
                >
                  {suggestedTimes.map((slot) => {
                    const disabled = isPhotographerTimeDisabled(photographer, slot);
                    return (
                      <Button
                        key={slot}
                        type="button"
                        variant={time === slot ? "default" : "outline"}
                        disabled={disabled}
                        data-suggested-time={slot}
                        onClick={() => handleQuickTimeSelect(slot)}
                        className={cn(
                          "h-11 min-w-[104px] shrink-0 rounded-xl border px-4 text-sm font-semibold shadow-sm transition-all",
                          time === slot
                            ? "border-blue-500 bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700"
                            : "border-gray-200 bg-gray-50 text-slate-900 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-muted/40 dark:bg-card/60 dark:text-slate-100 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
                        )}
                      >
                        {slot}
                      </Button>
                    );
                  })}
                </div>
                <div
                  className={cn(
                    "pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white from-0% via-white via-70% to-transparent dark:from-[#090e13] dark:from-0% dark:via-[#090e13] dark:via-70% dark:to-transparent",
                    !canScrollSuggestedTimesLeft && "opacity-0"
                  )}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white from-0% via-white via-70% to-transparent dark:from-[#090e13] dark:from-0% dark:via-[#090e13] dark:via-70% dark:to-transparent",
                    !canScrollSuggestedTimesRight && "opacity-0"
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Scroll suggested times left"
                  disabled={!canScrollSuggestedTimesLeft}
                  onClick={() => scrollSuggestedTimesBy('left')}
                  className={cn(
                    "absolute left-0 top-1/2 z-20 h-8 w-8 -translate-y-1/2 rounded-full border-slate-200 bg-white/95 text-slate-700 shadow-md hover:bg-white dark:border-slate-700 dark:bg-[#090e13] dark:text-slate-100 dark:hover:bg-[#090e13]",
                    !canScrollSuggestedTimesLeft && "pointer-events-none opacity-0"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Scroll suggested times right"
                  disabled={!canScrollSuggestedTimesRight}
                  onClick={() => scrollSuggestedTimesBy('right')}
                  className={cn(
                    "absolute right-0 top-1/2 z-20 h-8 w-8 -translate-y-1/2 rounded-full border-slate-200 bg-white/95 text-slate-700 shadow-md hover:bg-white dark:border-slate-700 dark:bg-[#090e13] dark:text-slate-100 dark:hover:bg-[#090e13]",
                    !canScrollSuggestedTimesRight && "pointer-events-none opacity-0"
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-muted/40 dark:bg-card/30 dark:text-slate-400">
                No matching suggested times for the selected photographer. Use the picker below or choose another photographer/date.
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-center gap-2 dark:border-muted/40 dark:bg-card/60 dark:text-slate-100 dark:hover:bg-card/70"
            onClick={() => handleTimeDialogOpen(true)}
            disabled={!date}
          >
            <Clock className="h-4 w-4" />
            Choose manually
          </Button>
          {isMobile ? (
            <Drawer open={timeDialogOpen} onOpenChange={handleTimeDialogOpen}>
              <DrawerContent className="flex h-auto max-h-[66vh] flex-col">
                <DrawerHeader className="pb-2 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <DrawerTitle>Select Time</DrawerTitle>
                      <DrawerDescription>Choose a time for the shoot</DrawerDescription>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-blue-600 dark:bg-slate-800 dark:text-blue-400">
                      {tempTime || time || 'Select'}
                    </span>
                  </div>
                </DrawerHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
                  <TimeSelect
                    value={tempTime || time}
                    onChange={onTimeChange}
                    startHour={8}
                    endHour={20}
                    interval={5}
                    availableTimes={availableTimesForSelectedPhotographer}
                    placeholder="Select a time"
                    className="w-full"
                  />
                </div>
                <DrawerFooter className="sticky bottom-0 z-10 shrink-0 border-t border-border/70 bg-background/95 pt-3 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
                  <Button type="button" className="h-11 w-full" onClick={handleTimeConfirm}>
                    OK
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={timeDialogOpen} onOpenChange={handleTimeDialogOpen}>
              <DialogContent className="sm:max-w-md w-full">
                <DialogHeader>
                  <div className="flex items-start justify-between gap-3 pr-8">
                    <div>
                      <DialogTitle>Select Time</DialogTitle>
                      <DialogDescription>
                        Choose a time for the shoot
                      </DialogDescription>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-blue-600 dark:bg-slate-800 dark:text-blue-400">
                      {tempTime || time || 'Select'}
                    </span>
                  </div>
                </DialogHeader>
                <div className="mt-4 w-full flex justify-center">
                  <TimeSelect
                    value={tempTime || time}
                    onChange={onTimeChange}
                    startHour={8}
                    endHour={20}
                    interval={5}
                    availableTimes={availableTimesForSelectedPhotographer}
                    placeholder="Select a time"
                    className="w-full"
                  />
                </div>
                <DialogFooter className="mt-4">
                  <Button type="button" className="w-full" onClick={handleTimeConfirm}>
                    OK
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {formErrors['time'] && (
            <p className="text-sm font-medium text-destructive mt-1">{formErrors['time']}</p>
          )}
        </div>
        <SchedulingPhotographerSection controller={controller} />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          className="h-14 min-w-[150px] border-slate-200 bg-white text-base font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-muted/40 dark:bg-card/60 dark:text-slate-300 dark:hover:bg-card/80 dark:hover:text-white"
        >
          <ChevronLeft className="mr-2 h-5 w-5" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          className="h-14 flex-1 text-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          CONFIRM
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

