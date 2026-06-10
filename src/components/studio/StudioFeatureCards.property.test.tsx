// Property-based test for feature card and template routing.
//
// Feature: ai-editing-default-page, Property 4: Feature card and template
// routing.
// Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.3
//
// For any feature card or template with a defined target, activating its Start
// control invokes `routeToCapability` exactly once with that item's exact
// target object — opening the target subtab with the target's preselected
// enhancement mode or feature capability active — without navigating the Client
// away from the Studio_Page (the components are controlled and emit the target
// rather than performing any route change of their own).
//
// StudioFeatureCards and StudioTemplatesCarousel are the two routing surfaces of
// the Studio Landing, so they are the correct units to exercise this property
// against. The six feature-card targets are additionally pinned to the exact
// design route mapping (Req 4.2–4.7).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import fc from 'fast-check';

import {
  STUDIO_FEATURE_CARDS,
  StudioFeatureCards,
} from './StudioFeatureCards';
import {
  STUDIO_TEMPLATES,
  StudioTemplatesCarousel,
} from './StudioTemplatesCarousel';
import type { RouteTarget } from './types';

afterEach(() => {
  cleanup();
});

// Index arbitraries over the exported arrays. Drawing an index lets fast-check
// explore the full input space (every card / template) across many iterations.
const featureCardIndex: fc.Arbitrary<number> = fc.integer({
  min: 0,
  max: STUDIO_FEATURE_CARDS.length - 1,
});

const templateIndex: fc.Arbitrary<number> = fc.integer({
  min: 0,
  max: STUDIO_TEMPLATES.length - 1,
});

// The exact design route mapping for the six Feature_Cards (Req 4.2–4.7).
const EXPECTED_CARD_TARGETS: Record<string, RouteTarget> = {
  Photo_Enhancement_Card: {
    subtab: 'photo',
    photoMode: 'enhance',
    photoCapability: 'workspace',
  },
  Twilight_Card: {
    subtab: 'photo',
    photoMode: 'sky_replace',
    photoCapability: 'workspace',
  },
  Video_Cleanup_Card: { subtab: 'video', videoCapability: 'cleanup' },
  Listing_Video_Card: { subtab: 'video', videoCapability: 'listing' },
  Reel_Generator_Card: { subtab: 'video', videoCapability: 'reel' },
  Batch_Jobs_Card: { subtab: 'photo', photoCapability: 'batch' },
};

describe('Feature: ai-editing-default-page, Property 4: Feature card and template routing', () => {
  // Pin the six feature cards to the exact design mapping. This guards the
  // routing targets that the property below relies on (Req 4.2–4.7).
  it('the six feature cards match the exact design route mapping', () => {
    expect(STUDIO_FEATURE_CARDS.map((card) => card.id)).toEqual([
      'Photo_Enhancement_Card',
      'Twilight_Card',
      'Video_Cleanup_Card',
      'Listing_Video_Card',
      'Reel_Generator_Card',
      'Batch_Jobs_Card',
    ]);

    for (const card of STUDIO_FEATURE_CARDS) {
      expect(card.target).toEqual(EXPECTED_CARD_TARGETS[card.id]);
    }
  });

  it('activating a feature card Start control routes to that card exact target exactly once', async () => {
    // delay: null removes userEvent's inter-event setTimeout scheduling, which
    // keeps this many-iteration property test fast and stable.
    const user = userEvent.setup({ delay: null });

    await fc.assert(
      fc.asyncProperty(featureCardIndex, async (index) => {
        cleanup();
        const card = STUDIO_FEATURE_CARDS[index];
        const routeToCapability = vi.fn();

        // canUseAutoenhance=true so the Start controls are enabled (Req 12.1).
        render(
          <StudioFeatureCards
            routeToCapability={routeToCapability}
            canUseAutoenhance={true}
          />,
        );

        // Find this card's Start control by its accessible label and click it.
        await user.click(
          screen.getByRole('button', { name: `Start ${card.title}` }),
        );

        // Routing emits exactly the card's target object, exactly once. The
        // component performs no navigation itself (no route change) — it only
        // reports the target to the parent.
        expect(routeToCapability).toHaveBeenCalledTimes(1);
        expect(routeToCapability).toHaveBeenCalledWith(card.target);
        // And the emitted target is exactly the pinned design mapping.
        expect(routeToCapability.mock.calls[0][0]).toEqual(
          EXPECTED_CARD_TARGETS[card.id],
        );
      }),
      { numRuns: 100 },
    );
  }, 30000);

  it('selecting a template routes to that template exact target exactly once', async () => {
    const user = userEvent.setup({ delay: null });

    await fc.assert(
      fc.asyncProperty(templateIndex, async (index) => {
        cleanup();
        const template = STUDIO_TEMPLATES[index];
        const routeToCapability = vi.fn();

        render(
          <StudioTemplatesCarousel routeToCapability={routeToCapability} />,
        );

        // Each template is a button labelled "Start template <title>".
        await user.click(
          screen.getByRole('button', {
            name: `Start template ${template.title}`,
          }),
        );

        expect(routeToCapability).toHaveBeenCalledTimes(1);
        expect(routeToCapability).toHaveBeenCalledWith(template.target);
        // Selecting a template opens a defined subtab with its preset mode /
        // capability (Req 7.3).
        const emitted = routeToCapability.mock.calls[0][0] as RouteTarget;
        expect(['studio', 'photo', 'video']).toContain(emitted.subtab);
        expect(emitted).toEqual(template.target);
      }),
      { numRuns: 100 },
    );
  }, 30000);

  // Guard the disabled-state contract the routing property depends on: when the
  // role check is false, Start controls are disabled and cannot route (Req 12.1).
  it('feature card Start controls are disabled and do not route when canUseAutoenhance is false', async () => {
    const user = userEvent.setup();
    const routeToCapability = vi.fn();

    render(
      <StudioFeatureCards
        routeToCapability={routeToCapability}
        canUseAutoenhance={false}
      />,
    );

    const startButtons = screen.getAllByRole('button', { name: /^Start / });
    expect(startButtons).toHaveLength(STUDIO_FEATURE_CARDS.length);
    for (const button of startButtons) {
      expect(button).toBeDisabled();
      await user.click(button);
    }
    expect(routeToCapability).not.toHaveBeenCalled();
  });
});
