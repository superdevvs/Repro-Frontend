import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Bath, BedDouble, DollarSign, FileText, Maximize, Ruler } from 'lucide-react';
import { formatTourPrice } from './tourDisplayUtils';

type PropertyDetailValue = string | number | null | undefined;

export type TourPropertyDetails = {
  beds?: PropertyDetailValue;
  bedrooms?: PropertyDetailValue;
  baths?: PropertyDetailValue;
  bathrooms?: PropertyDetailValue;
  sqft?: PropertyDetailValue;
  squareFeet?: PropertyDetailValue;
  square_feet?: PropertyDetailValue;
  price?: PropertyDetailValue;
  lot_size?: PropertyDetailValue;
  lotSize?: PropertyDetailValue;
  mls_id?: PropertyDetailValue;
  mlsId?: PropertyDetailValue;
  description?: PropertyDetailValue;
  listing_type?: PropertyDetailValue;
  listingType?: PropertyDetailValue;
  property_status?: PropertyDetailValue;
  propertyStatus?: PropertyDetailValue;
};

type PropertyInfoSummaryProps = {
  propertyDetails?: TourPropertyDetails | null;
  variant?: 'default' | 'neo';
  className?: string;
};

const getFirstFilled = (...values: PropertyDetailValue[]): string => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }

  return '';
};

const formatNumberValue = (value: string): string => {
  const normalized = value.replace(/,/g, '');
  if (!normalized || Number.isNaN(Number(normalized))) return value;
  return Number(normalized).toLocaleString();
};

const formatListingType = (value: string): string => {
  if (value === 'for_rent') return 'For Rent';
  if (value === 'for_sale') return 'For Sale';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatStatus = (value: string): string =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function PropertyInfoSummary({ propertyDetails, variant = 'default', className = '' }: PropertyInfoSummaryProps) {
  const beds = getFirstFilled(propertyDetails?.beds, propertyDetails?.bedrooms);
  const baths = getFirstFilled(propertyDetails?.baths, propertyDetails?.bathrooms);
  const sqft = getFirstFilled(propertyDetails?.sqft, propertyDetails?.squareFeet, propertyDetails?.square_feet);
  const price = formatTourPrice(getFirstFilled(propertyDetails?.price));
  const lotSize = getFirstFilled(propertyDetails?.lot_size, propertyDetails?.lotSize);
  const mls = getFirstFilled(propertyDetails?.mls_id, propertyDetails?.mlsId);
  const description = getFirstFilled(propertyDetails?.description);
  const listingType = getFirstFilled(propertyDetails?.listing_type, propertyDetails?.listingType);
  const status = getFirstFilled(propertyDetails?.property_status, propertyDetails?.propertyStatus);

  const stats = [
    beds ? { label: 'Beds', value: beds, icon: BedDouble } : null,
    baths ? { label: 'Baths', value: baths, icon: Bath } : null,
    sqft ? { label: 'Square Feet', value: formatNumberValue(sqft), icon: Maximize } : null,
    lotSize ? { label: 'Lot Size', value: lotSize, icon: Ruler } : null,
    mls ? { label: 'MLS', value: mls, icon: FileText } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; icon: React.ComponentType<{ className?: string }> }>;

  if (!stats.length && !price && !description && !listingType && !status) {
    return null;
  }

  if (variant === 'neo') {
    return (
      <section className={`px-6 py-14 bg-slate-950 border-b border-blue-500/20 ${className}`}>
        <div className="max-w-7xl mx-auto rounded-3xl border border-blue-500/20 bg-slate-900/70 p-6 md:p-8 shadow-2xl shadow-blue-950/20">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {listingType && <Badge variant="outline" className="border-blue-400/50 text-blue-200">{formatListingType(listingType)}</Badge>}
            {status && status !== 'available' && <Badge variant="outline" className="border-blue-400/50 text-blue-200">{formatStatus(status)}</Badge>}
          </div>
          {description && <p className="text-base md:text-lg leading-relaxed text-slate-200 whitespace-pre-line mb-6">{description}</p>}
          {price && (
            <div className="mb-5 rounded-3xl border border-blue-400/30 bg-blue-500/10 p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-blue-200 font-semibold">List Price</div>
                  <div className="mt-1 text-2xl md:text-4xl font-extrabold text-white">{price}</div>
                </div>
              </div>
            </div>
          )}
          {stats.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {stats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-blue-500/20 bg-slate-950/60 p-4">
                  <Icon className="h-4 w-4 text-blue-400 mb-2" />
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
                  <div className="mt-1 text-sm md:text-base font-bold text-white break-words">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={`max-w-6xl mx-auto px-4 md:px-6 mt-6 md:mt-8 ${className}`}>
      <div className="rounded-3xl border border-border/40 bg-card p-5 md:p-7 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {listingType && <Badge variant="secondary">{formatListingType(listingType)}</Badge>}
          {status && status !== 'available' && <Badge variant="outline">{formatStatus(status)}</Badge>}
        </div>
        {description && <p className="text-sm md:text-base leading-relaxed text-muted-foreground whitespace-pre-line mb-5">{description}</p>}
        {price && (
          <div className="mb-5 rounded-3xl border border-primary/20 bg-primary/5 p-5 md:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">List Price</div>
                <div className="mt-1 text-2xl md:text-4xl font-extrabold text-foreground">{price}</div>
              </div>
            </div>
          </div>
        )}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-border/40 bg-background/60 p-4">
                <Icon className="h-4 w-4 text-muted-foreground mb-2" />
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
                <div className="mt-1 text-sm md:text-base font-bold text-foreground break-words">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
