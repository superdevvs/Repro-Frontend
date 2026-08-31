import React from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ServiceSelectionDialog } from '@/components/booking/ServiceSelectionDialog';
import { ServiceDatePicker, ServiceTimePicker } from '@/components/shoots/ServiceSchedulePicker';
import AddressLookupField from '@/components/AddressLookupField';
import { cn } from '@/lib/utils';
import { Bath, BedDouble, CalendarIcon, Clock, Edit, FileText, Home, Layers, MapPin, Ruler, ShieldAlert, ShieldCheck, User, X } from 'lucide-react';
import {
  availabilityScaleStartMinutes,
  availabilityScaleTickCount,
  availabilityScaleTotalMinutes,
  normalizeCategoryKey,
} from './shootEditModalTypes';
import type { useShootEditModalController } from './useShootEditModalController';

export function createShootEditModalPanels(model: ReturnType<typeof useShootEditModalController>) {
  const {
    isLoading,
    expandedServiceScheduleId,
    setExpandedServiceScheduleId,
    servicesEditorOpen,
    setServicesEditorOpen,
    canRemoveAllServices,
    isAdminOrRep,
    address,
    setAddress,
    city,
    setCity,
    state,
    setState,
    zip,
    setZip,
    setScheduledDate,
    scheduledTime,
    setScheduledTime,
    alternateDate,
    setAlternateDate,
    alternateTime,
    setAlternateTime,
    selectedServiceIds,
    serviceSchedules,
    photographerId,
    perCategoryPhotographers,
    scheduleError,
    shootNotes,
    setShootNotes,
    companyNotes,
    setCompanyNotes,
    photographerNotes,
    setPhotographerNotes,
    editorNotes,
    setEditorNotes,
    showInternalNotes,
    companyNotesOpen,
    setCompanyNotesOpen,
    photographerNotesOpen,
    setPhotographerNotesOpen,
    editorNotesOpen,
    setEditorNotesOpen,
    propertyDetails,
    setPropertyDetails,
    propertySqft,
    setPropertySqft,
    taxPercent,
    clearAddressDerivedState,
    handleAddressSelect,
    getServicePrice,
    hasVariablePricingWithoutSqft,
    clientName,
    clientEmail,
    clientPhone,
    clientVerified,
    selectedServiceCategoryGroups,
    hasMultiplePhotographerCategories,
    resolvePhotographerDetails,
    isEditTimeDisabled,
    openPhotographerPicker,
    timeOptions,
    minSelectableDate,
    scheduledDateInputValue,
    defaultServiceSchedule,
    selectedServiceRows,
    updateServiceSchedule,
    getServiceScheduleSummary,
    sortedServiceScheduleRows,
    selectedServicesPricing,
    serviceSelectionOptions,
    selectedServiceSelectionOptions,
    handleSelectedServicesChange,
  } = model;

  const renderDetailsPanel = () => (
    <div className="space-y-3 md:pr-1">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <User className="h-4 w-4 text-blue-500" />
          <p className="text-sm font-semibold">Client</p>
          <Badge
            variant="outline"
            className={cn(
              'ml-auto shrink-0 gap-1 px-1.5 py-0 text-[10px] font-medium',
              clientVerified
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
            )}
          >
            {clientVerified ? (
              <ShieldCheck className="h-3 w-3" />
            ) : (
              <ShieldAlert className="h-3 w-3" />
            )}
            {clientVerified ? 'Verified' : 'Unverified'}
          </Badge>
        </div>
        <p className="font-medium">{clientName}</p>
        {clientEmail && (
          <p className="text-sm text-muted-foreground">{clientEmail}</p>
        )}
        {clientPhone && (
          <p className="text-sm text-muted-foreground">{clientPhone}</p>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold">Property Address</p>
        </div>

        <AddressLookupField
          value={address}
          onChange={setAddress}
          onSelectionReset={clearAddressDerivedState}
          onSelectionStarted={() => {
            setAddress('');
            clearAddressDerivedState();
          }}
          onAddressSelect={handleAddressSelect}
          placeholder="Search address..."
        />

        <div className="grid grid-cols-3 gap-1.5">
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="h-8 text-xs"
          />
          <Input
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="ST"
            className="h-8 text-xs"
            maxLength={2}
          />
          <Input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="ZIP"
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Property Details
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-[10px]">
              <BedDouble className="h-3 w-3" /> Beds
            </Label>
            <Input
              type="number"
              value={propertyDetails?.bedrooms || ''}
              onChange={(e) => setPropertyDetails((prev) => ({
                ...prev,
                bedrooms: e.target.value ? Number(e.target.value) : undefined,
              }))}
              placeholder="0"
              className="h-7 text-xs"
              min={0}
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-[10px]">
              <Bath className="h-3 w-3" /> Baths
            </Label>
            <Input
              type="number"
              step="0.5"
              value={propertyDetails?.bathrooms || ''}
              onChange={(e) => setPropertyDetails((prev) => ({
                ...prev,
                bathrooms: e.target.value ? Number(e.target.value) : undefined,
              }))}
              placeholder="0"
              className="h-7 text-xs"
              min={0}
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-[10px]">
              <Ruler className="h-3 w-3" /> Sqft
            </Label>
            <Input
              type="number"
              value={propertySqft || ''}
              onChange={(e) => setPropertySqft(e.target.value ? Number(e.target.value) : null)}
              placeholder="0"
              className="h-7 text-xs"
              min={0}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-500" />
          <Label className="text-xs font-semibold">Shoot Notes</Label>
        </div>
        <Textarea
          value={shootNotes}
          onChange={(e) => setShootNotes(e.target.value)}
          placeholder="Access codes, instructions..."
          rows={2}
          className="resize-none text-xs"
        />
      </div>

      {showInternalNotes && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <Label className="text-xs font-semibold">Company Notes</Label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setCompanyNotesOpen((v) => !v)}
            >
              {companyNotesOpen ? 'Hide' : 'Show'}
            </Button>
          </div>
          {companyNotesOpen && (
            <Textarea
              value={companyNotes}
              onChange={(e) => setCompanyNotes(e.target.value)}
              placeholder="Internal notes..."
              rows={2}
              className="resize-none text-xs"
            />
          )}
        </div>
      )}
    </div>
  );

  const renderServiceSchedulesSection = () => {
    if (selectedServiceRows.length === 0) return null;

    return (
      <div className="space-y-2 border-t border-border/70 pt-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Service schedules
          </Label>
          <span className="text-[10px] text-muted-foreground">Defaults to order</span>
        </div>
        <div className="space-y-1.5">
          {sortedServiceScheduleRows.map(({ id, service }) => {
            const schedule = serviceSchedules[id] || defaultServiceSchedule;
            const isExpanded = expandedServiceScheduleId === id;

            return (
              <div key={id} className="rounded-md border border-border bg-background/50">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 p-2 text-left"
                  onClick={() => setExpandedServiceScheduleId(isExpanded ? null : id)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{service.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                      <CalendarIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{getServiceScheduleSummary(schedule)}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                    {isExpanded ? 'Hide' : schedule.date ? 'Edit' : 'Select'}
                  </Badge>
                </button>
                {isExpanded && (
                  <div className="grid grid-cols-2 gap-2 border-t border-border/70 p-2 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Date</Label>
                      <ServiceDatePicker
                        value={schedule.date}
                        minDate={minSelectableDate}
                        onChange={(value) => updateServiceSchedule(id, 'date', value)}
                        triggerClassName="h-8 rounded-lg px-2"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Time</Label>
                      <ServiceTimePicker
                        value={schedule.time || scheduledTime}
                        options={timeOptions}
                        onChange={(value) => updateServiceSchedule(id, 'time', value)}
                        isTimeDisabled={isEditTimeDisabled}
                        triggerClassName="h-8 rounded-lg px-2"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPhotographersSection = () => {
    if (!isAdminOrRep) return null;

    if (hasMultiplePhotographerCategories) {
      return (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold">Photographers</p>
          </div>
          <div className="space-y-2">
            {selectedServiceCategoryGroups.map((group) => {
              const selectedPhotographer = resolvePhotographerDetails(
                perCategoryPhotographers[group.key] || photographerId,
              );

              return (
                <div
                  key={group.key}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5"
                >
                  <div className="min-w-0 space-y-1 text-xs">
                    <div className="text-[9px] font-medium uppercase text-muted-foreground">
                      {group.name}
                    </div>
                    <div className="font-medium">
                      {selectedPhotographer?.name || 'Unassigned'}
                    </div>
                    {selectedPhotographer?.email && (
                      <div className="truncate text-muted-foreground">
                        {selectedPhotographer.email}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 text-xs"
                    onClick={() =>
                      openPhotographerPicker({
                        categoryKey: group.key,
                        categoryName: group.name,
                      })
                    }
                  >
                    {selectedPhotographer ? 'Edit photographer' : 'Select photographer'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const selectedPhotographer = resolvePhotographerDetails(photographerId);

    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold">Photographer</p>
        </div>
        <div className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5">
          <div className="min-w-0 space-y-1 text-xs">
            <div className="font-medium">
              {selectedPhotographer?.name || 'Unassigned'}
            </div>
            {selectedPhotographer?.email && (
              <div className="truncate text-muted-foreground">
                {selectedPhotographer.email}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={() => openPhotographerPicker(null)}
          >
            {selectedPhotographer ? 'Edit photographer' : 'Select photographer'}
          </Button>
        </div>
      </div>
    );
  };

  const renderSchedulePanel = () => (
    <div className="space-y-3 md:pr-1">
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold">Schedule</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Date *</Label>
            <ServiceDatePicker
              value={scheduledDateInputValue}
              minDate={minSelectableDate}
              onChange={(value) => {
                const nextDate = new Date(`${value}T12:00:00`);
                setScheduledDate(Number.isNaN(nextDate.getTime()) ? undefined : nextDate);
              }}
              triggerClassName="h-8 rounded-lg px-2"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">Time</Label>
            <ServiceTimePicker
              value={scheduledTime}
              options={timeOptions}
              onChange={setScheduledTime}
              isTimeDisabled={isEditTimeDisabled}
              triggerClassName="h-8 rounded-lg px-2"
            />
          </div>
        </div>

        {/* Alternate (backup) date/time — optional. Submitted via the modify payload
            as alternate_scheduled_date / alternate_time. */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px]">Alternate Date (optional)</Label>
            {alternateDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-muted-foreground"
                onClick={() => {
                  setAlternateDate('');
                  setAlternateTime('');
                }}
              >
                <X className="mr-1 h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ServiceDatePicker
              value={alternateDate}
              minDate={minSelectableDate}
              onChange={(value) => setAlternateDate(value)}
              triggerClassName="h-8 rounded-lg px-2"
            />
            <ServiceTimePicker
              value={alternateTime}
              options={timeOptions}
              onChange={setAlternateTime}
              triggerClassName="h-8 rounded-lg px-2"
            />
          </div>
        </div>

        {scheduleError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-[11px] font-medium text-destructive"
          >
            {scheduleError}
          </div>
        )}

        {renderServiceSchedulesSection()}
      </div>

      {showInternalNotes && (
        <div className="space-y-3">
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-500" />
                <Label className="text-xs font-semibold">Photographer Notes</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPhotographerNotesOpen((v) => !v)}
              >
                {photographerNotesOpen ? 'Hide' : 'Show'}
              </Button>
            </div>
            {photographerNotesOpen && (
              <Textarea
                value={photographerNotes}
                onChange={(e) => setPhotographerNotes(e.target.value)}
                placeholder="Notes for the photographer"
                rows={2}
                className="resize-none text-xs"
              />
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-500" />
                <Label className="text-xs font-semibold">Editor Notes</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setEditorNotesOpen((v) => !v)}
              >
                {editorNotesOpen ? 'Hide' : 'Show'}
              </Button>
            </div>
            {editorNotesOpen && (
              <Textarea
                value={editorNotes}
                onChange={(e) => setEditorNotes(e.target.value)}
                placeholder="Notes for the editor"
                rows={2}
                className="resize-none text-xs"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderServicesPanel = () => (
    <div className="space-y-3 md:flex md:flex-col">
      <div className="flex flex-col rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Layers className="h-4 w-4 shrink-0 text-violet-500" />
            <p className="truncate text-xs font-semibold">Services *</p>
          </div>
          {propertySqft && (
            <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
              {propertySqft.toLocaleString()} sqft
            </Badge>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Selected services
              </div>
              <div className="mt-1 text-sm font-semibold">
                {selectedServiceRows.length} {selectedServiceRows.length === 1 ? 'item' : 'items'}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 text-xs"
              onClick={() => setServicesEditorOpen(true)}
            >
              Edit services
            </Button>
          </div>

          <div className="mt-3 space-y-1.5">
            {selectedServiceRows.length > 0 ? (
              selectedServiceRows.map(({ id, service }) => {
                const price = getServicePrice(service);
                const isVariablePricing =
                  service.pricing_type === 'variable' && service.sqft_ranges?.length;
                const showVariablePlaceholder = isVariablePricing && !propertySqft;

                return (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-2 py-1.5"
                  >
                    <span className="min-w-0 truncate text-xs font-medium">{service.name}</span>
                    <span
                      className={cn(
                        'shrink-0 text-xs font-medium',
                        isVariablePricing && propertySqft ? 'text-emerald-600' : 'text-muted-foreground',
                      )}
                    >
                      {showVariablePlaceholder ? 'Varies' : `$${price.toFixed(0)}`}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                No services selected.
              </div>
            )}
          </div>
        </div>

        <ServiceSelectionDialog
          open={servicesEditorOpen}
          onOpenChange={setServicesEditorOpen}
          services={serviceSelectionOptions}
          selectedServices={selectedServiceSelectionOptions}
          onSelectedServicesChange={handleSelectedServicesChange}
          servicesLoading={isLoading}
          effectiveSqft={propertySqft}
          allowEmptySelection={canRemoveAllServices}
        />

        {selectedServiceIds.size > 0 && (
          <div className="mt-3 space-y-1 border-t pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Base:</span>
              <span
                className={cn(
                  'font-semibold',
                  hasVariablePricingWithoutSqft ? 'text-amber-600' : '',
                )}
              >
                {hasVariablePricingWithoutSqft ? 'TBD' : `$${selectedServicesPricing.servicesTotal.toFixed(2)}`}
              </span>
            </div>
            {!hasVariablePricingWithoutSqft && selectedServicesPricing.pricing.discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{selectedServicesPricing.discountLabel}:</span>
                <span className="font-medium text-emerald-600">
                  -${selectedServicesPricing.pricing.discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            {!hasVariablePricingWithoutSqft && taxPercent > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Tax ({taxPercent > 1 ? taxPercent : (taxPercent * 100).toFixed(1)}%):
                </span>
                <span className="font-medium">${selectedServicesPricing.pricing.taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Total:</span>
              <span
                className={cn(
                  hasVariablePricingWithoutSqft ? 'text-amber-600' : 'text-emerald-600',
                )}
              >
                {hasVariablePricingWithoutSqft ? 'TBD' : `$${selectedServicesPricing.pricing.totalQuote.toFixed(2)}`}
              </span>
            </div>
            {hasVariablePricingWithoutSqft && (
              <p className="text-[10px] text-muted-foreground">
                Sqft required for accurate variable pricing.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderAssignmentsAndServicesPanel = () => (
    <div className="space-y-3">
      {renderPhotographersSection()}
      {renderServicesPanel()}
    </div>
  );

  // Photographer picker renders as a centered Dialog on desktop and a bottom
  // Drawer on mobile, matching the responsive pattern used elsewhere.

  return {
    renderDetailsPanel,
    renderServiceSchedulesSection,
    renderPhotographersSection,
    renderSchedulePanel,
    renderServicesPanel,
    renderAssignmentsAndServicesPanel,
  };
}
