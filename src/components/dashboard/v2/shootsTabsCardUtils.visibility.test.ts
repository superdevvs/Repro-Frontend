import { describe, expect, it } from 'vitest';

import { visiblePastDayGroups } from './shootsTabsCardUtils';

describe('editing manager past-day visibility', () => {
  const pastGroups = [{ label: 'Jul 1' }, { label: 'Jul 2' }, { label: 'Jul 3' }, { label: 'Jul 4' }];

  it('shows every past-dated upcoming group without toggling Previous shoots', () => {
    expect(visiblePastDayGroups(pastGroups, {
      mode: 'editing_manager',
      tabId: 'upcoming',
      showPastDays: false,
    })).toEqual(pastGroups);
  });

  it('shows past-dated uploaded and ready groups without toggling Previous shoots', () => {
    expect(visiblePastDayGroups(pastGroups, {
      mode: 'editing_manager',
      tabId: 'uploaded',
      showPastDays: false,
    })).toEqual(pastGroups);
    expect(visiblePastDayGroups(pastGroups, {
      mode: 'editing_manager',
      tabId: 'ready',
      showPastDays: false,
    })).toEqual(pastGroups);
  });

  it('keeps scheduled past days hidden until Previous shoots is turned on', () => {
    expect(visiblePastDayGroups(pastGroups, {
      mode: 'editing_manager',
      tabId: 'scheduled',
      showPastDays: false,
    })).toEqual([]);
    expect(visiblePastDayGroups(pastGroups, {
      mode: 'editing_manager',
      tabId: 'scheduled',
      showPastDays: true,
    })).toEqual(pastGroups.slice(0, 3));
  });

  it('does not change the default dashboard upcoming toggle', () => {
    expect(visiblePastDayGroups(pastGroups, {
      mode: 'default',
      tabId: 'upcoming',
      showPastDays: false,
    })).toEqual([]);
  });
});
