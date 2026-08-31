import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getBathroomMetricDisplay } from '@/utils/shootPropertyDisplay';
import type { PrivateListing } from '@/types/privateListings';
import { formatListingPrice, resolveListingPreviewUrl } from '@/utils/privateListings';
import { Bath, BedDouble, ExternalLink, MapPin, Ruler, User } from 'lucide-react';

interface PrivateListingPortalListRowProps {
  listing: PrivateListing;
  selectionMode: boolean;
  selected: boolean;
  canManageVisibility: boolean;
  savingVisibility: boolean;
  onOpen: (listing: Pick<PrivateListing, 'id'>) => void;
  onToggleSelect: (listing: PrivateListing) => void;
  onUnhide: (listing: PrivateListing) => void;
}

export const PrivateListingPortalListRow = ({
  listing,
  selectionMode,
  selected,
  canManageVisibility,
  savingVisibility,
  onOpen,
  onToggleSelect,
  onUnhide,
}: PrivateListingPortalListRowProps) => {
  const heroUrl = resolveListingPreviewUrl(listing.heroImage) || '/placeholder.svg';
  const bathroomDisplay = getBathroomMetricDisplay(listing.bathrooms);
  const isHidden = listing.isListingHidden;

  const handleRowClick = () => {
    if (selectionMode) {
      if (!isHidden) onToggleSelect(listing);
      return;
    }
    onOpen(listing);
  };

  return (
    <div
      className={`group flex items-center gap-4 p-3 sm:p-4 rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20 hover:bg-accent/30 ${isHidden ? 'opacity-70' : ''}`}
      onClick={handleRowClick}
    >
      {selectionMode && !isHidden && (
        <div
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
            selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'
          }`}
        >
          ✓
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative h-16 w-24 sm:h-20 sm:w-32 flex-shrink-0 rounded-md overflow-hidden bg-muted">
        <img
          src={heroUrl}
          alt={listing.address}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {!selectionMode && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
            <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{listing.address}</h3>
              {isHidden && (
                <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-900">
                  Hidden
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{listing.city}, {listing.state} {listing.zip}</span>
            </div>
          </div>
          {isHidden && canManageVisibility ? (
            <Button
              size="sm"
              variant="outline"
              disabled={savingVisibility}
              onClick={(event) => {
                event.stopPropagation();
                onUnhide(listing);
              }}
            >
              Unhide
            </Button>
          ) : listing.price && (
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">
              {formatListingPrice(listing.price)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {listing.bedrooms && (
            <div className="flex items-center gap-1">
              <BedDouble className="h-3 w-3" />
              <span>{listing.bedrooms} Bed</span>
            </div>
          )}
          {bathroomDisplay && (
            <div className="flex items-center gap-1">
              <Bath className="h-3 w-3" />
              <span>{bathroomDisplay.value} {bathroomDisplay.label}</span>
            </div>
          )}
          {listing.sqft && (
            <div className="flex items-center gap-1">
              <Ruler className="h-3 w-3" />
              <span>{listing.sqft.toLocaleString()} sqft</span>
            </div>
          )}
          <div className="hidden sm:flex items-center gap-1 ml-auto">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[140px]">{listing.client.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
