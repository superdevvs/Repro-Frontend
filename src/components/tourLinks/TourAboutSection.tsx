import { Badge } from '@/components/ui/badge';
import { normalizeTourDescription } from './tourDisplayUtils';

type TourAboutSectionProps = {
  description?: unknown;
  listingType?: unknown;
  propertyStatus?: unknown;
};

const normalizeText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const formatLabel = (value: string): string =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function TourAboutSection({
  description,
  listingType,
  propertyStatus,
}: TourAboutSectionProps) {
  const normalizedDescription = normalizeTourDescription(description);
  const normalizedListingType = normalizeText(listingType);
  const normalizedPropertyStatus = normalizeText(propertyStatus);
  const visiblePropertyStatus = normalizedPropertyStatus.toLowerCase() === 'available'
    ? ''
    : normalizedPropertyStatus;

  if (!normalizedDescription && !normalizedListingType && !visiblePropertyStatus) {
    return null;
  }

  return (
    <section id="about" className="max-w-6xl mx-auto px-6 mt-10">
      {(normalizedListingType || visiblePropertyStatus) && (
        <div className={`flex flex-wrap gap-2${normalizedDescription ? ' mb-4' : ''}`}>
          {normalizedListingType && (
            <Badge variant="secondary">{formatLabel(normalizedListingType)}</Badge>
          )}
          {visiblePropertyStatus && (
            <Badge variant="outline">{formatLabel(visiblePropertyStatus)}</Badge>
          )}
        </div>
      )}
      {normalizedDescription && (
        <>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            About
          </h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm md:text-base">
            {normalizedDescription}
          </p>
        </>
      )}
    </section>
  );
}
