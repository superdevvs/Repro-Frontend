import { describe, expect, it } from 'vitest';
import { getAssignedNotificationPhotographers, getHoldNotificationAvailability } from './useHoldNotifications';
import { transformShootFromApi } from '@/context/shootNormalization';

const raw = {
  id: 2071, photographer_id: 1123,
  photographer: { id: 1123, name: 'Alex', email: 'alex@example.test' },
  services: [43, 72].map((id) => ({
    id, name: 'Photos', pivot: { photographer_id: 1134 },
    photographer: { id: 1134, name: 'Darryl', email: 'darryl@example.test' },
  })),
};

describe('update notification assignees', () => {
  it('excludes the original primary and deduplicates current service assignees', () => {
    expect(getAssignedNotificationPhotographers(transformShootFromApi(raw)))
      .toEqual([expect.objectContaining({ id: '1134', name: 'Darryl', email: 'darryl@example.test' })]);
  });
  it('keeps primary only when a service inherits it', () => {
    const shoot = transformShootFromApi({ ...raw, services: [raw.services[0], {
      id: 52, name: 'Twilight', pivot: { photographer_id: null },
    }] });
    expect(getAssignedNotificationPhotographers(shoot).map((person) => String(person.id))).toEqual(['1134', '1123']);
  });
  it('does not enable stale primary email when actual assignee has none', () => {
    const shoot = transformShootFromApi({ ...raw, services: [{
      ...raw.services[0], photographer: { id: 1134, name: 'Darryl', email: null },
    }] });
    expect(getHoldNotificationAvailability(shoot, ['email']).photographerAvailable).toBe(false);
  });
  it('supports shoots without service assignments', () => {
    expect(getAssignedNotificationPhotographers(transformShootFromApi({ ...raw, services: [] })))
      .toEqual([expect.objectContaining({ name: 'Alex', email: 'alex@example.test' })]);
  });
});
