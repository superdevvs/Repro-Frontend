import type { Dispatch, SetStateAction } from 'react';
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
}: OverviewPropertyLocationSectionProps) {
  const propertyMetricsGridClassName = propertyMetrics.length > 3
    ? 'grid grid-cols-2 gap-2 sm:grid-cols-4'
    : 'grid grid-cols-3 gap-2';

  return (
    <>
      <div className="p-2.5 border rounded-lg bg-card">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">
          Property details
        </div>
        {isEditMode ? (
          <div className="grid grid-cols-3 gap-2">
            {propertyMetricFields.map(({ key, label, icon: Icon, placeholder }) => (
              <div key={key} className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="text-[11px] uppercase text-muted-foreground font-semibold">{label}</div>
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
                    className="h-8 text-xs"
                  />
                </div>
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

      <div className="p-2.5 border rounded-lg bg-card">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Location</span>
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
    </>
  );
}
