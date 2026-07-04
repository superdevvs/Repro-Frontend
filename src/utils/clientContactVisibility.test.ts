import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVisibleClientContact } from './clientContactVisibility';

const client = {
  name: 'Jane Client',
  email: 'jane@example.com',
  phone: '555-0100',
};

describe('getVisibleClientContact', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows photographers the client name and shoot-day phone, but never email', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T16:00:00.000Z'));

    const visible = getVisibleClientContact({
      client,
      role: 'photographer',
      shoot: {
        scheduledDate: '2026-07-04',
        timezone: 'America/New_York',
      },
    });

    expect(visible.name).toBe('Jane Client');
    expect(visible.phone).toBe('555-0100');
    expect(visible.email).toBeNull();
  });

  it('hides photographer phone after the shoot local day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T16:00:00.000Z'));

    const visible = getVisibleClientContact({
      client,
      role: 'photographer',
      shoot: {
        scheduledDate: '2026-07-04',
        timezone: 'America/New_York',
      },
    });

    expect(visible.name).toBe('Jane Client');
    expect(visible.phone).toBeNull();
    expect(visible.email).toBeNull();
  });

  it('keeps full client contact visible for privileged roles', () => {
    const visible = getVisibleClientContact({
      client,
      role: 'editing_manager',
      shoot: {
        scheduledDate: '2026-07-04',
        timezone: 'America/New_York',
      },
      shouldHideClientDetails: true,
    });

    expect(visible.name).toBe('Jane Client');
    expect(visible.phone).toBe('555-0100');
    expect(visible.email).toBe('jane@example.com');
  });
});
