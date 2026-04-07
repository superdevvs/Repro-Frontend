type DeliveredShootTrackerState = {
  viewedShootIds: string[];
  downloadedShootIds: string[];
};

const STORAGE_PREFIX = 'client-delivered-shoot-tracker';

const emptyState = (): DeliveredShootTrackerState => ({
  viewedShootIds: [],
  downloadedShootIds: [],
});

const buildStorageKey = (userId: string | number) =>
  `${STORAGE_PREFIX}:${String(userId)}`;

const readTrackerState = (userId: string | number): DeliveredShootTrackerState => {
  if (typeof window === 'undefined') {
    return emptyState();
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(userId));
    if (!raw) {
      return emptyState();
    }

    const parsed = JSON.parse(raw) as Partial<DeliveredShootTrackerState> | null;
    return {
      viewedShootIds: Array.isArray(parsed?.viewedShootIds)
        ? parsed!.viewedShootIds.map((value) => String(value))
        : [],
      downloadedShootIds: Array.isArray(parsed?.downloadedShootIds)
        ? parsed!.downloadedShootIds.map((value) => String(value))
        : [],
    };
  } catch {
    return emptyState();
  }
};

const writeTrackerState = (
  userId: string | number,
  state: DeliveredShootTrackerState,
) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(buildStorageKey(userId), JSON.stringify(state));
  } catch {
    // Ignore storage failures and keep the UI functional.
  }
};

const addShootId = (
  ids: string[],
  shootId: string | number,
) => {
  const normalizedShootId = String(shootId);
  return ids.includes(normalizedShootId)
    ? ids
    : [...ids, normalizedShootId];
};

export const isClientDeliveredShootViewed = (
  userId: string | number,
  shootId: string | number,
) => readTrackerState(userId).viewedShootIds.includes(String(shootId));

export const isClientDeliveredShootDownloaded = (
  userId: string | number,
  shootId: string | number,
) => readTrackerState(userId).downloadedShootIds.includes(String(shootId));

export const markClientDeliveredShootViewed = (
  userId: string | number,
  shootId: string | number,
) => {
  const current = readTrackerState(userId);
  const nextViewed = addShootId(current.viewedShootIds, shootId);
  if (nextViewed === current.viewedShootIds) {
    return false;
  }

  writeTrackerState(userId, {
    ...current,
    viewedShootIds: nextViewed,
  });
  return true;
};

export const markClientDeliveredShootDownloaded = (
  userId: string | number,
  shootId: string | number,
) => {
  const current = readTrackerState(userId);
  const nextDownloaded = addShootId(current.downloadedShootIds, shootId);
  if (nextDownloaded === current.downloadedShootIds) {
    return false;
  }

  writeTrackerState(userId, {
    viewedShootIds: addShootId(current.viewedShootIds, shootId),
    downloadedShootIds: nextDownloaded,
  });
  return true;
};
