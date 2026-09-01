import React from 'react';
import { ChevronDown, Home, Loader2, Save } from 'lucide-react';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatPropertyMetricValue, getBathroomMetricDisplay } from '@/utils/shootPropertyDisplay';

type ShootTourPropertySectionProps = {
  showPropertyInfo: boolean;
  open: boolean;
  onOpenChange: () => void;
  listingType: string;
  propertyStatus: string;
  setPropertyStatus: (value: string) => void;
  canEditPropertyInfo: boolean;
  isSavingPropertyStatus: boolean;
  setIsSavingPropertyStatus: (value: boolean) => void;
  propertyBedrooms: string;
  setPropertyBedrooms: (value: string) => void;
  propertyBathrooms: string;
  setPropertyBathrooms: (value: string) => void;
  propertySqft: string;
  setPropertySqft: (value: string) => void;
  isSavingPropertyDetails: boolean;
  propertyDescription: string;
  setPropertyDescription: (value: string) => void;
  isGeneratingDescription: boolean;
  isSavingDescription: boolean;
  propertyMls: string;
  setPropertyMls: (value: string) => void;
  propertyPrice: string;
  setPropertyPrice: (value: string) => void;
  propertyLotSize: string;
  setPropertyLotSize: (value: string) => void;
  sourcePropertyDescription: string;
  saveShootField: (field: string, value: string, setLoading: (value: boolean) => void) => void;
  savePropertyDetails: () => Promise<void>;
  savePropertyField: (field: string, value: string) => Promise<boolean>;
  handleGenerateDescription: () => Promise<void>;
  handleSaveDescription: () => Promise<void>;
};

const compactInputClassName = 'h-8 text-xs';

