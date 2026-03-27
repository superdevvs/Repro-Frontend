import React, { useMemo, useState } from 'react';
import { AlertCircle, Database, Home, Search } from 'lucide-react';
import AddressLookupField, { type AddressDetails } from '@/components/AddressLookupField';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type FieldDescriptor = {
  key: keyof AddressDetails;
  label: string;
};

const trackedFields: FieldDescriptor[] = [
  { key: 'formatted_address', label: 'Formatted Address' },
  { key: 'address', label: 'Street Address' },
  { key: 'apt_suite', label: 'Apt / Suite' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP' },
  { key: 'country', label: 'Country' },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' },
  { key: 'bedrooms', label: 'Bedrooms' },
  { key: 'bathrooms', label: 'Bathrooms' },
  { key: 'sqft', label: 'Square Feet' },
  { key: 'garage_cars', label: 'Garage Cars' },
  { key: 'garage_sqft', label: 'Garage Sqft' },
  { key: 'zpid', label: 'Property ID' },
  { key: 'source', label: 'Lookup Source' },
  { key: 'confidence', label: 'Lookup Confidence' },
  { key: 'override_applied', label: 'Manual Override Applied' },
];

const isEmptyValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (typeof value === 'number' && Number.isNaN(value));

const formatValue = (value: unknown) => {
  if (isEmptyValue(value)) {
    return 'Empty';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toString();
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
};

const normalizeNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const SummaryStat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-md border bg-background px-3 py-2">
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 text-sm font-semibold">{value}</div>
  </div>
);

const formatSourceLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizePayload = (value: unknown): Record<string, any> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, any>;
};

