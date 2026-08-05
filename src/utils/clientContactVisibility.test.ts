import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVisibleClientContact, isWithinPhotographerContactWindow } from './clientContactVisibility';

const client = {
  name: 'Jane Client',
  email: 'jane@example.com',
  phone: '555-0100',
};

// 2026-07-04 14:00 America/New_York === 18:00Z, so the photographer window runs
// 16:00Z (start - 2h) .. 21:00Z (start + 1h buffer + 2h).
const shoot = {
  scheduledAt: '2026-07-04T14:00:00-04:00',
  scheduledDate: '2026-07-04',
  time: '14:00',
  timezone: 'America/New_York',
};

const at = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

describe('getVisibleClientContact', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows photographers the client name and phone inside the shoot window, but never email', () => {
    at('2026-07-04T17:30:00.000Z');

    const visible = getVisibleClientContact({ client, role: 'photographer', shoot });

    expect(visible.name).toBe('Jane Client');
    expect(visible.phone).toBe('555-0100');
    expect(visible.email).toBeNull();
  });

  it('unlocks the phone exactly two hours before the start and keeps the name visible before that', () => {
    at('2026-07-04T16:00:00.000Z');
    expect(getVisibleClientContact({ client, role: 'photographer', shoot }).phone).toBe('555-0100');

    at('2026-07-04T15:59:00.000Z');
    const beforeWindow = getVisibleClientContact({ client, role: 'photographer', shoot });
    expect(beforeWindow.phone).toBeNull();
    expect(beforeWindow.name).toBe('Jane Client');
  });

  it('keeps the phone through the one hour buffer plus two hours, then hides it', () => {
    at('2026-07-04T21:00:00.000Z');
    expect(getVisibleClientContact({ client, role: 'photographer', shoot }).phone).toBe('555-0100');

    at('2026-07-04T21:01:00.000Z');
    expect(getVisibleClientContact({ client, role: 'photographer', shoot }).phone).toBeNull();
  });

  it('hides the phone later on the shoot day once the window has closed', () => {
    at('2026-07-05T02:00:00.000Z');

    const visible = getVisibleClientContact({ client, role: 'photographer', shoot });

    expect(visible.name).toBe('Jane Client');
    expect(visible.phone).toBeNull();
  });

  it('anchors the window in the shoot timezone when scheduledAt is missing', () => {
    const localOnlyShoot = {
      scheduledDate: '2026-07-04',
      time: '14:00:00',
      timezone: 'America/New_York',
    };

    at('2026-07-04T17:30:00.000Z');
    expect(isWithinPhotographerContactWindow(localOnlyShoot)).toBe(true);

    at('2026-07-04T14:00:00.000Z');
    expect(isWithinPhotographerContactWindow(localOnlyShoot)).toBe(false);
  });

  it('hides the phone for editors and keeps full contact for privileged roles', () => {
    at('2026-07-04T17:30:00.000Z');

    const editorView = getVisibleClientContact({
      client,
      role: 'editor',
      shoot,
      shouldHideClientDetails: true,
    });
    expect(editorView.name).toBeNull();
    expect(editorView.phone).toBeNull();

    const managerView = getVisibleClientContact({
      client,
      role: 'editing_manager',
      shoot,
      shouldHideClientDetails: true,
    });
    expect(managerView.name).toBe('Jane Client');
    expect(managerView.phone).toBe('555-0100');
    expect(managerView.email).toBe('jane@example.com');
  });
});
