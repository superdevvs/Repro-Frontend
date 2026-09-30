import { API_BASE_URL } from '@/config/env';
import { getStoredAuthToken } from '@/utils/authToken';

export const USER_PROFILE_LAST_FETCH_KEY = 'repro:user-profile:last-fetch-at';
/** Floor between automatic /api/user fetches across AuthProvider + EmailVerification + tabs. */
export const USER_PROFILE_MIN_INTERVAL_MS = 60_000;
const LOCK_KEY = 'repro:user-profile:lock';

let inFlight: Promise<unknown | null> | null = null;

/** @internal */
export const resetUserProfileClientState = () => {
  inFlight = null;
};

const readLastFetchAt = (): number => {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(USER_PROFILE_LAST_FETCH_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
};

const writeLastFetchAt = (at: number) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USER_PROFILE_LAST_FETCH_KEY, String(at));
  } catch {
    // ignore quota / private mode
  }
};

const tryAcquireLock = (now: number): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(LOCK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { at?: number };
      if (typeof parsed.at === 'number' && now - parsed.at < 15_000) {
        return false;
      }
    }
    window.localStorage.setItem(LOCK_KEY, JSON.stringify({ at: now }));
    return true;
  } catch {
    return true;
  }
};

const releaseLock = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LOCK_KEY);
  } catch {
    // ignore
  }
};

export type FetchCurrentUserOptions = {
  token?: string | null;
  signal?: AbortSignal;
  force?: boolean;
  now?: number;
  fetchImpl?: typeof fetch;
};

/**
 * Singleflight + cross-tab floor for GET /api/user.
 * Callers still apply their own response handling; this only caps network volume.
 */
export async function fetchCurrentUserProfile(
  options: FetchCurrentUserOptions = {},
): Promise<unknown | null> {
  const now = options.now ?? Date.now();
  const token = options.token ?? getStoredAuthToken();
  if (!token) return null;

  if (inFlight) {
    return inFlight;
  }

  if (!options.force) {
    const last = readLastFetchAt();
    if (last > 0 && now - last < USER_PROFILE_MIN_INTERVAL_MS) {
      return null;
    }
    if (!tryAcquireLock(now)) {
      return null;
    }
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  inFlight = (async () => {
    try {
      const response = await fetchImpl(`${API_BASE_URL}/api/user`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // AuthProvider binds a signal so impersonation / cross-tab account switches
        // can cancel an in-flight profile refresh. Navbar-style remount aborts are
        // not used here (callers omit signal).
        signal: options.signal,
      });

      if (response.status === 401 || response.status === 419) {
        writeLastFetchAt(now);
        return { __status: response.status };
      }

      if (!response.ok) {
        // Soft failures (429/5xx) still advance the floor so we do not hammer.
        writeLastFetchAt(now);
        return { __status: response.status };
      }

      const json = await response.json();
      writeLastFetchAt(now);
      return json;
    } catch {
      writeLastFetchAt(now);
      return null;
    } finally {
      inFlight = null;
      releaseLock();
    }
  })();

  return inFlight;
}

export const canAutomaticallyRefreshUserProfile = (now = Date.now()): boolean =>
  now - readLastFetchAt() >= USER_PROFILE_MIN_INTERVAL_MS;
