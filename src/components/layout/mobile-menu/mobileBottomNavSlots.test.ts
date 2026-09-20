import { describe, expect, it } from 'vitest';
import { buildMobileBottomNavSlots } from './mobileBottomNavSlots';

const item = (to: string, label = to) => ({ to, label, icon: 'Home', isActive: false });

describe('mobile bottom nav slots', () => {
  it('uses Settings instead of an empty availability slot for editor-style menus', () => {
    const slots = buildMobileBottomNavSlots([
      item('/dashboard', 'Dashboard'),
      item('/shoot-history', 'Shoots'),
      item('/settings', 'Settings'),
    ]);

    expect(slots.map((slot) => slot.label)).toEqual(['Dashboard', 'Shoots', 'Settings']);
  });

  it('keeps availability for photographers and does not add a second Settings slot', () => {
    const slots = buildMobileBottomNavSlots([
      item('/dashboard', 'Dashboard'),
      item('/shoot-history', 'Shoots'),
      item('/availability', 'Availability'),
      item('/settings', 'Settings'),
    ]);

    expect(slots.map((slot) => slot.label)).toEqual(['Dashboard', 'Shoots', 'Availability']);
  });
});
