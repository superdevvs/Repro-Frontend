import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, CheckCircle2, ChevronRight, Loader2, MapPin, Package, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import { ServiceDatePicker, ServiceTimePicker } from '@/components/shoots/ServiceSchedulePicker';
import type { SchedulingFormController } from './useSchedulingFormController';
import type { SchedulingSlot } from './schedulingModel';
import { formatTimeForDisplay, to12Hour } from '@/utils/availabilityUtils';

export function SchedulingPhotographerSection({ controller }: { controller: SchedulingFormController }) {
  const {
    date, time, toast, setPhotographerDialogOpen, selectedPhotographer, photographer,
    isMobile, photographerDialogOpen, availabilityStats, selectedPhotographerDetails,
    handleConfirmPhotographer, activeServiceNameForPicker, activeServiceCapabilityForPicker,
    searchQuery, setSearchQuery, sortBy, setSortBy, isCalculatingDistances,
    isLoadingAvailability, filteredAndSortedPhotographers, showAllPhotographers,
    setShowAllPhotographers, photographerAvailability, setPhotographer,
    activeServiceForPicker, requiresPerServiceAssignment, assignmentGroups,
    getPhotographerDetailsForService, setActiveServiceForPicker, setServicePhotographers,
    getServiceSchedule, updateServiceSchedules, buildConflictAwareServiceTimeOptions,
    getPhotographerForService, isPhotographerTimeDisabled, selectedServices,
    formatScheduleLine, handlePhotographerDialogOpen, handleConfirmServicePhotographer,
    formatLocationLabel, availabilityCardWindow, timeToMinutes, minutesToTime,
    normalizeSlotTime,
  } = controller;
  const renderPhotographerFilters = (mobileDrawer = false) => (
    <div className={cn("space-y-3", mobileDrawer && "space-y-2") }>
      <div className={cn("flex items-center gap-2", mobileDrawer && "flex-col items-stretch") }>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn("pl-9 h-9 rounded-full bg-slate-50 dark:bg-slate-900/50", mobileDrawer && "h-10")}
          />
        </div>
        <div
          className={cn(
            "flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            mobileDrawer && "-mx-1 px-1"
          )}
        >
          <button
            type="button"
            onClick={() => {
              setSortBy('distance');
            }}
            className={cn(
              "shrink-0 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors",
              sortBy === 'distance'
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60"
            )}
          >
            Distance
          </button>
          <button
            type="button"
            onClick={() => {
              setSortBy('availability');
            }}
            className={cn(
              "shrink-0 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors",
              sortBy === 'availability'
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60"
            )}
          >
            Availability
          </button>
          <button
            type="button"
            onClick={() => setShowAllPhotographers(!showAllPhotographers)}
            className={cn(
              "shrink-0 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors",
              showAllPhotographers
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60"
            )}
          >
            Show All
          </button>
        </div>
      </div>
    </div>
  );
  const renderPhotographerResults = (mobileDrawer = false) => {
    if (isCalculatingDistances) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Calculating distances...</span>
        </div>
      );
    }
    if (isLoadingAvailability && date && time) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Checking availability...</span>
        </div>
      );
    }
    if (!filteredAndSortedPhotographers.length) {
      return (
        <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
          {searchQuery
            ? 'No photographers found matching your search.'
            : showAllPhotographers
              ? 'No photographers found in the system.'
              : (
                <div className="space-y-2">
                  <p>No photographers available for the selected date and time.</p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setShowAllPhotographers(true)}
                    className="text-blue-600"
                  >
                    Show all photographers
                  </Button>
                </div>
              )}
        </div>
      );
    }
    return (
      <div className={cn("grid", mobileDrawer ? "gap-2.5 pb-1 px-0.5" : "gap-3") }>
        {filteredAndSortedPhotographers.map((photographerItem) => {
          const isSelected = photographer === photographerItem.id;
          const locationLabel = formatLocationLabel({
            address: photographerItem.address,
            city: photographerItem.city,
            state: photographerItem.state,
            zip: photographerItem.zip,
          });
          const availabilitySource = (photographerItem.netAvailableSlots && photographerItem.netAvailableSlots.length > 0)
            ? photographerItem.netAvailableSlots
            : photographerItem.availabilitySlots || [];
          const availabilityScaleStartMinutes = availabilityCardWindow.startMinutes;
          const availabilityScaleEndMinutes = availabilityCardWindow.endMinutes;
          const availabilityScaleTotalMinutes = Math.max(1, availabilityScaleEndMinutes - availabilityScaleStartMinutes);
          const availabilityScaleTickCount = 11;
          const clampTimelineSlot = (slot: SchedulingSlot): SchedulingSlot | null => {
            const startMinutes = Math.max(availabilityScaleStartMinutes, timeToMinutes(slot.start_time));
            const endMinutes = Math.min(availabilityScaleEndMinutes, timeToMinutes(slot.end_time));
            if (endMinutes <= startMinutes) return null;
            return {
              ...slot,
              start_time: minutesToTime(startMinutes),
              end_time: minutesToTime(endMinutes),
            };
          };
          const availabilitySlots = availabilitySource
            .map((slot) => ({
              start_time: normalizeSlotTime(slot.start_time),
              end_time: normalizeSlotTime(slot.end_time),
            }))
            .filter((slot) => slot.start_time && slot.end_time)
            .map(clampTimelineSlot)
            .filter((slot): slot is SchedulingSlot => Boolean(slot));
          const unavailableSlots = (photographerItem.unavailableSlots || [])
            .map((slot) => ({
              start_time: normalizeSlotTime(slot.start_time),
              end_time: normalizeSlotTime(slot.end_time),
            }))
            .filter((slot) => slot.start_time && slot.end_time)
            .map(clampTimelineSlot)
            .filter((slot): slot is SchedulingSlot => Boolean(slot));
          const bookedSlots = (photographerItem.bookedSlots || [])
            .map((slot) => ({
              start_time: normalizeSlotTime(slot.start_time),
              end_time: normalizeSlotTime(slot.end_time),
              status: slot.status,
              shoot_id: slot.shoot_id,
              address: slot.address,
              city: slot.city,
              state: slot.state,
              zip: slot.zip,
            }))
            .filter((slot) => slot.start_time && slot.end_time)
            .map(clampTimelineSlot)
            .filter((slot): slot is SchedulingSlot => Boolean(slot));
          const distanceMiles = typeof photographerItem.distance === 'number' && Number.isFinite(photographerItem.distance)
            ? photographerItem.distance
            : null;
          const distanceLabel = distanceMiles !== null ? `${distanceMiles.toFixed(1)} mi` : null;
          const distanceFromLabel = photographerItem.distanceFrom === 'previous_shoot'
            ? 'from previous shoot'
            : 'from home';
          const getLocationInitials = (slot: SchedulingSlot) => {
            const parts = [slot.address, slot.city, slot.state]
              .filter(Boolean)
              .flatMap((value) => String(value).split(/\s+/))
              .map((part) => part.replace(/[^a-z0-9]/gi, ''))
              .filter(Boolean);
            return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
          };
          const renderTimelineSlot = (
            slot: SchedulingSlot,
            key: string,
            className: string,
            label: string,
          ) => {
            const startMinutes = timeToMinutes(slot.start_time);
            const endMinutes = timeToMinutes(slot.end_time);
            const leftPercent = ((startMinutes - availabilityScaleStartMinutes) / availabilityScaleTotalMinutes) * 100;
            const widthPercent = ((endMinutes - startMinutes) / availabilityScaleTotalMinutes) * 100;
            const clampedLeft = Math.max(0, Math.min(100, leftPercent));
            const clampedWidth = Math.max(2, Math.min(100 - clampedLeft, widthPercent));
            if (clampedWidth <= 0) return null;
            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <span
                    className={className}
                    style={{ left: `${clampedLeft}%`, width: `${clampedWidth}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] whitespace-nowrap px-2 py-1 text-xs">
                  {label}{slot.address ? ` · ${getLocationInitials(slot)}` : ''} · {to12Hour(slot.start_time)}-{to12Hour(slot.end_time)}
                </TooltipContent>
              </Tooltip>
            );
          };
          return (
            <button
              key={photographerItem.id}
              type="button"
              onClick={() => setPhotographer?.(photographerItem.id)}
              className={cn(
                "w-full max-w-full min-w-0 text-left border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                mobileDrawer ? "rounded-xl px-3 py-2.5" : "rounded-2xl px-4 py-3",
                isSelected
                  ? "border-blue-500/70 bg-blue-50/60 dark:border-blue-500/50 dark:bg-blue-950/30"
                  : "border-slate-200/70 bg-white/70 dark:border-slate-800/70 dark:bg-slate-900/40 hover:border-blue-400/50"
              )}
            >
              <div className={cn("flex min-w-0 items-center", mobileDrawer ? "gap-3" : "gap-4") }>
                <Avatar
                  className={cn(
                    mobileDrawer ? "h-10 w-10 flex-shrink-0" : "h-11 w-11 flex-shrink-0",
                    isSelected && "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
                  )}
                >
                  <AvatarImage
                    src={getAvatarUrl(photographerItem.avatar, 'photographer', undefined, photographerItem.id)}
                    alt={photographerItem.name}
                  />
                  <AvatarFallback>{photographerItem.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn("font-semibold text-slate-900 dark:text-slate-100 truncate", mobileDrawer ? "text-base" : "text-sm") }>
                      {photographerItem.name}
                    </p>
                    {distanceLabel ? (
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                              {distanceLabel}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="px-2 py-1 text-xs">
                            Distance to shoot {distanceFromLabel}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                    {(() => {
                      const travelRange = photographerItem.travel_range ?? photographerItem.metadata?.travel_range;
                      const travelUnit = photographerItem.travel_range_unit ?? photographerItem.metadata?.travel_range_unit ?? 'miles';
                      const dist = photographerItem.distance;
                      if (travelRange != null && dist != null && Number.isFinite(dist)) {
                        const rangeInMiles = travelUnit === 'km' ? travelRange * 0.621371 : travelRange;
                        if (dist > rangeInMiles) {
                          return (
                            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              Out of range
                            </span>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                  <p className={cn("truncate text-slate-500 dark:text-slate-400", mobileDrawer ? "mt-0.5 text-sm" : "mt-0.5 text-xs") }>
                    {locationLabel || 'Location unavailable'}
                  </p>
                  <TooltipProvider delayDuration={100}>
                    <div className={cn("relative h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden", mobileDrawer ? "mt-1.5" : "mt-2") }>
                      {availabilitySlots.map((slot, index) => renderTimelineSlot(
                        slot,
                        `${photographerItem.id}-slot-${index}`,
                        "absolute top-0 bottom-0 rounded-full bg-blue-500 dark:bg-blue-400",
                        "Available"
                      ))}
                      {bookedSlots.map((slot, index) => renderTimelineSlot(
                        slot,
                        `${photographerItem.id}-booked-${index}`,
                        "absolute top-0 bottom-0 rounded-full bg-blue-900 dark:bg-blue-700",
                        "Booked"
                      ))}
                      {unavailableSlots.map((slot, index) => renderTimelineSlot(
                        slot,
                        `${photographerItem.id}-unavailable-${index}`,
                        "absolute top-0 bottom-0 rounded-full bg-red-500 dark:bg-red-500",
                        "Unavailable"
                      ))}
                    </div>
                    {availabilitySlots.length > 0 ? (
                      <div className="mt-1 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        <span className="shrink-0">{formatTimeForDisplay(minutesToTime(availabilityScaleStartMinutes))}</span>
                        <div className="flex flex-1 items-center justify-between px-1">
                          {Array.from({ length: availabilityScaleTickCount }).map((_, index) => {
                            const tickMinutes = availabilityScaleStartMinutes + Math.round(((index + 1) * availabilityScaleTotalMinutes) / (availabilityScaleTickCount + 1));
                            return (
                              <Tooltip key={`${photographerItem.id}-scale-${index}`}>
                                <TooltipTrigger asChild>
                                  <span className="h-1.5 w-px bg-slate-300/80 dark:bg-slate-600/80" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="px-2 py-1 text-xs">
                                  {to12Hour(minutesToTime(tickMinutes))}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                        <span className="shrink-0">{formatTimeForDisplay(minutesToTime(availabilityScaleEndMinutes))}</span>
                      </div>
                    ) : null}
                  </TooltipProvider>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center rounded-full border",
                    isSelected
                      ? "h-8 w-8 border-blue-600 bg-blue-600 text-white"
                      : "h-8 w-8 border-slate-300/80 dark:border-slate-700/80"
                  )}
                >
                  {isSelected ? <Check className="h-4 w-4" /> : null}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };
  const photographerTrigger = (
    <div
      className={cn(
        "bg-gray-50 dark:bg-card/60 rounded-lg p-3 sm:p-4 flex justify-between items-center transition-colors border border-gray-100 dark:border-muted/40",
        time ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-card/70" : "opacity-60 cursor-not-allowed"
      )}
      onClick={() => {
        if (!time) {
          toast({
            title: "Select time first",
            description: "Please choose a time before selecting a photographer.",
            variant: "destructive",
          });
          return;
        }
        setPhotographerDialogOpen(true);
      }}
    >
      <div className="flex items-center min-w-0">
        {selectedPhotographer ? (
          <>
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 mr-3 sm:mr-4 shrink-0">
              <AvatarImage
                src={getAvatarUrl(selectedPhotographer.avatar, 'photographer', undefined, selectedPhotographer.id)}
                alt={selectedPhotographer.name}
              />
              <AvatarFallback>{selectedPhotographer.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-base sm:text-xl font-semibold text-slate-900 dark:text-white">{selectedPhotographer.name}</span>
          </>
        ) : (
          <span className="truncate text-slate-500 dark:text-slate-400">Select a photographer</span>
        )}
      </div>
      <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-slate-400 shrink-0" />
    </div>
  );
  return (
        <div className="bg-white dark:bg-card/40 rounded-2xl p-3 sm:p-6 space-y-2 border border-slate-200 dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
            {requiresPerServiceAssignment ? 'Photographers' : 'Photographer'}
          </h2>
          {requiresPerServiceAssignment && (
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 mb-2">
              Assign a photographer for each service
            </p>
          )}
          {requiresPerServiceAssignment && (
            <div className="space-y-3">
              {assignmentGroups.map(({ key, serviceId, serviceName, categoryName }) => {
                const svcPhotographer = getPhotographerDetailsForService(serviceId);
                return (
                  <div key={key} className="min-w-0 space-y-1">
                    <p className="truncate text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {serviceName}
                      <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                        ({categoryName})
                      </span>
                    </p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div
                        className={cn(
                          "bg-gray-50 dark:bg-card/60 rounded-lg p-3 sm:p-4 flex justify-between items-center transition-colors border border-gray-100 dark:border-muted/40",
                          time ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-card/70" : "opacity-60 cursor-not-allowed"
                        )}
                        onClick={() => {
                          if (!time) {
                            toast({
                              title: "Select time first",
                              description: "Please choose a time before selecting a photographer.",
                              variant: "destructive",
                            });
                            return;
                          }
                          setActiveServiceForPicker(serviceId);
                          const currentId = getPhotographerForService(serviceId);
                          if (currentId) setPhotographer?.(currentId);
                          setPhotographerDialogOpen(true);
                        }}
                      >
                        <div className="flex items-center min-w-0">
                          {svcPhotographer ? (
                            <>
                              <Avatar className="h-8 w-8 sm:h-10 sm:w-10 mr-2.5 sm:mr-3 shrink-0">
                                <AvatarImage
                                  src={getAvatarUrl(svcPhotographer.avatar, 'photographer', undefined, svcPhotographer.id)}
                                  alt={svcPhotographer.name}
                                />
                                <AvatarFallback>{svcPhotographer.name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span className="truncate text-sm sm:text-base font-semibold text-slate-900 dark:text-white">{svcPhotographer.name}</span>
                            </>
                          ) : (
                            <span className="truncate text-slate-500 dark:text-slate-400 text-sm">Select a photographer</span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 shrink-0" />
                      </div>
                      <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200/70 bg-white p-3 dark:border-slate-800/70 dark:bg-slate-900/40 sm:grid-cols-[minmax(0,1fr)_124px] xl:grid-cols-[minmax(0,1fr)_140px]">
                        <div className="min-w-0 space-y-1">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Schedule</p>
                          <ServiceDatePicker
                            value={getServiceSchedule(serviceId).date}
                            onChange={(value) => updateServiceSchedules([serviceId], { date: value })}
                            triggerClassName="h-9"
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Time</p>
                          <ServiceTimePicker
                            value={getServiceSchedule(serviceId).time}
                            options={buildConflictAwareServiceTimeOptions(getPhotographerForService(serviceId), getServiceSchedule(serviceId).time)}
                            onChange={(value) => updateServiceSchedules([serviceId], { time: value })}
                            triggerClassName="h-9"
                            isTimeDisabled={(value) => isPhotographerTimeDisabled(getPhotographerForService(serviceId), value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!requiresPerServiceAssignment && (
            <>
              {selectedServices.length > 0 && (
                <div className="mb-3 space-y-2 rounded-lg border border-slate-200/70 bg-white p-3 dark:border-slate-800/70 dark:bg-slate-900/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service schedules</p>
                  {selectedServices.map(service => {
                    const schedule = getServiceSchedule(service.id);
                    return (
                      <div key={service.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_150px_120px] sm:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{service.name}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{formatScheduleLine(service.id)}</p>
                        </div>
                        <ServiceDatePicker
                          value={schedule.date}
                          onChange={(value) => updateServiceSchedules([service.id], { date: value })}
                          triggerClassName="h-9"
                        />
                        <ServiceTimePicker
                          value={schedule.time}
                          options={buildConflictAwareServiceTimeOptions(photographer, schedule.time)}
                          onChange={(value) => updateServiceSchedules([service.id], { time: value })}
                          triggerClassName="h-9"
                          isTimeDisabled={(value) => isPhotographerTimeDisabled(photographer, value)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {isMobile ? (
                <Drawer open={photographerDialogOpen} onOpenChange={handlePhotographerDialogOpen}>
                  <DrawerTrigger asChild>{photographerTrigger}</DrawerTrigger>
                  <DrawerContent className="h-[78vh] max-h-[78vh]">
                    <DrawerHeader className="pb-2 text-left">
                      <DrawerTitle className="text-lg text-slate-900 dark:text-slate-100">Select Photographer</DrawerTitle>
                      <DrawerDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                        {availabilityStats.hasAvailabilityData ? availabilityStats.available : availabilityStats.total} photographers available
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
                      {renderPhotographerFilters(true)}
                      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 [scrollbar-gutter:stable_both-edges]">
                        {renderPhotographerResults(true)}
                      </div>
                    </div>
                    <DrawerFooter className="border-t border-slate-200/70 dark:border-slate-800/70 bg-white/90 dark:bg-slate-950/60 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-blue-500/80">Selected photographer</p>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {selectedPhotographerDetails?.name || 'None selected'}
                        </p>
                      </div>
                      <Button
                        onClick={handleConfirmPhotographer}
                        className="h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-700"
                        disabled={!photographer}
                      >
                        Confirm Assignment
                      </Button>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              ) : (
                <Dialog open={photographerDialogOpen} onOpenChange={handlePhotographerDialogOpen}>
                  <DialogTrigger asChild>{photographerTrigger}</DialogTrigger>
                  <DialogContent className="sm:max-w-2xl w-[92vw] max-h-[90vh] p-0 overflow-hidden">
                    <div className="flex flex-col h-full sm:h-[70vh]">
                      <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 min-h-0">
                        <DialogHeader className="space-y-1 text-left items-start">
                          <DialogTitle className="text-xl text-slate-900 dark:text-slate-100">Select Photographer</DialogTitle>
                          <DialogDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                            {availabilityStats.hasAvailabilityData ? availabilityStats.available : availabilityStats.total} photographers available
                          </DialogDescription>
                        </DialogHeader>
                        {renderPhotographerFilters(false)}
                        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                          {renderPhotographerResults(false)}
                        </div>
                        <div className="pt-4 border-t border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/50 backdrop-blur flex-shrink-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className={cn(
                                "h-10 w-10 shrink-0",
                                selectedPhotographerDetails
                                  ? "ring-2 ring-blue-500/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
                                  : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              )}>
                                {selectedPhotographerDetails ? (
                                  <>
                                    <AvatarImage
                                      src={getAvatarUrl(selectedPhotographerDetails.avatar, 'photographer', undefined, selectedPhotographerDetails.id)}
                                      alt={selectedPhotographerDetails.name}
                                    />
                                    <AvatarFallback>{selectedPhotographerDetails.name?.charAt(0)}</AvatarFallback>
                                  </>
                                ) : (
                                  <AvatarFallback>
                                    <User className="h-4 w-4" />
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-blue-500/80">Selected specialist</p>
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {selectedPhotographerDetails?.name || 'None selected'}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                onClick={() => setPhotographerDialogOpen(false)}
                              >
                                Discard
                              </Button>
                              <Button
                                onClick={handleConfirmPhotographer}
                                disabled={!photographer}
                              >
                                Confirm Assignment
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}
          {requiresPerServiceAssignment && (
            <>
              {isMobile ? (
                <Drawer open={photographerDialogOpen} onOpenChange={(open) => {
                  setPhotographerDialogOpen(open);
                  if (!open) setActiveServiceForPicker(null);
                }}>
                  <DrawerContent className="h-[78vh] max-h-[78vh]">
                    <DrawerHeader className="pb-2 text-left">
                      <DrawerTitle className="text-lg text-slate-900 dark:text-slate-100">
                        Select Photographer{activeServiceNameForPicker ? ` for ${activeServiceNameForPicker}` : ''}
                      </DrawerTitle>
                      <DrawerDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                        {availabilityStats.hasAvailabilityData ? availabilityStats.available : availabilityStats.total} photographers available
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
                      {renderPhotographerFilters(true)}
                      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 [scrollbar-gutter:stable_both-edges]">
                        {renderPhotographerResults(true)}
                      </div>
                    </div>
                    <DrawerFooter className="border-t border-slate-200/70 dark:border-slate-800/70 bg-white/90 dark:bg-slate-950/60 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-blue-500/80">
                          {activeServiceNameForPicker ? `Photographer for ${activeServiceNameForPicker}` : 'Selected photographer'}
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {selectedPhotographerDetails?.name || 'None selected'}
                        </p>
                      </div>
                      <Button
                        onClick={handleConfirmServicePhotographer}
                        className="h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-700"
                        disabled={!photographer}
                      >
                        Confirm Assignment
                      </Button>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              ) : (
                <Dialog open={photographerDialogOpen} onOpenChange={(open) => {
                  setPhotographerDialogOpen(open);
                  if (!open) setActiveServiceForPicker(null);
                }}>
                  <DialogContent className="sm:max-w-2xl w-[92vw] max-h-[90vh] p-0 overflow-hidden">
                    <div className="flex flex-col h-full sm:h-[70vh]">
                      <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 min-h-0">
                        <DialogHeader className="space-y-1 text-left items-start">
                          <DialogTitle className="text-xl text-slate-900 dark:text-slate-100">
                            Select Photographer{activeServiceNameForPicker ? ` for ${activeServiceNameForPicker}` : ''}
                          </DialogTitle>
                          <DialogDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                            {availabilityStats.hasAvailabilityData ? availabilityStats.available : availabilityStats.total} photographers available
                          </DialogDescription>
                        </DialogHeader>
                        {renderPhotographerFilters(false)}
                        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                          {renderPhotographerResults(false)}
                        </div>
                        <div className="pt-4 border-t border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/50 backdrop-blur flex-shrink-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className={cn(
                                "h-10 w-10 shrink-0",
                                selectedPhotographerDetails
                                  ? "ring-2 ring-blue-500/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
                                  : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              )}>
                                {selectedPhotographerDetails ? (
                                  <>
                                    <AvatarImage
                                      src={getAvatarUrl(selectedPhotographerDetails.avatar, 'photographer', undefined, selectedPhotographerDetails.id)}
                                      alt={selectedPhotographerDetails.name}
                                    />
                                    <AvatarFallback>{selectedPhotographerDetails.name?.charAt(0)}</AvatarFallback>
                                  </>
                                ) : (
                                  <AvatarFallback>
                                    <User className="h-4 w-4" />
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-blue-500/80">
                                  {activeServiceNameForPicker ? `Photographer for ${activeServiceNameForPicker}` : 'Selected specialist'}
                                </p>
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {selectedPhotographerDetails?.name || 'None selected'}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setPhotographerDialogOpen(false);
                                  setActiveServiceForPicker(null);
                                }}
                              >
                                Discard
                              </Button>
                              <Button
                                onClick={handleConfirmServicePhotographer}
                                disabled={!photographer}
                              >
                                Confirm Assignment
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}
        </div>
  );
}