export function ShootTourPropertySection({
  showPropertyInfo,
  open,
  onOpenChange,
  listingType,
  propertyStatus,
  setPropertyStatus,
  canEditPropertyInfo,
  isSavingPropertyStatus,
  setIsSavingPropertyStatus,
  propertyBedrooms,
  setPropertyBedrooms,
  propertyBathrooms,
  setPropertyBathrooms,
  propertySqft,
  setPropertySqft,
  isSavingPropertyDetails,
  propertyDescription,
  setPropertyDescription,
  isGeneratingDescription,
  isSavingDescription,
  propertyMls,
  setPropertyMls,
  propertyPrice,
  setPropertyPrice,
  propertyLotSize,
  setPropertyLotSize,
  sourcePropertyDescription,
  saveShootField,
  savePropertyDetails,
  savePropertyField,
  handleGenerateDescription,
  handleSaveDescription,
}: ShootTourPropertySectionProps) {
  if (!showPropertyInfo) return null;

  const soldStatus = listingType === 'for_rent' ? 'rented' : 'sold';
  const propertyStatusOptions = [
    { value: 'available', label: 'Current' },
    { value: 'coming_soon', label: 'Coming Soon' },
    { value: 'pending', label: 'Pending' },
    { value: soldStatus, label: listingType === 'for_rent' ? 'Rented' : 'Sold' },
  ];
  const selectedStatusLabel = propertyStatusOptions.find((option) => option.value === propertyStatus)?.label
    ?? 'Not set';
  const bathroomDisplay = getBathroomMetricDisplay(propertyBathrooms);
  const propertySummary = [
    propertyBedrooms ? `${formatPropertyMetricValue(propertyBedrooms)} bd` : '',
    propertyBathrooms ? `${bathroomDisplay?.value ?? formatPropertyMetricValue(propertyBathrooms)} ba` : '',
    propertySqft ? `${formatPropertyMetricValue(propertySqft)} sqft` : '',
  ].filter(Boolean).join(' · ') || 'Add the details shown on public tours';

  return (
    <section
      className="overflow-hidden rounded-lg border bg-card"
      aria-labelledby="property-information-title"
      data-testid="property-information-section"
    >
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-h-[58px] w-full items-center gap-2.5 px-3 py-2 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-controls="property-information-panel"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Home className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span id="property-information-title" className="truncate text-sm font-semibold">
                  Property Information
                </span>
                <span className="h-5 shrink-0 rounded-full border border-border bg-muted/50 px-2 text-[10px] font-medium leading-[18px] text-muted-foreground">
                  {selectedStatusLabel}
                </span>
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{propertySummary}</span>
            </span>
            {(isSavingPropertyStatus || isSavingPropertyDetails || isSavingDescription) && (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Saving property information" />
            )}
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent id="property-information-panel">
          <div className="space-y-3 border-t bg-muted/10 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-[108px] items-center justify-between gap-2 sm:block">
                <Label className="text-[11px] font-medium">Listing status</Label>
                {isSavingPropertyStatus && (
                  <span className="text-[10px] text-blue-500">Saving...</span>
                )}
              </div>
              <div className="grid flex-1 grid-cols-2 gap-1 rounded-md bg-muted/60 p-1 sm:grid-cols-4">
                {propertyStatusOptions.map((option) => {
                  const isSelected = propertyStatus === option.value;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={isSelected ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        setPropertyStatus(option.value);
                        saveShootField('property_status', option.value, setIsSavingPropertyStatus);
                      }}
                      disabled={!canEditPropertyInfo || isSavingPropertyStatus}
                      className={`h-7 px-2 text-[11px] ${isSelected ? 'bg-background shadow-sm hover:bg-background' : ''}`}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-x-2.5 gap-y-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="tour-property-beds" className="text-[11px]">Beds</Label>
                <Input id="tour-property-beds" value={propertyBedrooms} onChange={(event) => setPropertyBedrooms(event.target.value)} placeholder="Bedrooms" disabled={!canEditPropertyInfo} inputMode="numeric" className={compactInputClassName} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tour-property-baths" className="text-[11px]">Baths</Label>
                <Input id="tour-property-baths" value={propertyBathrooms} onChange={(event) => setPropertyBathrooms(event.target.value)} placeholder="Bathrooms" disabled={!canEditPropertyInfo} inputMode="decimal" className={compactInputClassName} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tour-property-sqft" className="text-[11px]">Sqft</Label>
                <Input id="tour-property-sqft" value={propertySqft} onChange={(event) => setPropertySqft(event.target.value)} placeholder="Square feet" disabled={!canEditPropertyInfo} inputMode="numeric" className={compactInputClassName} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tour-property-mls" className="text-[11px]">MLS number</Label>
                <Input
                  id="tour-property-mls"
                  value={propertyMls}
                  onChange={(event) => setPropertyMls(event.target.value)}
                  onBlur={() => {
                    if (canEditPropertyInfo) void savePropertyField('property_mls', propertyMls);
                  }}
                  placeholder="MLS #"
                  disabled={!canEditPropertyInfo}
                  className={compactInputClassName}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tour-property-price" className="text-[11px]">Price</Label>
                <Input
                  id="tour-property-price"
                  value={propertyPrice}
                  onChange={(event) => setPropertyPrice(event.target.value)}
                  onBlur={() => {
                    if (canEditPropertyInfo) void savePropertyField('property_price', propertyPrice);
                  }}
                  placeholder="Property price"
                  disabled={!canEditPropertyInfo}
                  className={compactInputClassName}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tour-property-lot-size" className="text-[11px]">Lot size</Label>
                <Input
                  id="tour-property-lot-size"
                  value={propertyLotSize}
                  onChange={(event) => setPropertyLotSize(event.target.value)}
                  onBlur={() => {
                    if (canEditPropertyInfo) void savePropertyField('property_lot_size', propertyLotSize);
                  }}
                  placeholder="Lot size"
                  disabled={!canEditPropertyInfo}
                  className={compactInputClassName}
                />
              </div>
            </div>

            {canEditPropertyInfo && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => void savePropertyDetails()}
                  disabled={isSavingPropertyDetails}
                  className="h-8 px-3 text-xs"
                >
                  {isSavingPropertyDetails ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Save details
                </Button>
              </div>
            )}

            <div className="space-y-2 border-t pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label htmlFor="tour-property-description" className="text-[11px]">Description</Label>
                  <p className="text-[10px] leading-snug text-muted-foreground">Shown on public tour pages.</p>
                </div>
                {canEditPropertyInfo && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleGenerateDescription()}
                      disabled={isGeneratingDescription}
                      className="h-7 gap-1 px-2.5 text-[11px]"
                    >
                      {isGeneratingDescription ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ReproAiIcon className="h-3.5 w-3.5" />
                      )}
                      {isGeneratingDescription ? 'Generating...' : 'AI Generate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleSaveDescription()}
                      disabled={isSavingDescription || propertyDescription === sourcePropertyDescription}
                      className="h-7 gap-1 px-2.5 text-[11px]"
                    >
                      {isSavingDescription ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </div>
              <Textarea
                id="tour-property-description"
                value={propertyDescription}
                onChange={(event) => setPropertyDescription(event.target.value)}
                placeholder="Enter or generate a property description..."
                disabled={!canEditPropertyInfo}
                className="min-h-[88px] resize-y text-xs leading-relaxed"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
