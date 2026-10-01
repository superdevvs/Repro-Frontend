import type { ShootData } from '@/types/shoots';
import { applyFallbackMedia, transformShootFromApi, type ApiShoot } from './shootNormalization';

export const deduplicateApiShoots = (records: ApiShoot[]): ApiShoot[] =>
  Array.from(new Map<ApiShoot['id'], ApiShoot>(records.map(record => [record.id, record])).values());

export const normalizeShootRecords = (records: ApiShoot[]): ShootData[] => applyFallbackMedia(records.flatMap((record) => {
  try {
    return [transformShootFromApi(record)];
  } catch (error) {
    console.error('Skipping shoot that failed to normalize', record?.id, error);
    return [];
  }
}));
