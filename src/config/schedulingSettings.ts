export const LEGACY_SCHEDULING_SETTINGS_PATH = '/scheduling-settings';
export const SCHEDULING_SETTINGS_PATH = '/settings?tab=scheduling';

export function canOpenSchedulingSettings(role?: string): boolean {
  return role === 'admin' || role === 'superadmin' || role === 'editing_manager';
}

export function schedulingSettingsTarget(search: string, hash: string) {
  const params = new URLSearchParams(search);
  if (!params.has('catalog') && params.get('tab') === 'service-groups') {
    params.set('catalog', 'service-groups');
  }
  params.set('tab', 'scheduling');
  return { pathname: '/settings', search: '?' + params.toString(), hash };
}
