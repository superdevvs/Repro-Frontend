import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ReproAiIcon } from '@/components/icons/ReproAiIcon'
import {
  Bath,
  BedDouble,
  ChevronDown,
  ChevronUp,
  Loader2,
  Ruler,
  Save,
} from 'lucide-react'
import { formatPropertyMetricValue, getSplitBathroomDisplay } from '@/utils/shootPropertyDisplay'

type ShootTourPropertySectionProps = {
  showPropertyInfo: boolean
  open: boolean
  onOpenChange: () => void
  listingType: string
  setListingType: (value: string) => void
  propertyStatus: string
  setPropertyStatus: (value: string) => void
  canEditPropertyInfo: boolean
  isSavingListingType: boolean
  setIsSavingListingType: (value: boolean) => void
  isSavingPropertyStatus: boolean
  setIsSavingPropertyStatus: (value: boolean) => void
  propertyBedrooms: string
  setPropertyBedrooms: (value: string) => void
  propertyBathrooms: string
  setPropertyBathrooms: (value: string) => void
  propertySqft: string
  setPropertySqft: (value: string) => void
  isSavingPropertyDetails: boolean
  propertyDescription: string
  setPropertyDescription: (value: string) => void
  isGeneratingDescription: boolean
  isSavingDescription: boolean
  propertyMls: string
  setPropertyMls: (value: string) => void
  propertyPrice: string
  setPropertyPrice: (value: string) => void
  propertyLotSize: string
  setPropertyLotSize: (value: string) => void
  sourcePropertyDescription: string
  saveShootField: (field: string, value: string, setLoading: (value: boolean) => void) => void
  savePropertyDetails: () => Promise<void>
  savePropertyField: (field: string, value: string) => Promise<void>
  handleGenerateDescription: () => Promise<void>
  handleSaveDescription: () => Promise<void>
}

