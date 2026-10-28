import type { ShootData } from '@/types/shoots';
import type { ApiShoot } from './shootNormalization';
import { deduplicateApiShoots, normalizeShootRecords } from './shootListRecords';

/** Publish initial pages without treating our own writes as concurrent edits. */
export function createInitialShootProgress(
  canPublish: () => boolean,
  current: () => ShootData[],
  publish: (shoots: ShootData[]) => void,
) {
  const pages = new Map<string, Map<number, ApiShoot[]>>();
  let lastPublished = new Map<string, string>();
  const edits = new Map<string, ShootData>();
  const deletedIds = new Set<string>();
  const captureChanges = () => {
    if (!canPublish()) return;
    const latest = new Map(current().map(shoot => [shoot.id, shoot]));
    for (const id of lastPublished.keys()) {
      if (!latest.has(id)) { deletedIds.add(id); edits.delete(id); }
    }
    for (const shoot of latest.values()) {
      if (JSON.stringify(shoot) !== lastPublished.get(shoot.id)) edits.set(shoot.id, shoot);
    }
  };
  const onPage = (section: string, records: ApiShoot[], page: number) => {
    if (!canPublish()) return;
    captureChanges();
    const sectionPages = pages.get(section) ?? new Map<number, ApiShoot[]>();
    sectionPages.set(page, records);
    pages.set(section, sectionPages);
    const recordsInOrder = ['scheduled', 'completed', 'delivered'].flatMap(tab =>
      [...(pages.get(tab)?.entries() ?? [])].sort(([a], [b]) => a - b).flatMap(([, items]) => items));
    const next = normalizeShootRecords(deduplicateApiShoots(recordsInOrder))
      .filter(shoot => !deletedIds.has(shoot.id))
      .map(shoot => edits.get(shoot.id) ?? shoot);
    const ids = new Set(next.map(shoot => shoot.id));
    for (const shoot of edits.values()) if (!ids.has(shoot.id)) next.push(shoot);
    lastPublished = new Map(next.map(shoot => [shoot.id, JSON.stringify(shoot)]));
    publish(next);
  };
  return { onPage, captureChanges, deletedIds };
}
