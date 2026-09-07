export const photographerAccountTabs = ['personal', 'work', 'specialties', 'equipments', 'notifications', 'security'] as const;
export type PhotographerAccountTab = (typeof photographerAccountTabs)[number];

export function resolvePhotographerAccountTab(search: URLSearchParams, fallback: PhotographerAccountTab = 'personal'): PhotographerAccountTab {
  if (search.get('verify') === 'equipment') return 'equipments';
  const tab = search.get('tab');
  if (tab === 'profile') return 'personal';
  if (tab === 'account') return 'security';
  if (tab === 'preferences') return 'work';
  if (tab === 'equipment') return 'equipments';
  return photographerAccountTabs.includes(tab as PhotographerAccountTab) ? tab as PhotographerAccountTab : fallback;
}

export function photographerSettingsDestination(search: URLSearchParams): string {
  const params = new URLSearchParams(search);
  params.set('tab', resolvePhotographerAccountTab(params, 'work'));
  return `/photographer-account?${params.toString()}`;
}
