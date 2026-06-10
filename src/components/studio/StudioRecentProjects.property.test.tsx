// Property-based test for recent-project deep-link routing.
//
// Feature: ai-editing-default-page, Property 8: Recent-project deep-link routes
// by latest job type.
// Validates: Requirements 5.4
//
// For any Recent_Project, selecting it opens the Subtab corresponding to that
// project's most-recent job type (photo job → Photo Subtab, video job → Video
// Subtab) with that project's shoot selected. The routing decision lives in the
// pure `recentProjectRouteTarget` helper, so the property is exercised directly
// against the helper across arbitrary projects, and additionally confirmed end
// to end by rendering StudioRecentProjects with a mocked hook and clicking the
// row.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import fc from 'fast-check';

import {
  StudioRecentProjects,
  recentProjectRouteTarget,
} from './StudioRecentProjects';
import type {
  StudioJobType,
  StudioRecentProject,
} from '@/services/studioMetricsService';

// Mock the data hook so the rendered component yields whatever project we feed
// it, isolating the routing behaviour under test.
const useStudioRecentProjectsMock = vi.fn();
vi.mock('@/hooks/useStudioMetrics', () => ({
  useStudioRecentProjects: () => useStudioRecentProjectsMock(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Arbitrary for an arbitrary Recent_Project: random shoot id, address, status,
// activity timestamp, and a latest_job_type drawn from the two valid values.
const jobType: fc.Arbitrary<StudioJobType> = fc.constantFrom('photo', 'video');

// Addresses are surfaced through the row's accessible name (`Open <address>`),
// which the DOM normalizes (trim + collapse whitespace). Generate addresses
// from a printable alphabet with single internal spaces and no edge whitespace
// so the rendered accessible name matches the input verbatim, keeping the
// render assertion stable while still exploring a wide address space.
const address: fc.Arbitrary<string> = fc
  .array(
    fc.stringMatching(/^[A-Za-z0-9]+$/).filter((s) => s.length > 0),
    { minLength: 1, maxLength: 6 },
  )
  .map((words) => words.join(' '));

const recentProject: fc.Arbitrary<StudioRecentProject> = fc.record({
  shoot_id: fc.integer({ min: 1, max: 1_000_000 }),
  address,
  last_activity_at: fc
    .date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') })
    .map((d) => d.toISOString()),
  latest_status: fc.constantFrom(
    'completed',
    'failed',
    'cancelled',
    'processing',
    'queued',
    'pending',
  ),
  latest_job_type: jobType,
});

describe('Feature: ai-editing-default-page, Property 8: Recent-project deep-link routes by latest job type', () => {
  it('recentProjectRouteTarget routes by latest_job_type with the shoot selected', () => {
    fc.assert(
      fc.property(recentProject, (project) => {
        const target = recentProjectRouteTarget(project);

        // Subtab matches the project's most-recent job type.
        const expectedSubtab =
          project.latest_job_type === 'video' ? 'video' : 'photo';
        expect(target.subtab).toBe(expectedSubtab);

        // The project's shoot is preselected: { id, address }.
        expect(target.shoot).toEqual({
          id: project.shoot_id,
          address: project.address,
        });
      }),
      { numRuns: 100 },
    );
  });

  it('clicking a recent-project row calls routeToCapability with that deep-link target', async () => {
    // delay: null removes userEvent's inter-event setTimeout scheduling, which
    // keeps this many-iteration property test fast and stable.
    const user = userEvent.setup({ delay: null });

    await fc.assert(
      fc.asyncProperty(recentProject, async (project) => {
        cleanup();
        vi.clearAllMocks();

        useStudioRecentProjectsMock.mockReturnValue({
          data: [project],
          isLoading: false,
          isError: false,
        });
        const routeToCapability = vi.fn();

        render(
          <StudioRecentProjects routeToCapability={routeToCapability} />,
        );

        await user.click(
          screen.getByRole('button', { name: `Open ${project.address}` }),
        );

        const expectedSubtab =
          project.latest_job_type === 'video' ? 'video' : 'photo';

        expect(routeToCapability).toHaveBeenCalledTimes(1);
        expect(routeToCapability).toHaveBeenCalledWith({
          subtab: expectedSubtab,
          shoot: { id: project.shoot_id, address: project.address },
        });
      }),
      { numRuns: 100 },
    );
  }, 30000);
});
