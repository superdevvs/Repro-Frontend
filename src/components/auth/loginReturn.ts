const DEFAULT_LOGIN_RETURN = '/dashboard';
const RETURN_ORIGIN = 'https://login-return.invalid';

export function sanitizeLoginReturnPath(value: string | null): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return DEFAULT_LOGIN_RETURN;
  }
  // URL parsing strips control characters, so reject them before normalization.
  if (Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    return DEFAULT_LOGIN_RETURN;
  }

  try {
    const target = new URL(value, RETURN_ORIGIN);
    if (target.origin !== RETURN_ORIGIN || target.pathname === '/' || target.pathname.startsWith('//')) {
      return DEFAULT_LOGIN_RETURN;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return DEFAULT_LOGIN_RETURN;
  }
}

export function getLoginReturnPath(search: string): string {
  return sanitizeLoginReturnPath(new URLSearchParams(search).get('returnTo'));
}

export function getLoginPath(location: { pathname: string; search: string; hash: string }): string {
  const returnTo = sanitizeLoginReturnPath(`${location.pathname}${location.search}${location.hash}`);
  return `/?${new URLSearchParams({ returnTo })}`;
}