const pickRawPayload = (
  sources: Array<Record<string, any> | null | undefined>,
  keys: string[],
): Record<string, any> | null => {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const key of keys) {
      const candidate = normalizePayload(source[key]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
};

const renderPayloadHint = (payload: Record<string, any> | null, label: string) => {
  if (payload) {
    return (
      <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-900">
        {label}: available
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-dashed">
      {label}: not exposed
    </Badge>
  );
};

const DetailRow = ({ label, value, accentEmpty = false }: { label: string; value: unknown; accentEmpty?: boolean }) => {
  const empty = isEmptyValue(value);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={empty && accentEmpty ? 'font-medium text-amber-700' : 'font-medium'}>
        {formatValue(value)}
      </span>
    </div>
  );
};

export const AddressLookupTester: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<AddressDetails | null>(null);

  const inspectedFields = useMemo(
    () =>
      trackedFields.map((field) => ({
        ...field,
        value: selectedAddress?.[field.key],
        empty: isEmptyValue(selectedAddress?.[field.key]),
      })),
    [selectedAddress]
  );

  const emptyFields = inspectedFields.filter((field) => field.empty);
  const filledFields = inspectedFields.filter((field) => !field.empty);
  const propertyDetails = selectedAddress?.property_details ?? {};
  const rawParcelPayload = pickRawPayload(
    [selectedAddress as Record<string, any> | null, propertyDetails],
    [
      'raw_parcel_data',
      'parcel_data',
      'parcelDetails',
      'parcel_details',
      'raw_parcel',
      'parcel',
      'bridge_parcel',
    ],
  );
  const rawAssessmentPayload = pickRawPayload(
    [selectedAddress as Record<string, any> | null, propertyDetails],
    [
      'raw_assessment_data',
      'assessment_data',
      'assessmentDetails',
      'assessment_details',
      'raw_assessment',
      'assessment',
      'bridge_assessment',
    ],
  );
  const rawLegacyPayload = pickRawPayload(
    [selectedAddress as Record<string, any> | null, propertyDetails],
    ['raw_legacy_data', 'raw_legacy_lookup', 'legacy_lookup'],
  );
  const manualOverridePayload = pickRawPayload(
    [selectedAddress as Record<string, any> | null, propertyDetails],
    ['manual_override', 'raw_manual_override'],
  );
  const areas = Array.isArray(propertyDetails?.areas) ? propertyDetails.areas : [];
  const building = Array.isArray(propertyDetails?.building)
    ? propertyDetails.building[0] ?? null
    : propertyDetails?.building ?? null;
  const garages = Array.isArray(propertyDetails?.garages) ? propertyDetails.garages : [];
  const propertySourceChain = Array.isArray(selectedAddress?.property_source_chain)
    ? selectedAddress.property_source_chain
    : [];
  const fieldSources = selectedAddress?.field_sources ?? {};

  const sqftInventory = useMemo(() => {
    const entries: Array<{ label: string; value: unknown }> = [];

    if (selectedAddress) {
      entries.push({ label: 'Fetched sqft used in Book Shoot', value: selectedAddress.sqft });
      entries.push({ label: 'Fetched garage sqft', value: selectedAddress.garage_sqft });
    }

    entries.push({ label: 'Parcel lotSizeSquareFeet', value: propertyDetails?.lotSizeSquareFeet });
    entries.push({ label: 'Parcel lotSizeAcres', value: propertyDetails?.lotSizeAcres });

    areas.forEach((area: Record<string, unknown>, index: number) => {
      entries.push({
        label: `Area ${index + 1}: ${String(area.type ?? 'Unknown Type')}`,
        value: area.areaSquareFeet,
      });
    });

    garages.forEach((garage: Record<string, unknown>, index: number) => {
      entries.push({
        label: `Garage ${index + 1}: ${String(garage.type ?? 'Unknown Type')}`,
        value: garage.areaSquareFeet,
      });
    });

    return entries.filter((entry) => !isEmptyValue(entry.value));
  }, [areas, garages, propertyDetails, selectedAddress]);

  const garageSqftTotal = useMemo(
    () =>
      garages.reduce((sum: number, garage: Record<string, unknown>) => {
        const sqft = normalizeNumber(garage.areaSquareFeet);
        return sqft ? sum + sqft : sum;
      }, 0),
    [garages]
  );

  const mergedPayload = useMemo(
    () =>
      selectedAddress
        ? {
            ...selectedAddress,
            property_details: selectedAddress.property_details,
          }
        : null,
    [selectedAddress]
  );

  const summaryStats = [
    { label: 'Filled fields', value: filledFields.length },
    { label: 'Empty fields', value: emptyFields.length },
    { label: 'Sqft values found', value: sqftInventory.length },
    { label: 'Area rows', value: areas.length },
    { label: 'Raw parcel', value: rawParcelPayload ? 'Available' : 'Missing' },
    { label: 'Raw assessment', value: rawAssessmentPayload ? 'Available' : 'Missing' },
    { label: 'Manual override', value: manualOverridePayload ? 'Available' : 'Missing' },
  ];

  return (
    <div className="space-y-4 rounded-lg border border-dashed bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Search className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Address Data Tester</h3>
          <p className="text-xs text-muted-foreground">
            Search with the same Book Shoot address flow, then expand the sections below to inspect fetched values, available sqft rows, and raw Bridge payloads.
          </p>
        </div>
      </div>

      <AddressLookupField
        value={searchValue}
        onChange={setSearchValue}
        onAddressSelect={setSelectedAddress}
        placeholder="Search an address to inspect Zillow and parcel data..."
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">Book Shoot fields: {filledFields.length}</Badge>
        <Badge variant="outline">Empty: {emptyFields.length}</Badge>
        <Badge variant="outline">Areas: {areas.length}</Badge>
        <Badge variant="outline">Garages: {garages.length}</Badge>
        <Badge variant="outline">Sqft values: {sqftInventory.length}</Badge>
      </div>

      {!selectedAddress && (
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-3 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Select an address to compare what users get versus what the raw property payload contains.
        </div>
      )}

      {selectedAddress && (
        <>
          <div className="rounded-md border bg-background px-3 py-3 text-sm">
            <div className="font-medium">{selectedAddress.formatted_address || selectedAddress.address}</div>
            <div className="mt-1 text-muted-foreground">
              Quick summary stays visible here. Expand the sections below for the full payload and all sqft rows.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedAddress.source && (
                <Badge variant="secondary">Source: {formatSourceLabel(selectedAddress.source)}</Badge>
              )}
              {selectedAddress.confidence !== undefined && (
                <Badge variant="outline">
                  Confidence: {Math.round((selectedAddress.confidence || 0) * 100)}%
                </Badge>
              )}
              {propertySourceChain
                .filter((source) => source !== selectedAddress.source)
                .map((source) => (
                  <Badge key={source} variant="outline">
                    {formatSourceLabel(source)}
                  </Badge>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {renderPayloadHint(rawParcelPayload, 'Raw parcel')}
              {renderPayloadHint(rawAssessmentPayload, 'Raw assessment')}
              {renderPayloadHint(rawLegacyPayload, 'Legacy fallback')}
              {renderPayloadHint(manualOverridePayload, 'Manual override')}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summaryStats.map((stat) => (
              <SummaryStat key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2 rounded-md border bg-background p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Home className="h-4 w-4 text-primary" />
                Quick user-facing values
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['Bedrooms', selectedAddress.bedrooms],
                  ['Bathrooms', selectedAddress.bathrooms],
                  ['Sqft', selectedAddress.sqft],
                  ['Garage Cars', selectedAddress.garage_cars],
                  ['Garage Sqft', selectedAddress.garage_sqft],
                  ['Property ID', selectedAddress.zpid],
                ].map(([label, value]) => (
                  <DetailRow key={String(label)} label={String(label)} value={value} accentEmpty />
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-md border bg-background p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Empty user-facing fields
              </div>
              {emptyFields.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {emptyFields.map((field) => (
                    <Badge key={field.key} variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
                      {field.label}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  All tracked Book Shoot fields are populated.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchValue('');
                setSelectedAddress(null);
              }}
            >
              Clear Tester
            </Button>
          </div>

          <Accordion type="multiple" className="rounded-md border bg-background px-4">
            <AccordionItem value="fields">
              <AccordionTrigger className="text-sm">Book Shoot Fields</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-2 lg:grid-cols-2">
                  {inspectedFields.map((field) => (
                    <DetailRow key={field.key} label={field.label} value={field.value} accentEmpty />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sqft">
              <AccordionTrigger className="text-sm">All Available Sqft</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {sqftInventory.length > 0 ? (
                    <>
                      {sqftInventory.map((entry) => (
                        <DetailRow key={entry.label} label={entry.label} value={entry.value} />
                      ))}
                      <DetailRow label="Garage area total from rows" value={garageSqftTotal > 0 ? garageSqftTotal : null} />
                    </>
                  ) : (
                    <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                      No square-footage values were found in the selected payload.
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="areas">
              <AccordionTrigger className="text-sm">Area And Building Details</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Area Breakdown</div>
                    {areas.length > 0 ? (
                      areas.map((area: Record<string, unknown>, index: number) => (
                        <DetailRow
                          key={`${String(area.type ?? 'area')}-${index}`}
                          label={String(area.type ?? `Area ${index + 1}`)}
                          value={area.areaSquareFeet}
                        />
                      ))
                    ) : (
                      <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                        No area rows were returned for this property.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Database className="h-3.5 w-3.5" />
                      Building Snapshot
                    </div>
                    {[
                      ['Year Built', building?.yearBuilt],
                      ['Bedrooms', building?.bedrooms],
                      ['Full Baths', building?.fullBaths],
                      ['Half Baths', building?.halfBaths],
                      ['Three Quarter Baths', building?.threeQuarterBaths],
                      ['Quarter Baths', building?.quarterBaths],
                      ['Total Stories', building?.totalStories],
                      ['Garage Count Rows', garages.length],
                    ].map(([label, value]) => (
                      <DetailRow key={String(label)} label={String(label)} value={value} />
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sources">
              <AccordionTrigger className="text-sm">Field Sources</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {Object.keys(fieldSources).length > 0 ? (
                    Object.entries(fieldSources).map(([field, source]) => (
                      <DetailRow key={field} label={field} value={formatSourceLabel(source)} />
                    ))
                  ) : (
                    <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                      No field-level source metadata is available for this property.
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="merged">
              <AccordionTrigger className="text-sm">Raw Merged User Payload</AccordionTrigger>
              <AccordionContent>
                <div className="max-h-[28rem] overflow-auto rounded-md border bg-slate-950 p-4 text-xs text-slate-100">
                  <pre>{JSON.stringify(mergedPayload, null, 2)}</pre>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="property">
              <AccordionTrigger className="text-sm">Raw Property Payload</AccordionTrigger>
              <AccordionContent>
                <div className="max-h-[32rem] overflow-auto rounded-md border bg-slate-950 p-4 text-xs text-slate-100">
                  <pre>{JSON.stringify(propertyDetails, null, 2)}</pre>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="parcel">
              <AccordionTrigger className="text-sm">Raw Parcel Payload</AccordionTrigger>
              <AccordionContent>
                {rawParcelPayload ? (
                  <div className="max-h-[32rem] overflow-auto rounded-md border bg-slate-950 p-4 text-xs text-slate-100">
                    <pre>{JSON.stringify(rawParcelPayload, null, 2)}</pre>
                  </div>
                ) : (
                  <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    Separate parcel payload is not exposed by the current response shape.
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="assessment">
              <AccordionTrigger className="text-sm">Raw Assessment Payload</AccordionTrigger>
              <AccordionContent>
                {rawAssessmentPayload ? (
                  <div className="max-h-[32rem] overflow-auto rounded-md border bg-slate-950 p-4 text-xs text-slate-100">
                    <pre>{JSON.stringify(rawAssessmentPayload, null, 2)}</pre>
                  </div>
                ) : (
                  <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    Separate assessment payload is not exposed by the current response shape.
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="legacy">
              <AccordionTrigger className="text-sm">Raw Legacy Payload</AccordionTrigger>
              <AccordionContent>
                {rawLegacyPayload ? (
                  <div className="max-h-[32rem] overflow-auto rounded-md border bg-slate-950 p-4 text-xs text-slate-100">
                    <pre>{JSON.stringify(rawLegacyPayload, null, 2)}</pre>
                  </div>
                ) : (
                  <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    Separate legacy fallback payload is not exposed by the current response shape.
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="override">
              <AccordionTrigger className="text-sm">Manual Override Payload</AccordionTrigger>
              <AccordionContent>
                {manualOverridePayload ? (
                  <div className="max-h-[32rem] overflow-auto rounded-md border bg-slate-950 p-4 text-xs text-slate-100">
                    <pre>{JSON.stringify(manualOverridePayload, null, 2)}</pre>
                  </div>
                ) : (
                  <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    No manual override matched this address.
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  );
};

export default AddressLookupTester;
