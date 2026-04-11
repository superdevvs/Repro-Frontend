export const sanitizeRelativeReturnTo = (value?: string | null): string | null => {
  if (!value || typeof window === 'undefined') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, window.location.origin);
    if (resolved.origin !== window.location.origin) {
      return null;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
};

export const getCurrentReturnTo = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return sanitizeRelativeReturnTo(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
};

export const canUseSafeHistoryFallback = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  if (window.history.length <= 1 || !document.referrer) {
    return false;
  }

  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
};
