import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import type { StudioRecentProject } from '@/services/studioMetricsService';
import type { StudioProjectSummary } from '@/services/studioService';

import {
  projectRequiredFields,
  recentProjectRouteTarget,
} from './StudioRecentProjects';

describe('Feature: ai-editing-studio-revamp, Property 27: Recent Project fields', () => {
  it('preserves the original photo/video deep-link mapping', () => {
    fc.assert(
      fc.property(fc.constantFrom('photo' as const, 'video' as const), fc.integer({ min: 1 }), fc.string({ minLength: 1 }), (jobType, shootId, address) => {
        const project = {
          latest_job_type: jobType,
          shoot_id: shootId,
          address,
        } as StudioRecentProject;
        expect(recentProjectRouteTarget(project)).toEqual({
          subtab: jobType === 'video' ? 'video' : 'photo',
          shoot: { id: shootId, address },
        });
      }),
      { numRuns: 40 },
    );
  });

  it('renders from the five required server fields; validates Requirements 9.3, 9.5', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.date().map((date) => date.toISOString()),
        fc.nat(),
        (thumbnailRef, workflow, status, lastActivityAt, mediaCount) => {
          const result = projectRequiredFields({
            thumbnailRef,
            latestWorkflow: workflow,
            latestStatus: status,
            lastActivityAt,
            mediaCount,
          } as StudioProjectSummary);
          expect(result).toEqual({
            thumbnail: thumbnailRef,
            workflow,
            status,
            activity: lastActivityAt,
            mediaCount,
          });
        },
      ),
      { numRuns: 40 },
    );
  });
});

