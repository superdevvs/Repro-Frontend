import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { BedDouble, MapPinIcon, Ruler, ShowerHead } from 'lucide-react';
import AddressLookupField from '@/components/AddressLookupField';
import { Input } from '@/components/ui/input';
import { ShootData } from '@/types/shoots';

type PropertyMetricsEdit = {
  beds: string;
  baths: string;
  sqft: string;
};

type PropertyMetric = {
  label: string;
  icon: typeof BedDouble;
  value: string;
};

type OverviewPropertyLocationSectionProps = {
  isEditMode: boolean;
  propertyMetrics: PropertyMetric[];
  propertyMetricsEdit: PropertyMetricsEdit;
  setPropertyMetricsEdit: Dispatch<SetStateAction<PropertyMetricsEdit>>;
  addressInput: string;
  setAddressInput: (value: string) => void;
  editedShoot: Partial<ShootData>;
  shoot: ShootData;
  updateField: (field: string, value: unknown) => void;
  clearAddressDerivedState: (options?: { keepAddressInput?: boolean }) => void;
  handleAddressSelect: (details: unknown) => void;
  getLocationAddress: () => string;
  locationDetails: {
    city?: string;
    state?: string;
    zip?: string;
  };
  hasWeatherDetails: boolean;
  formattedTemperature: string | null;
  weatherDescription: string | null;
  weatherIcon: ReactNode;
  /**
   * Optional content rendered to the right of the Property Details card on the
   * same row (desktop). Used to place Property Access beside Property Details
   * in a ~60/40 split. When omitted, Property Details spans full width.
   */
  rightSlot?: ReactNode;
};

const propertyMetricFields: Array<{
  key: keyof PropertyMetricsEdit;
  label: string;
  icon: typeof BedDouble;
  placeholder: string;
}> = [
  { key: 'beds', label: 'Beds', icon: BedDouble, placeholder: '0' },
  { key: 'baths', label: 'Baths', icon: ShowerHead, placeholder: '0' },
  { key: 'sqft', label: 'Sqft', icon: Ruler, placeholder: '0' },
];

export function OverviewPropertyLocationSection({
  isEditMode,
  propertyMetrics,
  propertyMetricsEdit,
  setPropertyMetricsEdit,
  addressInput,
  setAddressInput,
  editedShoot,
  shoot,
  updateField,
  clearAddressDerivedState,
  handleAddressSelect,
  getLocationAddress,
  locationDetails,
  hasWeatherDetails,
  formattedTemperature,
  weatherDescription,
  weatherIcon,
  rightSlot,
}: OverviewPropertyLocationSectionProps) {
  const propertyMetricsGridClassName = propertyMetrics.length > 3
    ? 'grid grid-cols-2 gap-2 sm:grid-cols-4'
    : 'grid grid-cols-3 gap-2';

  const propertyDetailsCard = (
    <div className="p-2.5 border rounded-lg bg-card h-full">
      <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">
        Property details
      </div>
        {isEditMode ? (
          <div className="flex flex-col gap-2">
            {propertyMetricFields.map(({ key, label, placeholder }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-[11px] uppercase text-muted-foreground font-semibold">{label}</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={propertyMetricsEdit[key]}
                  onChange={(event) =>
                    setPropertyMetricsEdit((previous) => ({
                      ...previous,
                      [key]: event.target.value,
                    }))
                  }
                  placeholder={placeholder}
                  className="h-8 w-24 text-xs"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className={propertyMetricsGridClassName}>
            {propertyMetrics.map(({ label, icon: Icon, value }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground font-semibold">{label}</div>
                  <div className="text-xs font-medium">{value}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );

  const locationCard = (
      <div className="p-2.5 border rounded-lg bg-card">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-1.5">
            <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Location</span>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            {weatherIcon}
            {hasWeatherDetails ? (
              <div className="flex items-center gap-1.5">
                {formattedTemperature && <span className="text-xs font-medium">{formattedTemperature}</span>}
                {weatherDescription && (
                  <span className="text-xs text-muted-foreground capitalize">{weatherDescription}</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No data</span>
            )}
          </div>
        </div>
            {isEditMode ? (
              <div className="space-y-1.5 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Address:</span>
                  <AddressLookupField
                    value={addressInput}
                    onChange={(value) => {
                      setAddressInput(value);
                      updateField('location.address', value);
                    }}
                    onSelectionReset={() => {
                      clearAddressDerivedState();
                    }}
                    onSelectionStarted={() => {
                      clearAddressDerivedState({ keepAddressInput: false });
                    }}
                    onAddressSelect={handleAddressSelect as any}
                    className="text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">City:</span>
                    <Input
                      type="text"
                      value={editedShoot.location?.city || shoot.location?.city || ''}
                      onChange={(event) => updateField('location.city', event.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">State:</span>
                    <Input
                      type="text"
                      maxLength={2}
                      value={editedShoot.location?.state || shoot.location?.state || ''}
                      onChange={(event) => updateField('location.state', event.target.value.toUpperCase())}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">ZIP:</span>
                  <Input
                    type="text"
                    value={editedShoot.location?.zip || shoot.location?.zip || ''}
                    onChange={(event) => updateField('location.zip', event.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs">
                <div className="font-medium truncate">{getLocationAddress()}</div>
                <div className="text-muted-foreground mt-0.5 truncate">
                  {[locationDetails.city, locationDetails.state, locationDetails.zip].filter(Boolean).join(', ') || 'Not set'}
                </div>
              </div>
            )}
      </div>
  );

  return (
    <>
      {rightSlot ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-stretch">
          <div className="md:col-span-3 min-w-0">{propertyDetailsCard}</div>
          <div className="md:col-span-2 min-w-0">{rightSlot}</div>
        </div>
      ) : (
        propertyDetailsCard
      )}
      {locationCard}
    </>
  );
}
