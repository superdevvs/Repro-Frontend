import { TravelFeasibilityPanel } from '@/features/travel/TravelFeasibilityPanel';
import { ShootUnitScopeBar } from '@/features/shoot-units/ShootUnitScope';
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, BellOff, Check, Clock, Edit, FileText, Layers, MapPin, MoreHorizontal, Search, User, X } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { cn } from '@/lib/utils';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import type { useShootEditModalController } from './useShootEditModalController';
import { createShootEditModalPanels } from './ShootEditModalPanels';
import { PhotographerAvailabilityTimeline } from '@/components/photographers/PhotographerAvailabilityTimeline';
import { PhotographerPickerMapShell } from '@/components/photographers/map/PhotographerPickerMapShell';
import { PHOTOGRAPHER_PICKER_DIALOG_DESKTOP_H_COMPACT } from '@/components/photographers/map/photographerPickerDialogClasses';
import { readPhotographerMapFields } from '@/components/photographers/map/photographerMapFields';
import {
  type MobileEditPanel,
} from './shootEditModalTypes';
import './shootScheduleDialogs.css';
import { useShootEditorViewport } from './useShootEditorViewport';
import { formatPrice } from '@/utils/servicePricing';

export function ShootEditModalView({ model }: { model: ReturnType<typeof useShootEditModalController> }) {
  const editor = useShootEditorViewport(model.isOpen);
  const [approvalOptionsOpen, setApprovalOptionsOpen] = React.useState(false);
  React.useEffect(() => { setApprovalOptionsOpen(false); }, [model.isOpen, model.shootId]);
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
    resolvePhotographerDetails,
    filteredPhotographers,
    formatPhotographerLocationLabel,
    bookingJobCoords,
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

  const isPickerMobile = editor.layout !== 'wide';
  const PickerRoot: React.ElementType = isPickerMobile ? Drawer : Dialog;
  const PickerContent: React.ElementType = isPickerMobile ? DrawerContent : DialogContent;
  const PickerHeader: React.ElementType = isPickerMobile ? DrawerHeader : DialogHeader;
  const PickerTitle: React.ElementType = isPickerMobile ? DrawerTitle : DialogTitle;
  const PickerDescription: React.ElementType = isPickerMobile ? DrawerDescription : DialogDescription;
  const selectedPickerPhotographer = resolvePhotographerDetails(pickerPhotographerId);
  const resolvedPickerJobCoords = React.useMemo(() => {
    const fromSelection = readPhotographerMapFields(selectedPickerPhotographer, bookingJobCoords).job;
    return fromSelection ?? bookingJobCoords ?? null;
  }, [selectedPickerPhotographer, bookingJobCoords]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent data-shoot-dialog data-shoot-layout={editor.layout} data-shoot-short={editor.short} style={editor.style} className="shoot-editor-shell flex flex-col overflow-hidden p-0 text-slate-900 dark:text-slate-100">
        <DialogHeader data-shoot-header className="shrink-0 border-b px-4 pb-4 pt-5 text-left sm:px-6">
          <div className="flex items-center gap-3 pr-10">
            <div className="shoot-desktop-action flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
              <Edit className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl">Modify Shoot Request</DialogTitle>
              <DialogDescription className="mt-1 break-words">
                <span className="block font-medium text-foreground">{model.unitSource?.location?.address || 'Edit the shoot details below'}</span><span className="mt-1 block">{model.clientName}</span>
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
          <div data-shoot-body className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="shoot-editor-toolbar mb-4">
              {model.unitSource && <div className="min-w-0"><ShootUnitScopeBar variant="compact" shoot={model.unitSource} disabled={model.unitScopeDirty || isLoading || isSubmitting} />{model.unitScopeDirty && model.unitSource.units?.length ? <p className="mt-1 text-[11px] text-muted-foreground">Save this unit before switching.</p> : null}</div>}
              <div className="min-w-0 flex-1"><TravelFeasibilityPanel compact travel={model.travel} /></div>
            </div>
            {editor.layout === 'wide' ? (
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
                    <TabsTrigger value="details" className="h-10 rounded-lg text-xs font-semibold">
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="schedule" className="h-10 rounded-lg text-xs font-semibold">
                      Schedule
                    </TabsTrigger>
                    <TabsTrigger value="services" className="h-10 rounded-lg text-xs font-semibold">
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

        <DialogFooter data-shoot-footer className="shrink-0 flex-row gap-2 border-t border-border/60 bg-background px-4 py-3 sm:px-6">
          <p className="mr-auto min-w-0 text-xs text-muted-foreground"><span className="block">{(model.unitSource?.units?.length ?? 0) > 1 ? 'Unit total' : 'Total'}</span><span className="text-base font-semibold tabular-nums text-foreground">{isLoading ? '…' : model.hasVariablePricingWithoutSqft ? 'TBD' : formatPrice(model.selectedServicesPricing.pricing.totalQuote)}</span></p>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="shoot-desktop-action h-11">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleApproveWithoutNotification}
            disabled={isSubmitting || isLoading || model.travel.blocked}
            className="shoot-desktop-action h-11"
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" />
                {model.isConfirmedEdit ? 'Saving...' : 'Approving...'}
              </>
            ) : (
              <>
                <BellOff className="mr-2 h-4 w-4" />
                {model.isConfirmedEdit ? 'Save without notification' : 'Approve without notification'}
              </>
            )}
          </Button>
          <Button 
            onClick={handleApprove} 
            disabled={isSubmitting || isLoading || model.travel.blocked}
            className="h-11 min-w-0 bg-blue-600 px-6 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" />
                {model.isConfirmedEdit ? 'Saving...' : 'Approving...'}
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {model.isConfirmedEdit ? 'Save changes' : 'Approve'}
              </>
            )}
          </Button>
          <DropdownMenu open={approvalOptionsOpen} onOpenChange={setApprovalOptionsOpen}><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="icon" aria-label="More approval options" disabled={isSubmitting} className="shoot-compact-action h-11 w-11 shrink-0"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="z-[90] min-w-[250px]" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setApprovalOptionsOpen(false); } }}><DropdownMenuItem className="min-h-11" disabled={isSubmitting || isLoading || model.travel.blocked} onSelect={handleApproveWithoutNotification}><BellOff className="mr-2 h-4 w-4" />Approve without notification</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={onClose}>Cancel</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
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
                ? 'z-[190] flex h-[min(92dvh,52rem)] max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl'
                : PHOTOGRAPHER_PICKER_DIALOG_DESKTOP_H_COMPACT,
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-2.5 pb-0 pt-3 sm:px-6 [@media(orientation:landscape)_and_(max-height:900px)]:gap-2 [@media(orientation:landscape)_and_(max-height:900px)]:px-2 [@media(orientation:landscape)_and_(max-height:900px)]:pt-2">
                {isPickerMobile ? (
                  <div className="relative z-30 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Close photographer picker"
                      className="absolute right-0 top-0 h-11 w-11 rounded-full bg-background"
                      onClick={closePhotographerPicker}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}

                <PhotographerPickerMapShell
                  isMobile={isPickerMobile}
                  photographer={selectedPickerPhotographer}
                  photographerName={selectedPickerPhotographer?.name}
                  photographerId={selectedPickerPhotographer?.id != null ? String(selectedPickerPhotographer.id) : null}
                  photographers={filteredPhotographers}
                  jobCoords={resolvedPickerJobCoords}
                  onSelectPhotographer={(id) => setPickerPhotographerId(id ?? '')}
                  className="min-h-0"
                  list={
                    <>
                <PickerHeader className="relative shrink-0 items-start space-y-1 px-0 pb-0 text-left">
                  <PickerTitle className="pr-12 text-lg text-slate-900 dark:text-slate-100 sm:text-xl">
                    {photographerPickerContext?.categoryName
                      ? `Select Photographer for ${photographerPickerContext.categoryName}`
                      : 'Select Photographer'}
                  </PickerTitle>
                  <PickerDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                    {filteredPhotographers.length} {filteredPhotographers.length === 1 ? 'photographer' : 'photographers'} shown
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
                          : 'Distance unavailable';
                        const bookedCount = bookedSlots.length;
                        const unavailableCount = unavailableSlots.length;
                        const travelRange = photographer.travel_range;
                        const travelUnit = photographer.travel_range_unit || 'miles';
                        const rangeInMiles = travelUnit === 'km' && travelRange != null ? travelRange * 0.621371 : travelRange;
                        const isOutOfRange = typeof photographer.distance === 'number' && rangeInMiles != null && photographer.distance > rangeInMiles;

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

                                <div className="mt-2">
                                  <PhotographerAvailabilityTimeline
                                    availableSlots={availabilitySlots}
                                    bookedSlots={bookedSlots}
                                    unavailableSlots={unavailableSlots}
                                    loadingHint={isLoadingPhotographerAvailability ? 'Loading availability...' : null}
                                  />
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

                <div className="shrink-0 border-t border-slate-200/70 bg-white pt-2.5 [padding-bottom:calc(0.25rem+env(safe-area-inset-bottom))] sm:pt-4 sm:pb-2 dark:border-slate-800/70 dark:bg-slate-950">
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
                    </>
                  }
                />
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
                {isSubmitting ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> : null}
                Confirm removal & approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>

    </Dialog>
  );
}
