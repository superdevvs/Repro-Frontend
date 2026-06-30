import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, FileText } from 'lucide-react';

/**
 * Public tour "Floor Plans" section. Renders a real preview image when one is
 * available (generated JPG for PDFs, or the image itself), and a clean fallback
 * card (icon + label + Open/Download) when no previewable image exists or the
 * image fails to load — never a broken <img> placeholder.
 */

export interface TourFloorplan {
  url?: string;
  original_url?: string;
  path?: string;
  image?: string | null;
  preview_url?: string | null;
  web_url?: string | null;
  thumbnail_url?: string | null;
  label?: string | null;
  filename?: string | null;
  type?: string | null;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|tiff?)($|\?)/i;
const PDF_EXT = /\.pdf($|\?)/i;

const isImageUrl = (url?: string | null, type?: string | null): boolean => {
  if (type && /^(jpe?g|png|webp|gif|image)/i.test(type)) return true;
  if (!url) return false;
  if (PDF_EXT.test(url)) return false;
  return IMAGE_EXT.test(url);
};

export const normalizeTourFloorplans = (raw: any): TourFloorplan[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): TourFloorplan | null => {
      if (!item) return null;
      if (typeof item === 'string') return { url: item };
      return {
        url: item.url || item.original_url || item.path || undefined,
        original_url: item.original_url || undefined,
        image: item.image || item.preview_url || item.web_url || item.thumbnail_url || null,
        label: item.label || item.filename || null,
        filename: item.filename || null,
        type: item.type || null,
      };
    })
    .filter((x): x is TourFloorplan => !!x && (!!x.url || !!x.image));
};

const resolvePreviewSrc = (fp: TourFloorplan): string | null => {
  const explicit = fp.image || fp.preview_url || fp.web_url || fp.thumbnail_url;
  if (explicit) return explicit;
  if (isImageUrl(fp.url, fp.type)) return fp.url || null;
  return null;
};

function FloorplanCard({ fp, index }: { fp: TourFloorplan; index: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const previewSrc = resolvePreviewSrc(fp);
  const downloadUrl = fp.url || fp.original_url || fp.path || '';
  const label = fp.label || fp.filename || `Level ${index + 1}`;
  const showImage = previewSrc && !imageFailed;

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border/40 p-6 flex flex-col shadow-sm">
      <h3 className="font-semibold mb-3">{label}</h3>
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        {showImage ? (
          <img
            src={previewSrc as string}
            alt={label}
            loading="lazy"
            decoding="async"
            className="max-w-full max-h-[300px] object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center gap-2 text-muted-foreground py-8">
            <FileText className="h-10 w-10" />
            <span className="text-sm font-medium break-all max-w-[260px]">{fp.filename || label}</span>
            <span className="text-xs">Preview unavailable</span>
          </div>
        )}
      </div>
      {downloadUrl && (
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="rounded-full flex-1" asChild>
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />Open
            </a>
          </Button>
          <Button variant="outline" className="rounded-full flex-1" asChild>
            <a href={downloadUrl} download target="_blank" rel="noopener noreferrer">
              <Download className="w-4 h-4 mr-2" />Download
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

export function FloorplanSection({ floorplans }: { floorplans: any }) {
  const items = normalizeTourFloorplans(floorplans);
  if (items.length === 0) return null;

  return (
    <section id="floorplan" className="max-w-6xl mx-auto px-6 mt-10">
      <h2 className="text-2xl font-bold text-foreground mb-6">Floor Plans</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {items.map((fp, index) => (
          <FloorplanCard key={index} fp={fp} index={index} />
        ))}
      </div>
    </section>
  );
}
