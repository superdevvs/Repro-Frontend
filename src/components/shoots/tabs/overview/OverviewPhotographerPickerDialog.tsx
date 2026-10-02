import { TravelFeasibilityPanel } from '@/features/travel/TravelFeasibilityPanel';
import type { TravelController } from '@/features/travel/useTravelFeasibility';
import { Check, Search, User, X } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
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
import { PhotographerAvailabilityTimeline } from '@/components/photographers/PhotographerAvailabilityTimeline';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import { getStateFullName } from '@/utils/stateUtils';
import type { PhotographerPickerOption } from './useShootOverviewEditor';

type OverviewPhotographerPickerDialogProps = {
  travel?: TravelController;
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
  open, travel,
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
  return (
    <PickerRoot {...(isMobile ? { shouldScaleBackground: false } : {})} open={open} onOpenChange={onOpenChange}>
      <PickerContent
        className={cn(
          'overflow-hidden border-slate-800/80 bg-background p-0',
          isMobile
            ? 'z-[190] flex max-h-[92dvh] flex-col rounded-t-3xl'
            : 'flex h-[min(88vh,44rem)] w-[92vw] max-h-[90vh] flex-col sm:max-w-4xl',
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-2.5 pb-0 sm:gap-4 sm:px-6">
            <PickerHeader className="relative items-start space-y-0.5 px-0 pb-0.5 pt-1.5 text-left sm:space-y-1 sm:pb-1 sm:pt-3">
              {isMobile ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0.5 h-7 w-7 rounded-full"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              <PickerTitle className="pr-9 text-base text-slate-900 dark:text-slate-100 sm:pr-10 sm:text-xl">
                {photographerPickerContext?.categoryName
                  ? `Select Photographer for ${photographerPickerContext.categoryName}`
                  : 'Select Photographer'}
              </PickerTitle>
              <PickerDescription className="text-[10px] uppercase tracking-[0.2em] text-blue-500/80 sm:text-[11px] sm:tracking-[0.28em]">
                Curated network - {filteredAndSortedPhotographers.length} available
              </PickerDescription>
            </PickerHeader>
            {!isEditMode && travel && <div className="max-h-[35vh] shrink-0 overflow-y-auto"><TravelFeasibilityPanel travel={travel} /></div>}

            <div className="space-y-2 sm:space-y-3">
              <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or area..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-9 rounded-full bg-slate-50 pl-9 sm:h-11 dark:bg-slate-900/50"
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
              {isCalculatingDistances && filteredAndSortedPhotographers.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Calculating distances...</span>
                </div>
              ) : filteredAndSortedPhotographers.length > 0 ? (
                <div className="grid gap-2.5 sm:gap-3">
                  {(isCalculatingDistances || isLoadingAvailability) ? (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs text-slate-500 dark:border-slate-800/70 dark:bg-slate-900/40 dark:text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{isCalculatingDistances ? 'Calculating distances...' : 'Checking availability...'}</span>
                    </div>
                  ) : null}
                  {filteredAndSortedPhotographers.map((photographerItem) => {
                    const isSelected = selectedPhotographerId === photographerItem.id;
                    const availabilitySource = photographerItem.netAvailableSlots?.length
                      ? photographerItem.netAvailableSlots
                      : photographerItem.availabilitySlots || [];
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
                              <PhotographerAvailabilityTimeline
                                availableSlots={availabilitySource}
                                bookedSlots={photographerItem.bookedSlots}
                                unavailableSlots={photographerItem.unavailableSlots}
                                loadingHint={isLoadingAvailability ? 'Checking availability...' : null}
                              />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {isLoadingAvailability ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5" />
                      <span>Checking availability...</span>
                    </div>
                  ) : searchQuery ? (
                    'No photographers found matching your search.'
                  ) : (
                    'No photographers available.'
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-200/70 bg-white/95 pt-1.5 backdrop-blur [padding-bottom:calc(0.15rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 sm:pt-4 sm:pb-4 dark:border-slate-800/70 dark:bg-slate-950/95">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <Avatar
                    className={cn(
                      'h-8 w-8 shrink-0 sm:h-10 sm:w-10',
                      selectedPhotographerDetails
                        ? 'ring-2 ring-blue-500/70 ring-offset-1 ring-offset-white sm:ring-offset-2 dark:ring-offset-slate-950'
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
                        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <div className="min-w-0">
                    <p className="hidden text-[10px] uppercase tracking-[0.18em] text-blue-500/80 sm:block sm:tracking-[0.28em]">
                      {photographerPickerContext?.categoryName
                        ? `Photographer for ${photographerPickerContext.categoryName}`
                        : 'Selected specialist'}
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedPhotographerDetails?.name || 'None selected'}
                    </p>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-2 gap-1.5 self-stretch sm:flex sm:gap-2 sm:self-auto">
                  <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-9 min-w-0 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
                    Discard
                  </Button>
                  <Button
                    onClick={handleAssignPhotographer}
                    disabled={!selectedPhotographerId || (!isEditMode && travel?.blocked)}
                    className="h-9 min-w-0 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
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
