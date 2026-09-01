/* ------------------------------------------------------------------------- *
 * Grouping gallery media by the service that produced it
 *
 * Media kind decides the tab; the booked service decides the section inside it. A
 * shoot running Exterior HDR, Interior HDR and Drone delivers all three into Photos,
 * and before this they arrived as one undifferentiated wall of thumbnails even though
 * every file already knew which execution row it belonged to.
 *
 * Deliberately not a tab per service: the tab strip describes media kinds, and adding
 * a tab per booked service would make it grow with the invoice rather than with the
 * kinds of media that exist.
 * ------------------------------------------------------------------------- */

import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';

export interface MediaServiceGroup {
  /** The execution row id, or '' for files with no service attribution. */
  serviceId: string;
  label: string;
  files: MediaFile[];
  /** Extras are a batch property rather than a purchased service. */
  isExtras: boolean;
}

const readFileServiceId = (file: MediaFile): string => {
  const raw = (file as { shoot_service_id?: unknown; shootServiceId?: unknown }).shoot_service_id
    ?? (file as { shootServiceId?: unknown }).shootServiceId;

  if (raw === null || raw === undefined || raw === '') return '';
  return String(raw);
};

const isExtraFile = (file: MediaFile): boolean =>
  Boolean((file as { isExtra?: boolean }).isExtra)
  || String((file as { media_type?: string }).media_type ?? '').toLowerCase() === 'extra';

/**
 * Provider-delivered floorplans carry no `shoot_service_id`.
 *
 * They are ingested from iGuide / CubiCasa rather than uploaded against a booked
 * execution row, so they have no pivot to group by and would otherwise land in
 * the generic unattributed bucket. `metadata.source` is the only attribution they
 * have, and it is set by the ingestion jobs.
 *
 * Deliberately scoped to floorplan media: `metadata.source` is only written by
 * the two floorplan ingestion jobs today, and this keeps the label from being
 * applied to something it would misdescribe if that ever changes.
 */
const PROVIDER_SECTION_LABELS: Record<string, string> = {
  iguide: 'iGUIDE Floor Plans',
  cubicasa: 'CubiCasa Floor Plans',
};

const readProviderSection = (file: MediaFile): { key: string; label: string } | null => {
  if (String((file as { media_type?: string }).media_type ?? '').toLowerCase() !== 'floorplan') {
    return null;
  }

  const source = String(file.media_source ?? '').trim().toLowerCase();
  const label = PROVIDER_SECTION_LABELS[source];

  return label ? { key: `provider:${source}`, label } : null;
};

/**
 * Service labels keyed by execution row id, taken from the shoot's own booked
 * services so the heading matches what the upload selector called it.
 *
 * `servicePresentation` is preferred because it is display-only and therefore
 * carries every booked row. `serviceItems` is the operational payload and is
 * narrowed by workflow eligibility — an editor does not receive rows for
 * services they may not edit, which is why a file they *can* see could end up
 * with no resolvable name. Both are read, presentation first, so the label works
 * regardless of which payload a given endpoint sends.
 */
export const buildServiceLabelMap = (shoot: ShootData): Map<string, string> => {
  const labels = new Map<string, string>();

  const sources = [
    shoot?.servicePresentation ?? shoot?.service_presentation,
    shoot?.serviceItems ?? shoot?.service_items,
  ] as unknown as Array<Array<Record<string, unknown>> | undefined>;

  sources.forEach((items) => {
    if (!Array.isArray(items)) return;

    items.forEach((item) => {
      const id = item?.shoot_service_id ?? item?.shootServiceId;
      if (id === null || id === undefined || id === '') return;

      const key = String(id);
      if (labels.has(key)) return;

      const name = String(item?.name ?? item?.serviceName ?? '').trim();
      if (name) labels.set(key, name);
    });
  });

  return labels;
};

/**
 * Split one tab's files into service sections, preserving the incoming order within
 * each section so downstream sorting still decides presentation.
 *
 * Returns a single unlabelled group when there is nothing to separate — one service, or
 * no service attribution at all — so a simple shoot renders exactly as it did before and
 * never shows a heading it does not need.
 */
export const groupMediaFilesByService = (
  files: MediaFile[],
  shoot: ShootData,
): MediaServiceGroup[] => {
  if (files.length === 0) return [];

  const labels = buildServiceLabelMap(shoot);
  const byService = new Map<string, MediaFile[]>();
  const byProvider = new Map<string, { label: string; files: MediaFile[] }>();
  const extras: MediaFile[] = [];

  files.forEach((file) => {
    // Extras never join a service section: they are the unplanned exception inside an
    // otherwise planned batch, and they get their own trailing section.
    if (isExtraFile(file)) {
      extras.push(file);
      return;
    }

    const serviceId = readFileServiceId(file);

    // A provider-ingested floorplan has no pivot to group by. Give it the
    // provider's own section instead of dropping it into "Unassigned".
    if (serviceId === '') {
      const provider = readProviderSection(file);
      if (provider) {
        const existing = byProvider.get(provider.key);
        if (existing) {
          existing.files.push(file);
        } else {
          byProvider.set(provider.key, { label: provider.label, files: [file] });
        }
        return;
      }
    }

    const bucket = byService.get(serviceId);
    if (bucket) {
      bucket.push(file);
    } else {
      byService.set(serviceId, [file]);
    }
  });

  const attributed = Array.from(byService.entries())
    .filter(([serviceId]) => serviceId !== '')
    // Order sections by the shoot's own service order where known, so the gallery reads
    // in the same order as the upload panel.
    .sort(([a], [b]) => {
      const order = Array.from(labels.keys());
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    })
    .map(([serviceId, groupFiles]) => ({
      serviceId,
      label: labels.get(serviceId) ?? `Service #${serviceId}`,
      files: groupFiles,
      isExtras: false,
    }));

  const unattributed = byService.get('') ?? [];

  const groups: MediaServiceGroup[] = [...attributed];

  // Provider sections follow the booked services: the shoot's own deliverables
  // read first, then what a provider returned for them.
  Array.from(byProvider.entries())
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .forEach(([key, group]) => {
      groups.push({
        serviceId: key,
        label: group.label,
        files: group.files,
        isExtras: false,
      });
    });

  if (unattributed.length > 0) {
    groups.push({
      serviceId: '',
      // Files predating per-service attribution, or uploaded without a service.
      label: 'Unassigned',
      files: unattributed,
      isExtras: false,
    });
  }

  if (extras.length > 0) {
    groups.push({ serviceId: '__extras__', label: 'Extras', files: extras, isExtras: true });
  }

  return groups;
};

/**
 * Whether section headings are worth showing.
 *
 * One section means there is nothing to distinguish, so the heading would be noise.
 */
export const shouldShowServiceSections = (groups: MediaServiceGroup[]): boolean => groups.length > 1;
