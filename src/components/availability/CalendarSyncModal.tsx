import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays, startOfDay, endOfDay, isAfter, isBefore } from "date-fns";
import { CalendarIcon, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  downloadICS,
  generateGoogleCalendarURL,
  generateOutlookCalendarURL,
} from "@/utils/icsGenerator";
import { Separator } from "@/components/ui/separator";

type CalendarType = "google" | "apple" | "outlook" | null;
type DateRangeOption = "30days" | "90days" | "custom";

interface AvailabilitySlot {
  id: number;
  photographer_id: number;
  date?: string | null;
  day_of_week?: string | null;
  start_time: string;
  end_time: string;
  status?: string;
}

interface CalendarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  availabilitySlots: AvailabilitySlot[];
  photographerName?: string;
}

// Calendar Icons
const GoogleCalendarIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
    <path d="M7 12h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
  </svg>
);

const AppleCalendarIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
  </svg>
);

const OutlookCalendarIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.5 3C9.43 3 11 4.57 11 6.5V11h5.5C18.43 11 20 12.57 20 14.5v5c0 1.93-1.57 3.5-3.5 3.5h-9C5.57 23 4 21.43 4 19.5v-13C4 4.57 5.57 3 7.5 3zm0 2C6.67 5 6 5.67 6 6.5v13c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5H11v-4.5C11 5.67 10.33 5 9.5 5h-2z"/>
  </svg>
);

