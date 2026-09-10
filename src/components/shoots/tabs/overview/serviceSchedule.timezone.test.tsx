import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { buildServiceScheduleFields } from './shootOverviewEditorSupport';
import { applyOverviewServicePayload } from './shootOverviewServicePayload';
import { OverviewServiceProgressSection } from './OverviewServiceProgressSection';
import { OverviewExternalBookingSection } from './OverviewExternalBookingSection';
import type { ShootOverviewUpdatePayload } from './shootOverviewUpdateTypes';

afterEach(cleanup);

describe('service schedules in the shoot timezone', () => {
  it.each([
    { timezone: null, scheduled_at: '2026-09-09T10:00:00.000000Z' },
    { timezone: 'America/New_York', scheduled_at: '2026-09-09T14:00:00Z' },
  ])('keeps editable fields and rendered service times at 10 AM for $timezone', ({ timezone, scheduled_at }) => {
    expect(buildServiceScheduleFields(scheduled_at, timezone)).toEqual({ date: '2026-09-09', time: '10:00' });
    const shoot = { id: '86', timezone,
      serviceItems: [{ id: 126, service_id: 19, name: 'Photos', scheduled_at, workflow_status: 'scheduled' }],
      serviceObjects: [{ id: 19, name: 'Photos', scheduled_at }],
    } as unknown as ShootData;
    const progress = render(<OverviewServiceProgressSection shoot={shoot} />);
    expect(progress.container.textContent).toContain('10:00');
    progress.unmount();
    const external = render(<OverviewExternalBookingSection shoot={shoot} formatDate={(value) => value || ''} formatTime={(value) => value || ''} />);
    expect(external.container.textContent).toContain('2026-09-09');
    expect(external.container.textContent).toContain('10:00');
    expect(external.container.textContent).not.toContain('14:00');
  });

  it('preserves a separate service time when saving other overview changes', () => {
    const updates: ShootOverviewUpdatePayload = {};
    applyOverviewServicePayload({ updates, shoot: {
      id: '86', scheduledDate: '2026-09-09', time: '10:00', timezone: 'America/New_York',
      serviceItems: [{ id: 126, service_id: 19, scheduled_at: '2026-09-09T15:00:00Z' }],
    } as unknown as ShootData, isAdmin: true, omitStandardServices: false,
    selectedServiceIds: ['19'], serviceSchedules: { '19': { date: '2026-09-09', time: '10:00' } },
    servicePrices: {}, servicePhotographerPays: {}, perCategoryPhotographers: {}, servicesList: [] });
    expect(updates.service_items?.[0].scheduled_at).toBe('2026-09-09T15:00:00.000Z');
  });
});
