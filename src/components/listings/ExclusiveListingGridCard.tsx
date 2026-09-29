import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Lock, ExternalLink } from 'lucide-react';
import { getBathroomMetricDisplay } from '@/utils/shootPropertyDisplay';
import {
  formatListingPrice,
  resolveListingPreviewUrl,
} from '@/utils/privateListings';
import styles from '@/pages/PrivateListingPortal.module.css';

/** Shared listing shape for grid cards and the map Featured Listing panel. */
export type ExclusiveListingCardData = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  heroImage?: string;
  client: { name: string; email?: string };
  isListingHidden: boolean;
  listing_type?: 'for_sale' | 'for_rent';
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  price?: number;
};

export const ExclusiveListingGridCard = ({
  listing,
  onOpen,
  selectionMode = false,
  selected = false,
  canManageVisibility = false,
  savingVisibility = false,
  onToggleSelect,
  onUnhide,
  className = '',
  /** Narrower map Featured panel: smaller address, metrics that stay fully visible. */
  density = 'default',
}: {
  listing: ExclusiveListingCardData;
  onOpen: (listing: ExclusiveListingCardData) => void;
  selectionMode?: boolean;
  selected?: boolean;
  canManageVisibility?: boolean;
  savingVisibility?: boolean;
  onToggleSelect?: (listing: ExclusiveListingCardData) => void;
  onUnhide?: (listing: ExclusiveListingCardData) => void;
  className?: string;
  density?: 'default' | 'map';
}) => {
  const heroUrl = resolveListingPreviewUrl(listing.heroImage) || '/placeholder.svg';
  const bathroomDisplay = getBathroomMetricDisplay(listing.bathrooms);
  const metrics = [
    listing.sqft
      ? {
          value: listing.sqft.toLocaleString(),
          label: 'Sq Ft',
        }
      : null,
    listing.bedrooms
      ? {
          value: String(listing.bedrooms),
          label: listing.bedrooms === 1 ? 'Bedroom' : 'Bedrooms',
        }
      : null,
    bathroomDisplay
      ? {
          value: bathroomDisplay.value,
          label: bathroomDisplay.label,
        }
      : null,
  ].filter(Boolean) as Array<{ value: string; label: string }>;

  const location = [listing.city, listing.state].filter(Boolean).join(', ');
  const locationLine = [location, listing.zip].filter(Boolean).join(' ');
  const listingTypeLabel =
    listing.listing_type === 'for_rent'
      ? 'For Rent'
      : listing.listing_type === 'for_sale'
        ? 'For Sale'
        : null;
  const isHidden = listing.isListingHidden;
  const handleClick = () => {
    if (selectionMode) {
      if (!isHidden) onToggleSelect?.(listing);
      return;
    }
    onOpen(listing);
  };

  const selectedChrome =
    selected && !selectionMode
      ? 'border-blue-500 ring-1 ring-blue-500/20'
      : 'border-0';
  const isMapDensity = density === 'map';

  return (
    <Card
      key={listing.id}
      data-listing-id={listing.id}
      data-selected={selected ? 'true' : 'false'}
      className={`group cursor-pointer overflow-hidden rounded-[30px] bg-transparent text-white transition-all duration-300 hover:-translate-y-1 ${selectedChrome} ${isHidden ? 'opacity-70' : ''} ${className}`.trim()}
      onClick={handleClick}
      style={{
        boxShadow: '0 26px 56px -36px rgba(6, 10, 14, 0.38)',
      }}
    >
      <div className={`relative aspect-[10/11] overflow-hidden rounded-[30px] bg-white dark:bg-[#060a0e] ${isMapDensity ? 'min-h-[280px]' : 'min-h-[320px]'}`}>
        <img
          src={heroUrl}
          alt={listing.address}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent" />
        <div className={`absolute inset-0 ${styles.listingOverlay}`} />
        <div className={`absolute inset-x-0 bottom-0 h-[52%] ${styles.listingFloor}`} />

        <div className={`relative flex h-full flex-col ${isMapDensity ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {selectionMode && !isHidden && (
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/80 text-xs font-bold ${
                    selected ? 'bg-white text-slate-900' : 'bg-black/25 text-white'
                  }`}
                >
                  {selected ? '✓' : ''}
                </span>
              )}
              <Badge
                variant="outline"
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-[0.02em] shadow-sm ${
                  isHidden
                    ? 'border-amber-200 bg-amber-100 text-amber-900'
                    : 'border-slate-900/15 bg-white/85 text-slate-900 backdrop-blur-sm dark:border-white/40 dark:bg-white/15 dark:text-white'
                }`}
              >
                <Lock className="mr-1.5 h-3 w-3" />
                {isHidden ? 'Hidden Listing' : 'Exclusive Listing'}
              </Badge>
            </div>
            {isHidden && canManageVisibility ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 rounded-full px-3 text-xs"
                disabled={savingVisibility}
                onClick={(event) => {
                  event.stopPropagation();
                  onUnhide?.(listing);
                }}
              >
                Unhide
              </Button>
            ) : selectionMode ? (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-black/25 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white shadow-sm">
                <span>{selected ? 'Selected' : 'Select'}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#8fc2ff] bg-[#79b3ff] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white shadow-sm transition-colors duration-300 group-hover:bg-[#5ea4ff]">
                <span>Open</span>
                <ExternalLink className="h-3 w-3" />
              </div>
            )}
          </div>

          <div className={`mt-auto ${isMapDensity ? 'space-y-3' : 'space-y-4'}`}>
            {listing.price && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-700/70 dark:text-white/60">
                  List Price
                </p>
                <p className={`${isMapDensity ? 'text-[1.45rem]' : 'text-[1.95rem]'} font-semibold leading-none tracking-[-0.05em] text-slate-900 dark:text-white`}>
                  {formatListingPrice(listing.price)}
                </p>
              </div>
            )}

            <div className="space-y-1.5 [text-shadow:none] dark:[text-shadow:0_2px_14px_rgba(0,0,0,0.38),0_1px_3px_rgba(0,0,0,0.7)]">
              <h3
                className={
                  isMapDensity
                    ? 'max-w-full text-base font-semibold leading-snug tracking-[-0.03em] text-slate-900 dark:text-white sm:text-lg'
                    : 'max-w-[18ch] text-xl font-semibold leading-tight tracking-[-0.04em] text-slate-900 dark:text-white sm:text-[1.6rem]'
                }
              >
                {listing.address}
              </h3>
              {locationLine && (
                <p
                  className={
                    isMapDensity
                      ? 'max-w-full text-xs leading-relaxed text-slate-700 dark:text-white sm:text-sm'
                      : 'max-w-[24ch] text-sm leading-relaxed text-slate-700 dark:text-white'
                  }
                >
                  {locationLine}
                </p>
              )}
            </div>

            {metrics.length > 0 && (
              <div
                className={`grid border-t border-slate-900/10 dark:border-white/20 ${isMapDensity ? 'gap-2 pt-3' : 'gap-3 pt-4'}`}
                style={{
                  gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))`,
                }}
              >
                {metrics.map((metric, index) => (
                  <div
                    key={metric.label}
                    className={`min-w-0 ${index > 0 ? `border-l border-slate-900/10 dark:border-white/20 ${isMapDensity ? 'pl-2' : 'pl-3'}` : ''}`}
                  >
                    <p
                      className={`${isMapDensity ? 'whitespace-nowrap text-sm' : 'truncate text-base'} font-semibold leading-none tracking-[-0.03em] text-slate-900 dark:text-white`}
                    >
                      {metric.value}
                    </p>
                    <p
                      className={`mt-1 uppercase text-slate-600/80 dark:text-white/80 ${
                        isMapDensity
                          ? 'whitespace-nowrap text-[10px] tracking-[0.08em]'
                          : 'truncate text-[11px] tracking-[0.2em]'
                      }`}
                    >
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-slate-900/10 pt-3 text-sm text-slate-700 dark:border-white/20 dark:text-white">
              <p className="min-w-0 truncate">
                By <span className="font-medium text-slate-900 dark:text-white">{listing.client.name}</span>
              </p>
              {listingTypeLabel && (
                <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.22em] text-slate-600/80 dark:text-white/80">
                  {listingTypeLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