export function CalendarSyncModal({
  isOpen,
  onClose,
  availabilitySlots,
  photographerName = "Your",
}: CalendarSyncModalProps) {
  const { toast } = useToast();
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>("30days");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(() => addDays(new Date(), 30));
  const [selectedCalendar, setSelectedCalendar] = useState<CalendarType>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [lastSyncedInfo, setLastSyncedInfo] = useState<{
    calendar: CalendarType;
    dateRange: string;
  } | null>(null);

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const today = startOfDay(new Date());
    let start: Date;
    let end: Date;

    if (dateRangeOption === "30days") {
      start = today;
      end = endOfDay(addDays(today, 30));
    } else if (dateRangeOption === "90days") {
      start = today;
      end = endOfDay(addDays(today, 90));
    } else {
      // custom
      start = customStartDate ? startOfDay(customStartDate) : today;
      end = customEndDate ? endOfDay(customEndDate) : endOfDay(addDays(today, 30));
    }

    return { start, end };
  }, [dateRangeOption, customStartDate, customEndDate]);

  // Filter availability slots by date range
  const filteredSlots = useMemo(() => {
    if (!availabilitySlots || availabilitySlots.length === 0) return [];

    return availabilitySlots.filter((slot) => {
      // Handle specific date slots
      if (slot.date) {
        const slotDate = new Date(slot.date);
        return (
          (isAfter(slotDate, dateRange.start) || slotDate.getTime() === dateRange.start.getTime()) &&
          (isBefore(slotDate, dateRange.end) || slotDate.getTime() === dateRange.end.getTime())
        );
      }

      // Handle weekly recurring slots - we'll include them if they fall within the range
      // For simplicity, we'll include all weekly slots
      if (slot.day_of_week) {
        return true; // Weekly slots apply to all dates in range
      }

      return false;
    });
  }, [availabilitySlots, dateRange]);

  // Generate calendar events from slots
  const calendarEvents = useMemo(() => {
    const events: Array<{
      title: string;
      description?: string;
      start: Date;
      end: Date;
      location?: string;
    }> = [];

    filteredSlots.forEach((slot) => {
      if (slot.status === "unavailable" || slot.status === "booked") {
        return; // Only sync available slots
      }

      let eventDate: Date;
      if (slot.date) {
        eventDate = new Date(slot.date);
      } else {
        // For weekly slots, use the start of the range as a placeholder
        // In a real implementation, you'd generate events for each occurrence
        eventDate = dateRange.start;
      }

      const [startHour, startMinute] = slot.start_time.split(":").map(Number);
      const [endHour, endMinute] = slot.end_time.split(":").map(Number);

      const start = new Date(eventDate);
      start.setHours(startHour, startMinute, 0, 0);

      const end = new Date(eventDate);
      end.setHours(endHour, endMinute, 0, 0);

      events.push({
        title: `${photographerName} Availability`,
        description: `Available for booking from ${slot.start_time} to ${slot.end_time}`,
        start,
        end,
      });
    });

    return events;
  }, [filteredSlots, photographerName, dateRange.start]);

  const eventCount = calendarEvents.length;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSyncSuccess(false);
      setSelectedCalendar(null);
    }
  }, [isOpen]);

  const handleSync = async () => {
    if (!selectedCalendar) {
      toast({
        title: "Please select a calendar",
        description: "Choose Google, Apple, or Outlook calendar to sync with.",
        variant: "destructive",
      });
      return;
    }

    if (eventCount === 0) {
      toast({
        title: "No availability found",
        description: "No availability found in this date range. Try expanding the range.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);

    try {
      if (selectedCalendar === "google") {
        // For Google, try to open the first event in Google Calendar
        // If multiple events, we'll download ICS as fallback
        if (calendarEvents.length === 1) {
          const url = generateGoogleCalendarURL(calendarEvents[0]);
          window.open(url, "_blank");
          
          toast({
            title: "Google Calendar opened",
            description: "If it didn't open, download the .ics file instead.",
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadICS(calendarEvents, "availability.ics");
                }}
              >
                Download .ics
              </Button>
            ),
          });
        } else {
          // Multiple events - download ICS file
          downloadICS(calendarEvents, "availability.ics");
          toast({
            title: "Calendar file downloaded",
            description: "Open the downloaded file to add events to Google Calendar.",
          });
        }
      } else if (selectedCalendar === "apple") {
        // Apple Calendar - always download ICS
        downloadICS(calendarEvents, "availability.ics");
        toast({
          title: "Calendar file downloaded",
          description: "Open the downloaded file to add it to Apple Calendar.",
        });
      } else if (selectedCalendar === "outlook") {
        // Try Outlook web link first
        if (calendarEvents.length === 1) {
          try {
            const url = generateOutlookCalendarURL(calendarEvents[0]);
            window.open(url, "_blank");
            toast({
              title: "Outlook opened",
              description: "If Outlook didn't open automatically, open the downloaded file.",
              action: (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    downloadICS(calendarEvents, "availability.ics");
                  }}
                >
                  Download .ics
                </Button>
              ),
            });
          } catch {
            downloadICS(calendarEvents, "availability.ics");
            toast({
              title: "Calendar file downloaded",
              description: "Open the downloaded file to add events to Outlook.",
            });
          }
        } else {
          downloadICS(calendarEvents, "availability.ics");
          toast({
            title: "Calendar file downloaded",
            description: "If Outlook didn't open automatically, open the downloaded file.",
          });
        }
      }

      setSyncSuccess(true);
      setLastSyncedInfo({
        calendar: selectedCalendar,
        dateRange: `${format(dateRange.start, "MMM d, yyyy")} - ${format(dateRange.end, "MMM d, yyyy")}`,
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Something went wrong while preparing your calendar file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const calendarName = selectedCalendar === "google" ? "Google Calendar" : 
                       selectedCalendar === "apple" ? "Apple Calendar" : 
                       selectedCalendar === "outlook" ? "Outlook" : "";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync your availability</DialogTitle>
          <DialogDescription>
            Sync your availability to Google, Apple or Outlook calendars.
          </DialogDescription>
        </DialogHeader>

        {syncSuccess && lastSyncedInfo && (
          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <Check className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Sync started
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                We've sent your availability to {calendarName} for {lastSyncedInfo.dateRange}.
              </p>
            </div>
          </div>
        )}

        {eventCount === 0 && dateRangeOption === "custom" && (
          <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              No availability found in this date range. Try expanding the range.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {/* Section 1: What to sync */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Choose what you want to sync</Label>
            <RadioGroup
              value={dateRangeOption}
              onValueChange={(value) => setDateRangeOption(value as DateRangeOption)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="30days" id="30days" />
                <Label htmlFor="30days" className="font-normal cursor-pointer">
                  Upcoming 30 days <span className="text-muted-foreground">(recommended)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="90days" id="90days" />
                <Label htmlFor="90days" className="font-normal cursor-pointer">
                  Upcoming 90 days
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal cursor-pointer">
                  Custom date range
                </Label>
              </div>
            </RadioGroup>

            {dateRangeOption === "custom" && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !customStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !customEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground pt-2">
              You're syncing: <span className="font-medium text-foreground">{eventCount} events</span> from{" "}
              {format(dateRange.start, "MMM d, yyyy")} to {format(dateRange.end, "MMM d, yyyy")}
            </div>
          </div>

          <Separator />

          {/* Section 2: Where to sync */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Choose your calendar</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSelectedCalendar("google")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                  selectedCalendar === "google"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <GoogleCalendarIcon />
                <span className="text-sm font-medium">Google Calendar</span>
                {selectedCalendar === "google" && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCalendar("apple")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                  selectedCalendar === "apple"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <AppleCalendarIcon />
                <span className="text-sm font-medium">Apple Calendar</span>
                {selectedCalendar === "apple" && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCalendar("outlook")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                  selectedCalendar === "outlook"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <OutlookCalendarIcon />
                <span className="text-sm font-medium">Outlook</span>
                {selectedCalendar === "outlook" && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            </div>

            {selectedCalendar && (
              <div className="text-sm text-muted-foreground pt-2">
                {selectedCalendar === "google" && (
                  <>We'll open Google Calendar in a new tab to add your availability.</>
                )}
                {selectedCalendar === "apple" && (
                  <>We'll download a calendar file you can open in Apple Calendar.</>
                )}
                {selectedCalendar === "outlook" && (
                  <>We'll open Outlook or download a calendar file if that's not possible.</>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Section 3: Sync behavior */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Sync type</Label>
            <div className="text-sm text-muted-foreground">
              This is a one-time sync. You can sync again anytime.
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground">
            You can change this anytime from Settings → Calendar sync.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSync} disabled={isSyncing || !selectedCalendar || eventCount === 0}>
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : syncSuccess ? (
                "Sync again"
              ) : (
                "Sync now"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

