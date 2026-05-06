import { Check, Loader2, MapPin, MapPinIcon, Search, User, X } from 'lucide-react';
import type { ElementType } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { to12Hour, to24Hour } from '@/utils/availabilityUtils';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import { getStateFullName } from '@/utils/stateUtils';
import type { PhotographerPickerOption } from './useShootOverviewEditor';

type OverviewPhotographerPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photographerPickerContext: {
    categoryName?: string;
  } | null;
  isEditMode: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  sortBy: 'distance' | 'availability';
  setSortBy: (value: 'distance' | 'availability') => void;
  showAllPhotographers: boolean;
  setShowAllPhotographers: (value: boolean | ((current: boolean) => boolean)) => void;
  isCalculatingDistances: boolean;
  isLoadingAvailability: boolean;
  filteredAndSortedPhotographers: PhotographerPickerOption[];
  selectedPhotographerId: string;
  setSelectedPhotographerId: (photographerId: string) => void;
  formatLocationLabel: (location?: { address?: string; city?: string; state?: string; zip?: string }) => string;
  formatAvailabilitySummary: (slots?: Array<{ start_time: string; end_time: string }>) => string;
  handleAssignPhotographer: () => void;
};

export function OverviewPhotographerPickerDialog({
  open,
  onOpenChange,
  photographerPickerContext,
  isEditMode,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  showAllPhotographers,
  setShowAllPhotographers,
  isCalculatingDistances,
  isLoadingAvailability,
  filteredAndSortedPhotographers,
  selectedPhotographerId,
  setSelectedPhotographerId,
  formatLocationLabel,
  formatAvailabilitySummary,
  handleAssignPhotographer,
}: OverviewPhotographerPickerDialogProps) {
  const isMobile = useIsMobile();
  const selectedPhotographerDetails =
    filteredAndSortedPhotographers.find((photographer) => photographer.id === selectedPhotographerId) || null;
  const PickerRoot: ElementType = isMobile ? Drawer : Dialog;
  const PickerContent: ElementType = isMobile ? DrawerContent : DialogContent;
  const PickerHeader: ElementType = isMobile ? DrawerHeader : DialogHeader;
  const PickerTitle: ElementType = isMobile ? DrawerTitle : DialogTitle;
  const PickerDescription: ElementType = isMobile ? DrawerDescription : DialogDescription;
  const availabilityScaleStartMinutes = 8 * 60;
  const availabilityScaleEndMinutes = 20 * 60;
  const availabilityScaleTotalMinutes = availabilityScaleEndMinutes - availabilityScaleStartMinutes;
  const availabilityScaleTickCount = 11;
  const normalizeSlotTime = (value?: string) => {
    if (!value) return '';
    const converted = to24Hour(value.trim());
    const [hours, minutes] = converted.split(':');
    if (!hours || !minutes) return converted;
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  };
  const timeToMinutes = (time: string) => {
    const normalized = normalizeSlotTime(time);
    const [hours, minutes] = normalized.split(':').map(Number);
    if (!Number.isFinite(hours)) return 0;
    return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
  };
  const minutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };
  const clampTimelineSlot = (slot: { start_time: string; end_time: string }) => {
    const startMinutes = Math.max(availabilityScaleStartMinutes, timeToMinutes(slot.start_time));
    const endMinutes = Math.min(availabilityScaleEndMinutes, timeToMinutes(slot.end_time));
    if (endMinutes <= startMinutes) return null;
    return {
      ...slot,
      start_time: minutesToTime(startMinutes),
      end_time: minutesToTime(endMinutes),
    };
  };
  const renderTimelineSlot = (
    slot: { start_time: string; end_time: string },
    key: string,
    className: string,
  ) => {
    const startMinutes = timeToMinutes(slot.start_time);
    const endMinutes = timeToMinutes(slot.end_time);
    if (endMinutes <= startMinutes) return null;
    const leftPercent = ((startMinutes - availabilityScaleStartMinutes) / availabilityScaleTotalMinutes) * 100;
    const widthPercent = ((endMinutes - startMinutes) / availabilityScaleTotalMinutes) * 100;
    const clampedLeft = Math.max(0, Math.min(100, leftPercent));
    const clampedWidth = Math.max(2, Math.min(100 - clampedLeft, widthPercent));
    if (clampedWidth <= 0) return null;
    return (
      <span
        key={key}
        className={className}
        style={{ left: `${clampedLeft}%`, width: `${clampedWidth}%` }}
      />
    );
  };

  return (
    <PickerRoot {...(isMobile ? { shouldScaleBackground: false } : {})} open={open} onOpenChange={onOpenChange}>
      <PickerContent
        className={cn(
          'overflow-hidden border-slate-800/80 bg-background p-0',
          isMobile
            ? 'z-[190] flex max-h-[88dvh] flex-col rounded-t-3xl'
            : 'flex h-[min(88vh,44rem)] w-[92vw] max-h-[90vh] flex-col sm:max-w-4xl',
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-2.5 pb-0 sm:gap-4 sm:px-6">
            <PickerHeader className="relative items-start space-y-1 px-0 pb-1 pt-3 text-left">
              {isMobile ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-2 h-8 w-8 rounded-full"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
              <PickerTitle className="pr-10 text-lg text-slate-900 dark:text-slate-100 sm:text-xl">
                {photographerPickerContext?.categoryName
                  ? `Select Photographer for ${photographerPickerContext.categoryName}`
                  : 'Select Photographer'}
              </PickerTitle>
              <PickerDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                Curated network - {filteredAndSortedPhotographers.length} available
              </PickerDescription>
            </PickerHeader>

            <div className="space-y-3">
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or area..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-10 rounded-full bg-slate-50 pl-9 sm:h-11 dark:bg-slate-900/50"
                  />
                </div>

                <div className="-mx-0.5 flex min-w-0 items-center gap-1.5 overflow-x-auto px-0.5 pb-1 sm:mx-0 sm:gap-2 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    type="button"
                    onClick={() => setSortBy('distance')}
                    className={cn(
                      'h-8 shrink-0 rounded-full border px-2.5 text-xs font-semibold transition-colors sm:h-9 sm:px-4',
                      sortBy === 'distance'
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60',
                    )}
                  >
                    Distance
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('availability')}
                    className={cn(
                      'h-8 shrink-0 rounded-full border px-2.5 text-xs font-semibold transition-colors sm:h-9 sm:px-4',
                      sortBy === 'availability'
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60',
                    )}
                  >
                    Availability
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAllPhotographers((current) => !current)}
                    className={cn(
                      'h-8 shrink-0 rounded-full border px-2.5 text-xs font-semibold transition-colors sm:h-9 sm:px-4',
                      showAllPhotographers
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60',
                    )}
                  >
                    Show All
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden sm:pr-2">
              {isCalculatingDistances || isLoadingAvailability ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {isCalculatingDistances ? 'Calculating distances...' : 'Checking availability...'}
                  </span>
                </div>
              ) : filteredAndSortedPhotographers.length > 0 ? (
                <div className="grid gap-2.5 sm:gap-3">
                  {filteredAndSortedPhotographers.map((photographerItem) => {
                    const isSelected = selectedPhotographerId === photographerItem.id;
                    const availabilitySource = photographerItem.netAvailableSlots?.length
                      ? photographerItem.netAvailableSlots
                      : photographerItem.availabilitySlots || [];
                    const availabilitySlots = availabilitySource
                      .map((slot) => ({
                        start_time: normalizeSlotTime(slot.start_time),
                        end_time: normalizeSlotTime(slot.end_time),
                      }))
                      .filter((slot) => slot.start_time && slot.end_time)
                      .map(clampTimelineSlot)
                      .filter(Boolean) as Array<{ start_time: string; end_time: string }>;
                    const bookedSlots = (photographerItem.bookedSlots || [])
                      .map((slot) => ({
                        start_time: normalizeSlotTime(slot.start_time),
                        end_time: normalizeSlotTime(slot.end_time),
                      }))
                      .filter((slot) => slot.start_time && slot.end_time)
                      .map(clampTimelineSlot)
                      .filter(Boolean) as Array<{ start_time: string; end_time: string }>;
                    const unavailableSlots = (photographerItem.unavailableSlots || [])
                      .map((slot) => ({
                        start_time: normalizeSlotTime(slot.start_time),
                        end_time: normalizeSlotTime(slot.end_time),
                      }))
                      .filter((slot) => slot.start_time && slot.end_time)
                      .map(clampTimelineSlot)
                      .filter(Boolean) as Array<{ start_time: string; end_time: string }>;
                    const distanceLabel = typeof photographerItem.distance === 'number' && Number.isFinite(photographerItem.distance)
                      ? `${photographerItem.distance.toFixed(1)} mi`
                      : null;
                    const locationLabel =
                      formatLocationLabel(
                        photographerItem.originAddress || {
                          address: photographerItem.address,
                          city: photographerItem.city,
                          state: photographerItem.state,
                          zip: photographerItem.zip,
                        },
                      ) || '';

                    return (
                      <button
                        key={photographerItem.id}
                        type="button"
                        onClick={() => setSelectedPhotographerId(photographerItem.id)}
                        className={cn(
                          'w-full min-w-0 rounded-2xl border px-2.5 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:px-4 sm:py-3',
                          isSelected
                            ? 'border-blue-500/70 bg-blue-50/60 dark:border-blue-500/50 dark:bg-blue-950/30'
                            : 'border-slate-200/70 bg-white/70 hover:border-blue-400/50 dark:border-slate-800/70 dark:bg-slate-900/40',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                          <Avatar
                            className={cn(
                              'h-10 w-10 shrink-0 sm:h-11 sm:w-11',
                              isSelected && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950',
                            )}
                          >
                            <AvatarImage src={getAvatarUrl(photographerItem.avatar, 'photographer', undefined, photographerItem.id)} alt={photographerItem.name} />
                            <AvatarFallback>{photographerItem.name?.charAt(0) || 'P'}</AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2 sm:gap-3">
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {photographerItem.name}
                                  </p>
                                  {distanceLabel ? (
                                    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                                      {distanceLabel}
                                    </span>
                                  ) : null}
                                  {photographerItem.distanceFrom === 'previous_shoot' ? (
                                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                                      from last shoot
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                  {locationLabel || (photographerItem.city && photographerItem.state
                                    ? `${photographerItem.city}, ${getStateFullName(photographerItem.state)}`
                                    : 'Location unavailable')}
                                </p>
                              </div>

                              <span
                                className={cn(
                                  'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors sm:h-8 sm:w-8',
                                  isSelected
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-300/80 dark:border-slate-700/80',
                                )}
                                aria-hidden="true"
                              >
                                {isSelected ? <Check className="h-4 w-4" /> : null}
                              </span>
                            </div>

                            <div className="mt-2">
                              <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                {availabilitySlots.map((slot, index) => renderTimelineSlot(slot, `${photographerItem.id}-slot-${index}`, 'absolute bottom-0 top-0 rounded-full bg-blue-500 dark:bg-blue-400'))}
                                {bookedSlots.map((slot, index) => renderTimelineSlot(slot, `${photographerItem.id}-booked-${index}`, 'absolute bottom-0 top-0 rounded-full bg-blue-900 dark:bg-blue-700'))}
                                {unavailableSlots.map((slot, index) => renderTimelineSlot(slot, `${photographerItem.id}-unavailable-${index}`, 'absolute bottom-0 top-0 rounded-full bg-red-500 dark:bg-red-500'))}
                              </div>
                              <div className="mt-1 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                <span className="shrink-0">8 AM</span>
                                <div className="flex flex-1 items-center justify-between px-1">
                                  {Array.from({ length: availabilityScaleTickCount }).map((_, index) => (
                                    <span
                                      key={`${photographerItem.id}-scale-${index}`}
                                      title={to12Hour(minutesToTime(availabilityScaleStartMinutes + Math.round(((index + 1) * availabilityScaleTotalMinutes) / (availabilityScaleTickCount + 1))))}
                                      className="h-1.5 w-px bg-slate-300/80 dark:bg-slate-600/80"
                                    />
                                  ))}
                                </div>
                                <span className="shrink-0">8 PM</span>
                              </div>
                              {isLoadingAvailability && availabilitySlots.length === 0 ? (
                                <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Checking availability...</div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery ? 'No photographers found matching your search.' : 'No photographers available.'}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-200/70 bg-white/95 pt-2.5 backdrop-blur [padding-bottom:calc(0.25rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 sm:pt-4 sm:pb-4 dark:border-slate-800/70 dark:bg-slate-950/95">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    className={cn(
                      'h-10 w-10 shrink-0',
                      selectedPhotographerDetails
                        ? 'ring-2 ring-blue-500/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                    )}
                  >
                    {selectedPhotographerDetails ? (
                      <>
                        <AvatarImage src={selectedPhotographerDetails.avatar} alt={selectedPhotographerDetails.name} />
                        <AvatarFallback>{selectedPhotographerDetails.name?.charAt(0) || 'P'}</AvatarFallback>
                      </>
                    ) : (
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-blue-500/80 sm:tracking-[0.28em]">
                      {photographerPickerContext?.categoryName
                        ? `Photographer for ${photographerPickerContext.categoryName}`
                        : 'Selected specialist'}
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedPhotographerDetails?.name || 'None selected'}
                    </p>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-2 gap-2 self-stretch sm:flex sm:self-auto">
                  <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-10 min-w-0 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
                    Discard
                  </Button>
                  <Button
                    onClick={handleAssignPhotographer}
                    disabled={!selectedPhotographerId}
                    className="h-10 min-w-0 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                  >
                    <span className="truncate">{isEditMode ? 'Use selection' : 'Confirm Assignment'}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PickerContent>
    </PickerRoot>
  );
}
