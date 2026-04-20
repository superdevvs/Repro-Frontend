const CHUNK_RELOAD_STORAGE_KEY = 'repro:chunk-reload-attempted';
const CHUNK_RELOAD_QUERY_PARAM = '__chunk_reload';

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk [\w-]+ failed/i,
  /ChunkLoadError/i,
  /error loading dynamically imported module/i,
];

let recoveryHandlersInstalled = false;

const safeSessionStorage = {
  getItem(key: string) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Ignore blocked storage and continue with a best-effort reload.
    }
  },
  removeItem(key: string) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore blocked storage cleanup failures.
    }
  },
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  return '';
};

export const isRecoverableChunkError = (error: unknown) => {
  const message = getErrorMessage(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

export const buildChunkRecoveryUrl = (href: string, timestamp = Date.now()) => {
  const url = new URL(href);
  url.searchParams.set(CHUNK_RELOAD_QUERY_PARAM, String(timestamp));
  return url.toString();
};

export const attemptChunkLoadRecovery = (error: unknown) => {
  if (typeof window === 'undefined' || !isRecoverableChunkError(error)) {
    return false;
  }

  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has(CHUNK_RELOAD_QUERY_PARAM)) {
    return false;
  }

  const currentAttempt = safeSessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
  if (currentAttempt) {
    return false;
  }

  safeSessionStorage.setItem(
    CHUNK_RELOAD_STORAGE_KEY,
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );

  window.location.replace(buildChunkRecoveryUrl(window.location.href));
  return true;
};

export const clearChunkLoadRecoveryState = () => {
  if (typeof window === 'undefined') {
    return;
  }

  safeSessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY);

  const url = new URL(window.location.href);
  if (!url.searchParams.has(CHUNK_RELOAD_QUERY_PARAM)) {
    return;
  }

  url.searchParams.delete(CHUNK_RELOAD_QUERY_PARAM);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, document.title, nextUrl);
};

export const installChunkLoadRecovery = () => {
  if (typeof window === 'undefined' || recoveryHandlersInstalled) {
    return;
  }

  recoveryHandlersInstalled = true;

  const handleError = (event: ErrorEvent) => {
    attemptChunkLoadRecovery(event.error ?? event.message);
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    attemptChunkLoadRecovery(event.reason);
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
};