export function ShootTourPropertySection({
  showPropertyInfo,
  open,
  onOpenChange,
  listingType,
  setListingType,
  propertyStatus,
  setPropertyStatus,
  canEditPropertyInfo,
  isSavingListingType,
  setIsSavingListingType,
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
  if (!showPropertyInfo) return null

  const splitBathroomDisplay = getSplitBathroomDisplay(propertyBathrooms)
  const propertyDetailCards = [
    {
      label: 'Beds',
      icon: BedDouble,
      value: formatPropertyMetricValue(propertyBedrooms),
    },
    ...(splitBathroomDisplay
      ? [
          {
            label: 'Full Baths',
            icon: Bath,
            value: splitBathroomDisplay.fullBaths,
          },
          {
            label: 'Half Baths',
            icon: Bath,
            value: splitBathroomDisplay.halfBaths,
          },
        ]
      : [
          {
            label: 'Baths',
            icon: Bath,
            value: formatPropertyMetricValue(propertyBathrooms),
          },
        ]),
    {
      label: 'Sqft',
      icon: Ruler,
      value: formatPropertyMetricValue(propertySqft),
    },
  ]
  const propertyDetailsGridClassName = propertyDetailCards.length > 3
    ? 'grid gap-3 sm:grid-cols-4'
    : 'grid gap-3 sm:grid-cols-3'

  return (
    <Card>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Property Information</CardTitle>
                <CardDescription>Property details for tour display</CardDescription>
              </div>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Listing Type</Label>
              <Select
                value={listingType || 'for_sale'}
                onValueChange={(value) => {
                  setListingType(value)
                  saveShootField('listing_type', value, setIsSavingListingType)
                }}
                disabled={!canEditPropertyInfo || isSavingListingType}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select listing type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="for_sale">For Sale</SelectItem>
                  <SelectItem value="for_rent">For Rent</SelectItem>
                </SelectContent>
              </Select>
              {isSavingListingType && <p className="text-xs text-blue-500">Saving...</p>}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <Label>{listingType === 'for_rent' ? 'Mark as Rented' : 'Mark as Sold'}</Label>
                <p className="text-xs text-muted-foreground">
                  {listingType === 'for_rent' ? 'Toggle when property has been rented.' : 'Toggle when property has been sold.'}
                </p>
              </div>
              <Switch
                checked={propertyStatus === 'sold' || propertyStatus === 'rented'}
                onCheckedChange={(checked) => {
                  const newStatus = checked ? (listingType === 'for_rent' ? 'rented' : 'sold') : 'available'
                  setPropertyStatus(newStatus)
                  saveShootField('property_status', newStatus, setIsSavingPropertyStatus)
                }}
                disabled={!canEditPropertyInfo || isSavingPropertyStatus}
              />
            </div>
            {isSavingPropertyStatus && <p className="text-xs text-blue-500">Saving status...</p>}

            <Separator />

            <div className="space-y-3">
              <Label>Property Details</Label>
              <div className={propertyDetailsGridClassName}>
                {propertyDetailCards.map(({ label, icon: Icon, value }) => (
                  <div key={label} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/80">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="text-xl font-semibold">{value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Beds</Label>
                <Input value={propertyBedrooms} onChange={(e) => setPropertyBedrooms(e.target.value)} placeholder="Bedrooms" disabled={!canEditPropertyInfo} inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label>Baths</Label>
                <Input value={propertyBathrooms} onChange={(e) => setPropertyBathrooms(e.target.value)} placeholder="Bathrooms" disabled={!canEditPropertyInfo} inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label>Sqft</Label>
                <Input value={propertySqft} onChange={(e) => setPropertySqft(e.target.value)} placeholder="Square feet" disabled={!canEditPropertyInfo} inputMode="numeric" />
              </div>
            </div>

            {canEditPropertyInfo && (
              <div className="flex justify-end">
                <Button variant="default" size="sm" onClick={() => void savePropertyDetails()} disabled={isSavingPropertyDetails} className="h-8 px-3 text-xs">
                  {isSavingPropertyDetails ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <div className="relative">
                <Textarea
                  value={propertyDescription}
                  onChange={(e) => setPropertyDescription(e.target.value)}
                  placeholder="Enter or generate a property description..."
                  disabled={!canEditPropertyInfo}
                  className="min-h-[120px] pb-12 text-sm"
                />
                {canEditPropertyInfo && (
                  <div className="absolute bottom-2 left-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleGenerateDescription()}
                      disabled={isGeneratingDescription}
                      className="h-7 px-2.5 text-[11px] gap-1 bg-background/80 backdrop-blur-sm border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                    >
                      {isGeneratingDescription ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <ReproAiIcon className="h-3.5 w-3.5" />
                          AI Generate
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
              {canEditPropertyInfo && (
                <div className="flex justify-end">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => void handleSaveDescription()}
                    disabled={isSavingDescription || propertyDescription === sourcePropertyDescription}
                    className="h-8 px-3 text-xs"
                  >
                    {isSavingDescription ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              )}
              {isSavingDescription && <p className="text-xs text-blue-500">Saving...</p>}
              <p className="text-xs text-muted-foreground">
                Property description displayed on tour pages. Use AI Generate to auto-create from edited photos.
              </p>
            </div>

            <div className="space-y-2">
              <Label>MLS Number</Label>
              <Input
                value={propertyMls}
                onChange={(e) => setPropertyMls(e.target.value)}
                onBlur={() => {
                  if (canEditPropertyInfo) void savePropertyField('property_mls', propertyMls)
                }}
                placeholder="MLS #"
                disabled={!canEditPropertyInfo}
              />
            </div>

            <div className="space-y-2">
              <Label>Price</Label>
              <Input
                value={propertyPrice}
                onChange={(e) => setPropertyPrice(e.target.value)}
                onBlur={() => {
                  if (canEditPropertyInfo) void savePropertyField('property_price', propertyPrice)
                }}
                placeholder="Property price"
                disabled={!canEditPropertyInfo}
              />
            </div>

            <div className="space-y-2">
              <Label>Lot Size</Label>
              <Input
                value={propertyLotSize}
                onChange={(e) => setPropertyLotSize(e.target.value)}
                onBlur={() => {
                  if (canEditPropertyInfo) void savePropertyField('property_lot_size', propertyLotSize)
                }}
                placeholder="Lot size"
                disabled={!canEditPropertyInfo}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
