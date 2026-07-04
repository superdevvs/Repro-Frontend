import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';

/**
 * Public tour "Floor Plans" section.
 *
 * Public marketing tours must only ever show REAL floorplan previews. A card is
 * rendered only when the floorplan has a usable preview image (a generated JPG for
 * PDFs, or a reachable image). Floorplans without a preview — e.g. a bare PDF, or a
 * dead/stale external (iGUIDE) URL — are NOT shown, and if no floorplan has a usable
 * preview the entire section is hidden. (No "Preview unavailable" placeholder cards.)
 */

export interface TourFloorplan {
  url?: string;
  original_url?: string;
  path?: string;
  image?: string | null;
  preview_url?: string | null;
  preview_images?: string[];
  previewImages?: string[];
  web_url?: string | null;
  thumbnail_url?: string | null;
  label?: string | null;
  filename?: string | null;
  type?: string | null;
}

const normalizeTourFloorplans = (raw: any): TourFloorplan[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): TourFloorplan | null => {
      if (!item) return null;
      if (typeof item === 'string') return { url: item };
      return {
        url: item.url || item.original_url || item.path || undefined,
        original_url: item.original_url || undefined,
        image: item.image || item.preview_url || item.web_url || item.thumbnail_url || null,
        preview_images: Array.isArray(item.preview_images) ? item.preview_images.filter(Boolean) : [],
        previewImages: Array.isArray(item.previewImages ?? item.preview_images)
          ? (item.previewImages ?? item.preview_images).filter(Boolean)
          : [],
        label: item.label || item.filename || null,
        filename: item.filename || null,
        type: item.type || null,
      };
    })
    .filter((x): x is TourFloorplan => !!x);
};

/** Returns a preview image src to attempt, or null if this floorplan can't be previewed.
 *  Only a backend-provided preview image is trusted. We deliberately do NOT fall back to
 *  the raw floorplan URL: external (e.g. iGUIDE) image URLs can be dead/slow and would hang
 *  the <img> instead of erroring, and a PDF URL can never render in <img>. */
const resolvePreviewSrc = (fp: TourFloorplan): string | null => {
  return fp.previewImages?.[0] || fp.preview_images?.[0] || fp.image || fp.preview_url || fp.web_url || fp.thumbnail_url || null;
};

interface PreviewItem {
  fp: TourFloorplan;
  sources: string[];
  label: string;
}

export function FloorplanSection({ floorplans }: { floorplans: any }) {
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  // Only floorplans that have something previewable are candidates.
  const candidates: PreviewItem[] = normalizeTourFloorplans(floorplans)
    .map((fp, i): PreviewItem | null => {
      const src = resolvePreviewSrc(fp);
      if (!src) return null;
      const sources = Array.from(new Set([
        ...(fp.previewImages || []),
        ...(fp.preview_images || []),
        src,
      ].filter(Boolean)));
      return { fp, sources, label: fp.label || fp.filename || `Level ${i + 1}` };
    })
    .filter((x): x is PreviewItem => x !== null);

  const visible = candidates.filter((_, i) => !failed[i]);
  if (visible.length === 0) return null;

  return (
    <section id="floorplan" className="max-w-6xl mx-auto px-6 mt-10">
      <h2 className="text-2xl font-bold text-foreground mb-6">Floor Plans</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {candidates.map((item, i) => {
          if (failed[i]) return null;
          const downloadUrl = item.fp.original_url || item.fp.url || item.fp.path || item.sources[0];
          return (
            <div key={i} className="rounded-2xl overflow-hidden bg-card border border-border/40 p-6 flex flex-col shadow-sm">
              <h3 className="font-semibold mb-3">{item.label}</h3>
              <div className="flex-1 space-y-3 min-h-[200px]">
                {item.sources.map((src, pageIndex) => (
                  <div key={src} className="flex items-center justify-center">
                    <img
                      src={src}
                      alt={item.sources.length > 1 ? `${item.label} page ${pageIndex + 1}` : item.label}
                      loading="lazy"
                      decoding="async"
                      className="max-w-full max-h-[300px] object-contain"
                      onError={() => {
                        if (pageIndex === 0) {
                          setFailed((prev) => ({ ...prev, [i]: true }));
                        }
                      }}
                    />
                  </div>
                ))}
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
        })}
      </div>
    </section>
  );
}
