const READ_ID_PRUNE_MS = 30 * 24 * 60 * 60 * 1000;
const LIVE_EXTRA_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type NotificationReadState = {
  lastSeenAt: number | null;
  readIds: Record<string, number>;
};

export type MergeableNotification = {
  id: string;
  date: string;
  isRead?: boolean;
};

export type SaveReadIdsOptions = {
  currentFeedIds?: Set<string>;
  now?: number;
};

const emptyReadState = (): NotificationReadState => ({
  lastSeenAt: null,
  readIds: {},
});

export const parseNotificationDate = (
  value: string | number | null | undefined,
): number | null => {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  // Laravel toDateTimeString() is "Y-m-d H:i:s" (no T, no timezone).
  const laravelish = value.trim().replace(' ', 'T');
  const retry = Date.parse(laravelish);
  return Number.isNaN(retry) ? null : retry;
};

export const seedLastSeenAt = (
  existing: number | null | undefined,
  feedTimestamps: Array<string | number | null | undefined>,
  now: number,
): number => {
  if (existing != null && Number.isFinite(existing)) {
    return existing;
  }

  let newest: number | null = null;
  for (const stamp of feedTimestamps) {
    const timestamp = parseNotificationDate(stamp);
    if (timestamp == null) {
      continue;
    }
    if (newest == null || timestamp > newest) {
      newest = timestamp;
    }
  }

  return newest ?? now;
};

export const isNotificationRead = (
  id: string,
  date: string | number | null | undefined,
  readIds: Set<string>,
  lastSeenAt: number | null | undefined,
): boolean => {
  if (readIds.has(id)) {
    return true;
  }

  const timestamp = parseNotificationDate(date);
  if (timestamp == null) {
    return true;
  }

  if (lastSeenAt == null || !Number.isFinite(lastSeenAt)) {
    return false;
  }

  return timestamp <= lastSeenAt;
};

export const countUnread = (
  items: Array<{ id: string; date?: string | number | null; isRead?: boolean }>,
  readIds: Set<string>,
  lastSeenAt: number | null | undefined,
): number =>
  items.reduce((count, item) => {
    if (item.isRead) {
      return count;
    }
    return isNotificationRead(item.id, item.date, readIds, lastSeenAt) ? count : count + 1;
  }, 0);

export const pruneReadIdEntries = (
  entries: Record<string, number>,
  currentFeedIds: Set<string>,
  now: number,
  maxAgeMs = READ_ID_PRUNE_MS,
): Record<string, number> => {
  const next: Record<string, number> = {};

  for (const [id, timestamp] of Object.entries(entries)) {
    if (currentFeedIds.has(id) || now - timestamp < maxAgeMs) {
      next[id] = timestamp;
    }
  }

  return next;
};

const normalizeTimestampMap = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const next: Record<string, number> = {};
  for (const [id, timestamp] of Object.entries(value as Record<string, unknown>)) {
    if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
      next[id] = timestamp;
    }
  }
  return next;
};

const isPersistedReadState = (
  record: Record<string, unknown>,
): record is { lastSeenAt?: unknown; readIds: unknown } =>
  'readIds' in record &&
  typeof record.readIds === 'object' &&
  record.readIds !== null &&
  !Array.isArray(record.readIds);

export const loadReadState = (storageKey: string): NotificationReadState => {
  try {
    if (typeof window === 'undefined') {
      return emptyReadState();
    }

    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return emptyReadState();
    }

    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return emptyReadState();
    }

    const record = parsed as Record<string, unknown>;
    if (isPersistedReadState(record)) {
      return {
        lastSeenAt:
          typeof record.lastSeenAt === 'number' && Number.isFinite(record.lastSeenAt)
            ? record.lastSeenAt
            : null,
        readIds: normalizeTimestampMap(record.readIds),
      };
    }

    return {
      lastSeenAt: null,
      readIds: normalizeTimestampMap(record),
    };
  } catch {
    return emptyReadState();
  }
};

const persistReadState = (storageKey: string, state: NotificationReadState) => {
  try {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        lastSeenAt: state.lastSeenAt,
        readIds: state.readIds,
      }),
    );
  } catch {
    // Ignore storage errors
  }
};

export const saveLastSeenAt = (storageKey: string, lastSeenAt: number) => {
  const existing = loadReadState(storageKey);
  persistReadState(storageKey, { ...existing, lastSeenAt });
};

export const getReadIds = (
  storageKey: string,
  currentFeedIds?: Set<string>,
  now: number = Date.now(),
): Set<string> => {
  const { readIds } = loadReadState(storageKey);
  const feedIds = currentFeedIds ?? new Set(Object.keys(readIds));
  return new Set(Object.keys(pruneReadIdEntries(readIds, feedIds, now)));
};

export const saveReadIds = (
  ids: Set<string>,
  storageKey: string,
  options?: SaveReadIdsOptions,
) => {
  const now = options?.now ?? Date.now();
  const existing = loadReadState(storageKey);
  const readIds: Record<string, number> = {};

  ids.forEach((id) => {
    readIds[id] = existing.readIds[id] ?? now;
  });

  const feedIds = options?.currentFeedIds ?? ids;
  persistReadState(storageKey, {
    lastSeenAt: existing.lastSeenAt,
    readIds: pruneReadIdEntries(readIds, feedIds, now),
  });
};

const shouldKeepLiveExtra = (
  item: MergeableNotification,
  now: number,
  maxAgeMs: number,
): boolean => {
  if (item.id.startsWith('sms-')) {
    return true;
  }

  const timestamp = parseNotificationDate(item.date);
  if (timestamp == null) {
    return false;
  }

  return now - timestamp <= maxAgeMs;
};

export const mergeNotificationLists = <T extends MergeableNotification>(
  previous: T[],
  activityItems: T[],
  now: number,
  liveExtraMaxAgeMs = LIVE_EXTRA_MAX_AGE_MS,
): T[] => {
  const activityIds = new Set(activityItems.map((item) => item.id));
  const merged = new Map<string, T>();

  activityItems.forEach((item) => {
    merged.set(item.id, item);
  });

  previous.forEach((item) => {
    if (activityIds.has(item.id)) {
      const activityItem = merged.get(item.id);
      if (!activityItem) {
        return;
      }

      merged.set(item.id, {
        ...activityItem,
        isRead: Boolean(activityItem.isRead || item.isRead),
      });
      return;
    }

    if (shouldKeepLiveExtra(item, now, liveExtraMaxAgeMs)) {
      merged.set(item.id, item);
    }
  });

  return Array.from(merged.values()).sort(
    (a, b) => (parseNotificationDate(b.date) ?? 0) - (parseNotificationDate(a.date) ?? 0),
  );
};
