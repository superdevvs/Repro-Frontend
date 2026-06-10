// Property-based test for the Studio Subtab navigation invariant.
//
// Feature: ai-editing-default-page, Property 1: Subtab selection is a
// consistent navigation invariant.
// Validates: Requirements 2.2, 2.3, 2.4, 2.5
//
// For any Subtab in {studio, photo, video}, rendering StudioSubtabNav with that
// subtab active marks exactly that one subtab as selected (aria-selected=true)
// and no other; and clicking any subtab tab invokes `onSelect` with exactly
// that subtab id. StudioSubtabNav is a controlled component that performs no
// navigation of its own, so selection never takes the Client off the page.
//
// StudioSubtabNav is the navigation invariant surface for the Studio shell, so
// it is the correct unit to exercise this property against.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import fc from 'fast-check';

import { StudioSubtabNav } from './StudioSubtabNav';
import type { StudioSubtab } from './types';

afterEach(() => {
  cleanup();
});

// The full input space: the three defined Subtabs.
const SUBTABS: readonly StudioSubtab[] = ['studio', 'photo', 'video'];

// The accessible label rendered for each subtab id, used to find its tab.
const SUBTAB_LABEL: Record<StudioSubtab, string> = {
  studio: 'Studio',
  photo: 'Photo',
  video: 'Video',
};

const arbitrarySubtab: fc.Arbitrary<StudioSubtab> = fc.constantFrom(...SUBTABS);

describe('Feature: ai-editing-default-page, Property 1: Subtab selection is a consistent navigation invariant', () => {
  it('marks exactly the active subtab as selected and no other', () => {
    fc.assert(
      fc.property(arbitrarySubtab, (activeSubtab) => {
        cleanup();
        render(
          <StudioSubtabNav activeSubtab={activeSubtab} onSelect={vi.fn()} />,
        );

        const tabs = screen.getAllByRole('tab');
        // All three Subtabs are always presented (Req 2.1 surface).
        expect(tabs).toHaveLength(SUBTABS.length);

        // Exactly one tab is marked selected, and it is the active one.
        const selected = tabs.filter(
          (tab) => tab.getAttribute('aria-selected') === 'true',
        );
        expect(selected).toHaveLength(1);
        expect(selected[0]).toHaveTextContent(SUBTAB_LABEL[activeSubtab]);

        // Every other subtab is explicitly not selected.
        for (const subtab of SUBTABS) {
          const tab = screen.getByRole('tab', {
            name: SUBTAB_LABEL[subtab],
          });
          expect(tab.getAttribute('aria-selected')).toBe(
            subtab === activeSubtab ? 'true' : 'false',
          );
        }
      }),
      { numRuns: 200 },
    );
  });

  it('clicking any subtab invokes onSelect with exactly that subtab id', async () => {
    // delay: null removes userEvent's inter-event setTimeout scheduling, which
    // keeps this many-iteration property test fast and stable.
    const user = userEvent.setup({ delay: null });

    await fc.assert(
      fc.asyncProperty(
        arbitrarySubtab,
        arbitrarySubtab,
        async (activeSubtab, targetSubtab) => {
          cleanup();
          const onSelect = vi.fn();
          render(
            <StudioSubtabNav
              activeSubtab={activeSubtab}
              onSelect={onSelect}
            />,
          );

          await user.click(
            screen.getByRole('tab', { name: SUBTAB_LABEL[targetSubtab] }),
          );

          // Selecting a subtab reports exactly that subtab id back to the
          // parent — the single source of the navigation invariant. The
          // controlled component performs no navigation itself (no route
          // change), it only emits the selection.
          expect(onSelect).toHaveBeenCalledTimes(1);
          expect(onSelect).toHaveBeenCalledWith(targetSubtab);
        },
      ),
      { numRuns: 200 },
    );
  }, 30000);
});
