import { ArrowUpDown, Loader2, MapPin, MapPinIcon, Search } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-full">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <DialogHeader>
                <DialogTitle className="text-lg text-slate-900 dark:text-slate-100">
                  {photographerPickerContext?.categoryName
                    ? `Select Photographer for ${photographerPickerContext.categoryName}`
                    : 'Select Photographer'}
                </DialogTitle>
                <DialogDescription>
                  {photographerPickerContext?.categoryName
                    ? `Choose a photographer for ${photographerPickerContext.categoryName} services`
                    : isEditMode
                    ? 'Choose a photographer for this shoot before saving your edits'
                    : 'Choose a photographer to assign to this shoot'}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search photographers..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(value: 'distance' | 'name') => setSortBy(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="distance">Sort by Distance</SelectItem>
                  <SelectItem value="name">Sort by Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            <div className="pt-3 max-h-[48vh] overflow-y-auto pr-2">
              {isCalculatingDistances ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Calculating distances...</span>
                </div>
              ) : filteredAndSortedPhotographers.length > 0 ? (
                <div className="grid gap-4">
                  {filteredAndSortedPhotographers.map((photographerItem) => (
                    <div
                      key={photographerItem.id}
                      className={cn(
                        'p-4 rounded-2xl border transition-all',
                        selectedPhotographerId === photographerItem.id
                          ? 'border-blue-300 bg-blue-50/70 dark:border-blue-700 dark:bg-blue-950/40'
                          : 'border-gray-100 bg-gray-50 dark:border-slate-700 dark:bg-slate-800',
                        'hover:border-blue-200 dark:hover:border-blue-800',
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={photographerItem.avatar} alt={photographerItem.name} />
                          <AvatarFallback>{photographerItem.name?.charAt(0)}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {photographerItem.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                {photographerItem.distance !== undefined ? (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {photographerItem.distance} mi away
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Distance unavailable</span>
                                )}
                                {photographerItem.city && photographerItem.state && (
                                  <span className="text-muted-foreground">
                                    • {photographerItem.city}, {getStateFullName(photographerItem.state)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {selectedPhotographerId === photographerItem.id && (
                              <span className="text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-300">Selected</span>
                            )}
                          </div>

                          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <MapPinIcon className="h-3.5 w-3.5" />
                            <span className="font-medium">
                              {photographerItem.distanceFrom === 'previous_shoot' ? 'Last shoot' : 'Home base'}:
                            </span>
                            <span className="truncate">
                              {formatLocationLabel(photographerItem.originAddress || {
                                address: photographerItem.address,
                                city: photographerItem.city,
                                state: photographerItem.state,
                                zip: photographerItem.zip,
                              }) || 'Location unavailable'}
                            </span>
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              <span>Today’s availability</span>
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
                                    isAvailable
                                      ? 'bg-blue-500 dark:bg-blue-400'
                                      : 'bg-slate-200 dark:bg-slate-700',
                                  )}
                                />
                              ))}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                              {isLoadingAvailability
                                ? 'Checking today’s slots...'
                                : formatAvailabilitySummary(photographerItem.netAvailableSlots) || 'No open slots today'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhotographerId(photographerItem.id);
                            }}
                            className={cn(
                              'px-3 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors',
                              selectedPhotographerId === photographerItem.id
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600',
                            )}
                          >
                            {selectedPhotographerId === photographerItem.id ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                  {searchQuery ? 'No photographers found matching your search.' : 'No photographers available.'}
                </div>
              )}
            </div>

            <div className="pt-4">
              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
                  Cancel
                </Button>
                <Button
                  onClick={handleAssignPhotographer}
                  className="w-full"
                  disabled={!selectedPhotographerId}
                >
                  {isEditMode ? 'Use selection' : 'Assign'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
