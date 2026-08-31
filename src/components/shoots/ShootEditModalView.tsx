import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, BellOff, Check, Clock, Edit, FileText, Layers, Loader2, MapPin, Search, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import type { useShootEditModalController } from './useShootEditModalController';
import { createShootEditModalPanels } from './ShootEditModalPanels';
import {
  availabilityScaleStartMinutes,
  availabilityScaleTickCount,
  availabilityScaleTotalMinutes,
  timeToMinutes,
  type AvailabilitySlot,
  type MobileEditPanel,
} from './shootEditModalTypes';

export function ShootEditModalView({ model }: { model: ReturnType<typeof useShootEditModalController> }) {
  const {
    isOpen,
    onClose,
    isSubmitting,
    isLoading,
    photographers,
    photographerPickerOpen,
    photographerPickerContext,
    pickerPhotographerId,
    setPickerPhotographerId,
    photographerSearchQuery,
    setPhotographerSearchQuery,
    sortBy,
    setSortBy,
    showAllPhotographers,
    setShowAllPhotographers,
    photographerAvailability,
    isLoadingPhotographerAvailability,
    activeMobilePanel,
    setActiveMobilePanel,
    isDesktopLayout,
    resolvePhotographerDetails,
    filteredPhotographers,
    formatPhotographerLocationLabel,
    closePhotographerPicker,
    handleConfirmPhotographerPicker,
    handleClearPhotographerPicker,
    handleApprove,
    handleApproveWithoutNotification,
    serviceDetachConfirmation,
    handleConfirmServiceDetach,
    handleCancelServiceDetach,
  } = model;
  const {
    renderDetailsPanel,
    renderSchedulePanel,
    renderAssignmentsAndServicesPanel,
  } = createShootEditModalPanels(model);

  const isPickerMobile = !isDesktopLayout;
  const PickerRoot: React.ElementType = isPickerMobile ? Drawer : Dialog;
  const PickerContent: React.ElementType = isPickerMobile ? DrawerContent : DialogContent;
  const PickerHeader: React.ElementType = isPickerMobile ? DrawerHeader : DialogHeader;
  const PickerTitle: React.ElementType = isPickerMobile ? DrawerTitle : DialogTitle;
  const PickerDescription: React.ElementType = isPickerMobile ? DrawerDescription : DialogDescription;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0 text-slate-900 dark:text-slate-100 sm:max-w-[900px] md:max-w-[1100px] lg:max-w-[1200px]">
        <DialogHeader className="shrink-0 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3 pr-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <Edit className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <DialogTitle className="text-xl">Modify Shoot Request</DialogTitle>
              <DialogDescription className="mt-1">
                Edit the shoot details below
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:px-6 md:grid-cols-3">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
            {isDesktopLayout ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-start">
                {renderDetailsPanel()}
                {renderSchedulePanel()}
                {renderAssignmentsAndServicesPanel()}
              </div>
            ) : (
              <Tabs
                value={activeMobilePanel}
                onValueChange={(value) => setActiveMobilePanel(value as MobileEditPanel)}
                className="space-y-3"
              >
                <div className="sticky top-0 z-10 bg-background pb-1">
                  <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-muted/60 p-1">
                    <TabsTrigger value="details" className="h-9 rounded-lg text-xs font-semibold">
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="schedule" className="h-9 rounded-lg text-xs font-semibold">
                      Schedule
                    </TabsTrigger>
                    <TabsTrigger value="services" className="h-9 rounded-lg text-xs font-semibold">
                      Services
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="details" className="mt-0">
                  {renderDetailsPanel()}
                </TabsContent>
                <TabsContent value="schedule" className="mt-0">
                  {renderSchedulePanel()}
                </TabsContent>
                <TabsContent value="services" className="mt-0">
                  {renderAssignmentsAndServicesPanel()}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}

        <DialogFooter className="mt-1 shrink-0 gap-2 border-t border-border/60 px-4 py-4 sm:px-6 sm:py-5">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleApproveWithoutNotification}
            disabled={isSubmitting || isLoading}
            className="w-full sm:min-w-[220px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <BellOff className="mr-2 h-4 w-4" />
                Approve without notification
              </>
            )}
          </Button>
          <Button 
            onClick={handleApprove} 
            disabled={isSubmitting || isLoading} 
            className="w-full bg-blue-600 hover:bg-blue-700 sm:min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Approve
              </>
            )}
          </Button>
        </DialogFooter>

        <PickerRoot {...(isPickerMobile ? { shouldScaleBackground: false } : {})} open={photographerPickerOpen} onOpenChange={(open) => {
          if (!open) {
            closePhotographerPicker();
          }
        }}>
          <PickerContent
            className={cn(
              'overflow-hidden border-slate-800/80 bg-background',
              isPickerMobile
                ? 'z-[190] flex max-h-[88dvh] flex-col rounded-t-3xl'
                : 'flex h-[min(88vh,44rem)] w-[92vw] max-h-[90vh] flex-col p-0 sm:max-w-4xl',
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-2.5 pb-0 sm:px-6">
                <PickerHeader className="relative items-start space-y-1 px-0 pb-1 pt-3 text-left">
                  {isPickerMobile ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-2 h-8 w-8 rounded-full"
                      onClick={closePhotographerPicker}
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
                    Curated network - {filteredPhotographers.length} available
                  </PickerDescription>
                </PickerHeader>

                <div className="space-y-3">
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or area..."
                        value={photographerSearchQuery}
                        onChange={(e) => setPhotographerSearchQuery(e.target.value)}
                        className="h-10 rounded-full bg-slate-50 pl-9 sm:h-9 dark:bg-slate-900/50"
                      />
                    </div>
                    <div className="-mx-0.5 flex min-w-0 items-center gap-1.5 overflow-x-auto px-0.5 pb-1 sm:mx-0 sm:gap-2 sm:pb-0 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      <Button type="button" size="sm" variant={sortBy === 'distance' ? 'default' : 'secondary'} className="h-8 shrink-0 rounded-full px-2.5 text-xs font-semibold sm:h-9 sm:px-3" onClick={() => setSortBy('distance')}>
                        Distance
                      </Button>
                      <Button type="button" size="sm" variant={sortBy === 'availability' ? 'default' : 'secondary'} className="h-8 shrink-0 rounded-full px-2.5 text-xs font-semibold sm:h-9 sm:px-3" onClick={() => setSortBy('availability')}>
                        Availability
                      </Button>
                      <Button type="button" size="sm" variant={showAllPhotographers ? 'default' : 'secondary'} className="h-8 shrink-0 rounded-full px-2.5 text-xs font-semibold sm:h-9 sm:px-3" onClick={() => setShowAllPhotographers((current) => !current)}>
                        Show All
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden sm:pr-2">
                  {filteredPhotographers.length > 0 ? (
                    <div className="grid gap-2.5 sm:gap-3">
                      {filteredPhotographers.map((photographer) => {
                        const isSelected = pickerPhotographerId === String(photographer.id);
                        const locationLabel = formatPhotographerLocationLabel(photographer);
                        const availabilitySlots = photographerAvailability[String(photographer.id)] || [];
                        const bookedSlots = photographer.bookedSlots || [];
                        const unavailableSlots = photographer.unavailableSlots || [];
                        const distanceLabel = typeof photographer.distance === 'number' && Number.isFinite(photographer.distance)
                          ? `${photographer.distance.toFixed(1)} mi`
                          : null;
                        const bookedCount = bookedSlots.length;
                        const unavailableCount = unavailableSlots.length;
                        const travelRange = photographer.travel_range;
                        const travelUnit = photographer.travel_range_unit || 'miles';
                        const rangeInMiles = travelUnit === 'km' && travelRange != null ? travelRange * 0.621371 : travelRange;
                        const isOutOfRange = typeof photographer.distance === 'number' && rangeInMiles != null && photographer.distance > rangeInMiles;
                        const renderTimelineSlot = (slot: AvailabilitySlot, key: string, className: string) => {
                          const startMinutes = timeToMinutes(slot.start_time);
                          const endMinutes = timeToMinutes(slot.end_time);
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
                          <button
                            type="button"
                            key={photographer.id}
                            onClick={() => setPickerPhotographerId(String(photographer.id))}
                            className={cn(
                              'w-full min-w-0 rounded-2xl border px-2.5 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:px-4',
                              isSelected
                                ? 'border-blue-500/70 bg-blue-50/60 dark:border-blue-500/50 dark:bg-blue-950/30'
                                : 'border-slate-200/70 bg-white/70 hover:border-blue-400/50 dark:border-slate-800/70 dark:bg-slate-900/40',
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
                              <Avatar
                                className={cn(
                                  'h-9 w-9 shrink-0 sm:h-11 sm:w-11',
                                  isSelected && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950',
                                )}
                              >
                                <AvatarImage
                                  src={getAvatarUrl(photographer.avatar, 'photographer', undefined, photographer.id)}
                                  alt={photographer.name}
                                />
                                <AvatarFallback>{photographer.name?.charAt(0)}</AvatarFallback>
                              </Avatar>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="min-w-0 max-w-full truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {photographer.name}
                                  </p>
                                  {distanceLabel ? (
                                    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                                      {distanceLabel}
                                    </span>
                                  ) : null}
                                  {photographer.distanceFrom === 'previous_shoot' ? (
                                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                                      from last shoot
                                    </span>
                                  ) : null}
                                  {isOutOfRange ? (
                                    <span className="shrink-0 rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-400">
                                      Out of range
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-0.5 min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
                                  {locationLabel || photographer.email || 'Location unavailable'}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                  {photographer.shootsCountToday ? <span>{photographer.shootsCountToday} shoot{photographer.shootsCountToday === 1 ? '' : 's'} today</span> : null}
                                  {bookedCount > 0 ? <span className="text-blue-700 dark:text-blue-300">{bookedCount} booked</span> : null}
                                  {unavailableCount > 0 ? <span className="text-red-600 dark:text-red-400">{unavailableCount} unavailable</span> : null}
                                </div>

                                <div className="mt-2 space-y-1">
                                  <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                    {availabilitySlots.map((slot, index) => renderTimelineSlot(slot, `${photographer.id}-slot-${index}`, 'absolute bottom-0 top-0 rounded-full bg-blue-500 dark:bg-blue-400'))}
                                    {bookedSlots.map((slot, index) => renderTimelineSlot(slot, `${photographer.id}-booked-${index}`, 'absolute bottom-0 top-0 rounded-full bg-blue-900 dark:bg-blue-700'))}
                                    {unavailableSlots.map((slot, index) => renderTimelineSlot(slot, `${photographer.id}-unavailable-${index}`, 'absolute bottom-0 top-0 rounded-full bg-red-500 dark:bg-red-500'))}
                                  </div>
                                  {availabilitySlots.length > 0 ? (
                                    <div className="mt-1 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                      <span className="shrink-0">8 AM</span>
                                      <div className="flex flex-1 items-center justify-between px-1">
                                        {Array.from({ length: availabilityScaleTickCount }).map((_, index) => (
                                          <span key={`${photographer.id}-scale-${index}`} className="h-1.5 w-px bg-slate-300/80 dark:bg-slate-600/80" />
                                        ))}
                                      </div>
                                      <span className="shrink-0">8 PM</span>
                                    </div>
                                  ) : null}
                                  {isLoadingPhotographerAvailability ? (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Loading availability...</p>
                                  ) : null}
                                </div>
                              </div>

                              <span
                                className={cn(
                                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors sm:h-8 sm:w-8',
                                  isSelected
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-300/80 dark:border-slate-700/80',
                                )}
                                aria-hidden="true"
                              >
                                {isSelected ? <Check className="h-4 w-4" /> : null}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      {photographerSearchQuery ? 'No photographers found matching your search.' : 'No photographers available.'}
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-slate-200/70 bg-white/80 pt-2.5 backdrop-blur [padding-bottom:calc(0.25rem+env(safe-area-inset-bottom))] sm:pt-4 sm:pb-0 dark:border-slate-800/70 dark:bg-slate-950/50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        className={cn(
                          'h-10 w-10 shrink-0',
                          resolvePhotographerDetails(pickerPhotographerId)
                            ? 'ring-2 ring-blue-500/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
                            : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                        )}
                      >
                        {resolvePhotographerDetails(pickerPhotographerId) ? (
                          <>
                            <AvatarImage
                              src={getAvatarUrl(resolvePhotographerDetails(pickerPhotographerId)?.avatar, 'photographer', undefined, pickerPhotographerId)}
                              alt={resolvePhotographerDetails(pickerPhotographerId)?.name}
                            />
                            <AvatarFallback>{resolvePhotographerDetails(pickerPhotographerId)?.name?.charAt(0)}</AvatarFallback>
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
                          {resolvePhotographerDetails(pickerPhotographerId)?.name || 'None selected'}
                        </p>
                      </div>
                    </div>

                    <div className="grid min-w-0 grid-cols-2 gap-2 self-stretch sm:flex sm:self-auto">
                      <Button variant="outline" onClick={handleClearPhotographerPicker} className="col-span-2 h-10 min-w-0 px-2 text-xs sm:col-span-1 sm:h-9 sm:px-3 sm:text-sm">
                        Leave unassigned
                      </Button>
                      <Button variant="ghost" onClick={closePhotographerPicker} className="h-10 min-w-0 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
                        Discard
                      </Button>
                      <Button onClick={handleConfirmPhotographerPicker} disabled={!pickerPhotographerId} className="h-10 min-w-0 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
                        <span className="truncate">Use selection</span>
                      </Button>
                    </div>
                  </div>
                </div>
            </div>
          </PickerContent>
        </PickerRoot>

        <Dialog
          open={Boolean(serviceDetachConfirmation)}
          onOpenChange={(open) => {
            if (!open) handleCancelServiceDetach();
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Confirm service removal
              </DialogTitle>
              <DialogDescription>
                The shoot changed services. Review the impact before approving it.
              </DialogDescription>
            </DialogHeader>
            {serviceDetachConfirmation && (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                  <p className="font-semibold">
                    Removing: {serviceDetachConfirmation.impact.removedServices.map((service) => service.name).join(', ')}
                  </p>
                  {serviceDetachConfirmation.impact.leavesNoServices && (
                    <p className="mt-2 font-semibold text-amber-800 dark:text-amber-200">
                      This shoot will have no services. Linked media remains at shoot level.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-xs">
                  <span className="text-muted-foreground">Current total</span>
                  <span className="text-right">${serviceDetachConfirmation.impact.currentTotal.toFixed(2)}</span>
                  <span className="text-muted-foreground">New total</span>
                  <span className="text-right font-semibold">${serviceDetachConfirmation.impact.newTotal.toFixed(2)}</span>
                  <span className="text-muted-foreground">Payment allocations released</span>
                  <span className="text-right">${serviceDetachConfirmation.impact.paymentAllocationsReleased.toFixed(2)}</span>
                  {serviceDetachConfirmation.impact.refundCreditDue > 0.005 && (
                    <>
                      <span className="font-semibold text-rose-700 dark:text-rose-300">Refund/credit due</span>
                      <span className="text-right font-semibold text-rose-700 dark:text-rose-300">
                        ${serviceDetachConfirmation.impact.refundCreditDue.toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelServiceDetach} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleConfirmServiceDetach} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm removal & approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>

    </Dialog>
  );
}
