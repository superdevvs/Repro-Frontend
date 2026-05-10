import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Download, ExternalLink } from 'lucide-react';
import type { NormalizedIguideSync } from '@/utils/shootTourData';

interface IguideMediaPanelProps {
  iguideUrl: string;
  iguideSync?: NormalizedIguideSync | null;
}

export function IguideMediaPanel({ iguideUrl, iguideSync }: IguideMediaPanelProps) {
  const sync = iguideSync || ({} as NormalizedIguideSync);
  const embedUrl = sync.embeddedUrl || iguideUrl;
  const billing = sync.billing;

  const downloadLinks: Array<{ label: string; url: string }> = [];
  if (sync.pdfImperialUrl) downloadLinks.push({ label: 'Floor plan PDF (Imperial)', url: sync.pdfImperialUrl });
  if (sync.pdfMetricUrl) downloadLinks.push({ label: 'Floor plan PDF (Metric)', url: sync.pdfMetricUrl });
  if (sync.galleryZipUrl) downloadLinks.push({ label: 'Gallery (ZIP)', url: sync.galleryZipUrl });
  if (sync.galleryLowResZipUrl) downloadLinks.push({ label: 'Gallery low-res (ZIP)', url: sync.galleryLowResZipUrl });
  if (sync.sphereZipUrl) downloadLinks.push({ label: 'Spheres (ZIP)', url: sync.sphereZipUrl });
  if (sync.offlineZipUrl) downloadLinks.push({ label: 'Offline tour (ZIP)', url: sync.offlineZipUrl });

  return (
    <div className="h-full overflow-y-auto">
      <div className="m-2.5 border rounded-lg bg-card p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-medium mb-1">iGuide 3D Tour</h4>
              <a
                href={iguideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                View 3D Tour <ChevronRight className="h-3 w-3" />
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              {sync.unbrandedUrl && (
                <a
                  href={sync.unbrandedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Unbranded <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {sync.manageUrl && (
                <a
                  href={sync.manageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Manage <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {billing && (
            <div className="flex flex-wrap gap-1.5">
              {billing.iguideType && (
                <Badge variant="secondary" className="text-[10px] uppercase">{billing.iguideType}</Badge>
              )}
              {Array.isArray(billing.addons) && billing.addons.map((addon: string) => (
                <Badge key={addon} variant="outline" className="text-[10px] uppercase">{addon}</Badge>
              ))}
              {typeof billing.billableAreaSqFeet === 'number' && (
                <Badge variant="outline" className="text-[10px]">
                  {Math.round(billing.billableAreaSqFeet).toLocaleString()} sqft
                </Badge>
              )}
              {typeof billing.billableAreaSqMeters === 'number' && (
                <Badge variant="outline" className="text-[10px]">
                  {Math.round(billing.billableAreaSqMeters).toLocaleString()} m²
                </Badge>
              )}
            </div>
          )}

          <div className="aspect-video w-full rounded-lg overflow-hidden border">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allowFullScreen
              title="iGuide 3D Tour"
            />
          </div>

          {downloadLinks.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="text-xs uppercase text-muted-foreground">Deliverables</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {downloadLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline truncate"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {sync.lastSyncedAt && (
            <p className="text-[10px] text-muted-foreground">
              Last synced from youriguide.com: {new Date(sync.lastSyncedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
