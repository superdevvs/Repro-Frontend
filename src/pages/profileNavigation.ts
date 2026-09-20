const SETTINGS_ONLY_ROLES = new Set(['photographer', 'editor']);

export function usesSettingsOnlyAccount(role?: string | null): boolean {
  return SETTINGS_ONLY_ROLES.has(String(role ?? ''));
}

export function selfAccountDestination(role?: string | null, search = ''): string | null {
  if (!usesSettingsOnlyAccount(role)) {
    return null;
  }
  return `/settings${search}`;
}
