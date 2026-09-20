export interface MobileBottomNavSlot {
  to: string;
  icon: string;
  label: string;
  isActive?: boolean;
}

export function buildMobileBottomNavSlots<T extends MobileBottomNavSlot>(items: T[]): T[] {
  const dashboardItem = items.find((item) => item.to === '/dashboard');
  const shootsItem = items.find((item) => item.to === '/shoot-history');
  const bookItem = items.find((item) => item.to === '/book-shoot');
  const availabilityItem = items.find((item) => item.to === '/availability');
  const settingsItem = items.find((item) => item.to === '/settings');

  const slots = bookItem
    ? [dashboardItem, shootsItem, { ...bookItem, label: 'New Shoot' }, availabilityItem]
    : [dashboardItem, shootsItem, availabilityItem ?? settingsItem];

  return slots.filter((item): item is T => Boolean(item));
}
