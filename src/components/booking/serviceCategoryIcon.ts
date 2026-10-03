import type { ServicePickerIconName } from './ServicePickerIcon';

export function serviceCategoryIcon(name: string): ServicePickerIconName {
  if (/photo/i.test(name)) return 'camera';
  if (/video/i.test(name)) return 'video';
  if (/drone/i.test(name)) return 'drone';
  if (/floor|plan/i.test(name)) return 'floor';
  if (/360|3d|tour/i.test(name)) return 'grid';
  return 'spark';
}
