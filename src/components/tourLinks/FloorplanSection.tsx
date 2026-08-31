import { useState } from 'react';
import { Maximize2 } from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

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

const firstString = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === 'string' && value.trim().length > 0);

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const normalizeTourFloorplans = (raw: unknown): TourFloorplan[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: unknown): TourFloorplan | null => {
      if (!item) return null;
      if (typeof item === 'string') return { url: item };
      if (typeof item !== 'object') return null;

      const record = item as Record<string, unknown>;
      const previewImages = stringArray(record.previewImages ?? record.preview_images);

      return {
        url: firstString(record.url, record.original_url, record.path),
        original_url: firstString(record.original_url),
        image: firstString(record.image, record.preview_url, record.web_url, record.thumbnail_url) ?? null,
        preview_images: stringArray(record.preview_images),
        previewImages,
        label: firstString(record.label, record.filename) ?? null,
        filename: firstString(record.filename) ?? null,
        type: firstString(record.type) ?? null,
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
  sources: string[];
}

interface ActivePreview {
  src: string;
  alt: string;
}

export function FloorplanSection({ floorplans }: { floorplans: unknown }) {
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);

  // Only floorplans that have something previewable are candidates.
  const candidates: PreviewItem[] = normalizeTourFloorplans(floorplans)
    .map((fp): PreviewItem | null => {
      const src = resolvePreviewSrc(fp);
      if (!src) return null;
      const sources = Array.from(new Set([
        ...(fp.previewImages || []),
        ...(fp.preview_images || []),
        src,
      ].filter(Boolean)));
      return { sources };
    })
    .filter((x): x is PreviewItem => x !== null);

  const visible = candidates.filter((_, i) => !failed[i]);
  if (visible.length === 0) return null;

  return (
    <>
      <section id="floorplan" className="max-w-6xl mx-auto px-6 mt-10">
        <h2 className="text-2xl font-bold text-foreground mb-6">Floor Plans</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {candidates.map((item, i) => {
            if (failed[i]) return null;
            return (
              <div key={i} className="rounded-2xl overflow-hidden bg-card border border-border/40 p-4 shadow-sm">
                <div className="space-y-3">
                  {item.sources.map((src, pageIndex) => {
                    const alt = item.sources.length > 1
                      ? `Floor plan ${i + 1}, page ${pageIndex + 1}`
                      : `Floor plan ${i + 1}`;

                    return (
                      <button
                        key={src}
                        type="button"
                        className="group relative flex min-h-[200px] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-xl bg-muted/20 outline-none transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        aria-label={`Open ${alt} in full view`}
                        onClick={() => setActivePreview({ src, alt })}
                      >
                        <img
                          src={src}
                          alt={alt}
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          className="max-h-[300px] max-w-full select-none object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                          onContextMenu={(event) => event.preventDefault()}
                          onDragStart={(event) => event.preventDefault()}
                          onError={() => {
                            if (pageIndex === 0) {
                              setFailed((prev) => ({ ...prev, [i]: true }));
                            }
                          }}
                        />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/15 group-focus-visible:bg-black/15">
                          <span className="flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-black/65 text-white opacity-0 shadow-lg backdrop-blur-sm transition-all group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
                            <Maximize2 className="h-5 w-5" aria-hidden="true" />
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog
        open={activePreview !== null}
        onOpenChange={(open) => {
          if (!open) setActivePreview(null);
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="!h-[100svh] !w-screen !max-w-none overflow-hidden bg-black/95 p-4 shadow-none sm:!rounded-none sm:p-8"
        >
          <DialogTitle className="sr-only">Floor plan full view</DialogTitle>
          {activePreview && (
            <div className="flex h-full w-full items-center justify-center">
              <img
                src={activePreview.src}
                alt={`${activePreview.alt} full view`}
                decoding="async"
                draggable={false}
                className="max-h-full max-w-full select-none object-contain"
                onContextMenu={(event) => event.preventDefault()}
                onDragStart={(event) => event.preventDefault()}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
