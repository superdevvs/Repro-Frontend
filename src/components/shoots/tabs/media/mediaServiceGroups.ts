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
 * Service labels keyed by execution row id, taken from the shoot's own service items so
 * the heading matches what the upload selector called it.
 */
export const buildServiceLabelMap = (shoot: ShootData): Map<string, string> => {
  const labels = new Map<string, string>();
  const items = (shoot?.serviceItems ?? shoot?.service_items ?? []) as unknown as Array<Record<string, unknown>>;

  items.forEach((item) => {
    const id = item?.shoot_service_id ?? item?.shootServiceId;
    if (id === null || id === undefined || id === '') return;

    const name = String(item?.name ?? item?.serviceName ?? '').trim();
    if (name) labels.set(String(id), name);
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
  const extras: MediaFile[] = [];

  files.forEach((file) => {
    // Extras never join a service section: they are the unplanned exception inside an
    // otherwise planned batch, and they get their own trailing section.
    if (isExtraFile(file)) {
      extras.push(file);
      return;
    }

    const serviceId = readFileServiceId(file);
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
