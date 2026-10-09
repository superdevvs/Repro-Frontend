export const SETTINGS_GROUPS = [
  { id: 'my-account', label: 'My Account', description: 'Your details, security and notification preferences.', tabs: [
    { value: 'profile', label: 'Personal details' },
    { value: 'account', label: 'Account & security' },
    { value: 'notifications', label: 'Notifications' },
  ] },
  { id: 'branding', label: 'Branding', description: 'Portfolio appearance and photo watermark settings.', tabs: [
    { value: 'branding', label: 'Portfolio' }, { value: 'watermark', label: 'Watermark' },
  ] },
  { id: 'editing', label: 'Editing', description: 'Desktop editing tools and AI service providers.', tabs: [
    { value: 'desktop-editing', label: 'Desktop editing' }, { value: 'ai-editing', label: 'AI providers' },
  ] },
  { id: 'business', label: 'Business', description: 'Discount codes and photographer service coverage.', tabs: [
    { value: 'coupons', label: 'Discounts' }, { value: 'service-areas', label: 'Service Areas' },
  ] },
  { id: 'integrations', label: 'Integrations', description: 'Connect providers, tours and messaging services.', tabs: [
    { value: 'integrations', label: 'Integrations' },
  ] },
  { id: 'robbie', label: 'Robbie AI', description: 'Assistant behavior and access for each role.', tabs: [
    { value: 'robbie', label: 'Robbie AI' },
  ] },
] as const;

export type SettingsTab = typeof SETTINGS_GROUPS[number]['tabs'][number]['value'];
export type SettingsGroupId = typeof SETTINGS_GROUPS[number]['id'];

export function visibleSettingsGroups(available: readonly SettingsTab[]) {
  return SETTINGS_GROUPS.map(group => ({ ...group, tabs: group.tabs.filter(tab => available.includes(tab.value)) }))
    .filter(group => group.tabs.length > 0);
}

export function resolveSettingsTab(value: string | null, available: readonly SettingsTab[]): SettingsTab {
  if (available.includes(value as SettingsTab)) return value as SettingsTab;
  const group = visibleSettingsGroups(available).find(item => item.id === value);
  return group?.tabs[0]?.value ?? 'profile';
}
