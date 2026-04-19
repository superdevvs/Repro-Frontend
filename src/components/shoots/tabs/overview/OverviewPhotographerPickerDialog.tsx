import { Check, Loader2, MapPin, MapPinIcon, Search, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
  sortBy: 'distance' | 'name';
  setSortBy: (value: 'distance' | 'name') => void;
  isCalculatingDistances: boolean;
  isLoadingAvailability: boolean;
  filteredAndSortedPhotographers: PhotographerPickerOption[];
  selectedPhotographerId: string;
  setSelectedPhotographerId: (photographerId: string) => void;
  formatLocationLabel: (location?: { address?: string; city?: string; state?: string; zip?: string }) => string;
  buildAvailabilitySegments: (slots?: Array<{ start_time: string; end_time: string }>) => boolean[];
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
  isCalculatingDistances,
  isLoadingAvailability,
  filteredAndSortedPhotographers,
  selectedPhotographerId,
  setSelectedPhotographerId,
  formatLocationLabel,
  buildAvailabilitySegments,
  formatAvailabilitySummary,
  handleAssignPhotographer,
}: OverviewPhotographerPickerDialogProps) {
  const selectedPhotographerDetails =
    filteredAndSortedPhotographers.find((photographer) => photographer.id === selectedPhotographerId) || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-h-[90vh] overflow-hidden p-0 sm:max-w-4xl">
        <div className="flex h-full flex-col sm:h-[72vh]">
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
            <DialogHeader className="items-start space-y-1 text-left">
              <DialogTitle className="text-xl text-slate-900 dark:text-slate-100">
                {photographerPickerContext?.categoryName
                  ? `Select Photographer for ${photographerPickerContext.categoryName}`
                  : 'Select Photographer'}
              </DialogTitle>
              <DialogDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                Curated network - {filteredAndSortedPhotographers.length} available
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or area..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-11 rounded-full bg-slate-50 pl-9 dark:bg-slate-900/50"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    type="button"
                    onClick={() => setSortBy('distance')}
                    className={cn(
                      'shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                      sortBy === 'distance'
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60',
                    )}
                  >
                    Distance
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('name')}
                    className={cn(
                      'shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                      sortBy === 'name'
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60',
                    )}
                  >
                    Name
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-2">
              {isCalculatingDistances ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Calculating distances...</span>
                </div>
              ) : filteredAndSortedPhotographers.length > 0 ? (
                <div className="grid gap-3">
                  {filteredAndSortedPhotographers.map((photographerItem) => {
                    const isSelected = selectedPhotographerId === photographerItem.id;
                    const locationLabel =
                      formatLocationLabel(
                        photographerItem.originAddress || {
                          address: photographerItem.address,
                          city: photographerItem.city,
                          state: photographerItem.state,
                          zip: photographerItem.zip,
                        },
                      ) || 'Location unavailable';

                    return (
                      <button
                        key={photographerItem.id}
                        type="button"
                        onClick={() => setSelectedPhotographerId(photographerItem.id)}
                        className={cn(
                          'w-full rounded-2xl border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
                          isSelected
                            ? 'border-blue-500/70 bg-blue-50/60 dark:border-blue-500/50 dark:bg-blue-950/30'
                            : 'border-slate-200/70 bg-white/70 hover:border-blue-400/50 dark:border-slate-800/70 dark:bg-slate-900/40',
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12 shrink-0">
                            <AvatarImage src={photographerItem.avatar} alt={photographerItem.name} />
                            <AvatarFallback>{photographerItem.name?.charAt(0) || 'P'}</AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {photographerItem.name}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  {photographerItem.distance !== undefined ? (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {photographerItem.distance} mi away
                                    </span>
                                  ) : (
                                    <span>Distance unavailable</span>
                                  )}
                                  {photographerItem.city && photographerItem.state && (
                                    <span>
                                      • {photographerItem.city}, {getStateFullName(photographerItem.state)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span
                                className={cn(
                                  'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                                  isSelected
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-300/80 dark:border-slate-700/80',
                                )}
                                aria-hidden="true"
                              >
                                {isSelected ? <Check className="h-4 w-4" /> : null}
                              </span>
                            </div>

                            <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{locationLabel}</span>
                            </div>

                            <div className="mt-3">
                              <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                <span>Today's availability</span>
                                {typeof photographerItem.shootsCountToday === 'number' && (
                                  <span>{photographerItem.shootsCountToday} shoots</span>
                                )}
                              </div>
                              <div className="mt-2 flex gap-1">
                                {buildAvailabilitySegments(photographerItem.netAvailableSlots).map((isAvailable, index) => (
                                  <span
                                    key={`${photographerItem.id}-slot-${index}`}
                                    className={cn(
                                      'h-1.5 flex-1 rounded-full',
                                      isAvailable ? 'bg-blue-500 dark:bg-blue-400' : 'bg-slate-200 dark:bg-slate-700',
                                    )}
                                  />
                                ))}
                              </div>
                              <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                {isLoadingAvailability
                                  ? "Checking today's slots..."
                                  : formatAvailabilitySummary(photographerItem.netAvailableSlots) || 'No open slots today'}
                              </div>
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

            <div className="flex-shrink-0 border-t border-slate-200/70 bg-white/80 pt-4 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/50">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                    <p className="text-[10px] uppercase tracking-[0.28em] text-blue-500/80">
                      {photographerPickerContext?.categoryName
                        ? `Photographer for ${photographerPickerContext.categoryName}`
                        : 'Selected specialist'}
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedPhotographerDetails?.name || 'None selected'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 self-stretch lg:self-auto">
                  <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 lg:flex-none">
                    Discard
                  </Button>
                  <Button
                    onClick={handleAssignPhotographer}
                    disabled={!selectedPhotographerId}
                    className="flex-1 lg:flex-none"
                  >
                    {isEditMode ? 'Use selection' : 'Confirm Assignment'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
