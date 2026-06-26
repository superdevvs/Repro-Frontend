// Property-based + unit tests for the stable-selector resolver (`selectors.ts`).
//
// Feature: photographer-onboarding-qa, Property 7: Missing-data and missing-selector yield
// blocked-and-continue.
//
// For ANY check whose required `data-testid` selector is missing, the resolver records that check
// as `blocked` on the QA_Report with the missing selector noted and returns `null` — and it does so
// WITHOUT throwing or waiting for human input, so every subsequent check in a mixed
// present/absent sequence is still resolved (continue-on-block). When a selector IS present the
// resolver returns a non-null handle and records NO blocked entry for that check.
//
// The resolver takes a Playwright `Page`, so this pure vitest unit constructs a minimal fake Page
// exposing `getByTestId(testId) -> { count: async () => N, first: () => marker }` where `N` is 0
// (absent) or > 0 (present). The real `createQaReport()` collector is used so the recorded
// `blocked` entries are asserted against production behaviour, not a stub.
//
// Validates: Requirements 2.6, 8.13, 13.4

import type { Locator, Page } from '@playwright/test';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createQaReport } from './report';
import { createSelectorResolver, REQUIRED_TESTIDS } from './selectors';

/**
 * A single planned resolution in a sequence: which `data-testid` base to request and whether the
 * fake page should expose it (and, when present, how many matching elements exist — a selector such
 * as `eligible-photographer-row` legitimately matches several).
 */
const entryArb = fc.record({
  // Draw from the real REQUIRED_TESTIDS contract as well as arbitrary text so the property holds
  // for both contract selectors and ad-hoc ones.
  base: fc.oneof(
    fc.constantFrom(...REQUIRED_TESTIDS),
    fc.string({ minLength: 1, maxLength: 20 }),
  ),
  present: fc.boolean(),
  // Only consulted when `present` is true; >= 1 guarantees a non-empty match.
  count: fc.integer({ min: 1, max: 8 }),
});

/** A mixed sequence of present/absent selector resolutions, always containing at least one entry. */
const sequenceArb = fc.array(entryArb, { minLength: 1, maxLength: 12 });

interface PlannedEntry {
  testId: string;
  checkId: string;
  present: boolean;
  count: number;
  /** The unique handle the fake page's `first()` returns when this selector is present. */
  marker: object;
}

/**
 * Build a minimal fake Playwright {@link Page}. `getByTestId` looks the requested id up in the
 * plan and returns a locator-shaped object whose `count()` reflects presence and whose `first()`
 * yields this entry's unique marker. testIds are made unique per entry by the caller, so a single
 * id maps to a single presence/count/marker triple.
 */
function makeFakePage(plan: PlannedEntry[]): Page {
  const byId = new Map(plan.map((entry) => [entry.testId, entry]));

  const page = {
    getByTestId(testId: string): Locator {
      const entry = byId.get(testId);
      const count = entry?.present ? entry.count : 0;
      const locator = {
        count: async () => count,
        first: () => (entry?.marker ?? {}) as unknown as Locator,
      };
      return locator as unknown as Locator;
    },
  };

  return page as unknown as Page;
}

describe('Feature: photographer-onboarding-qa, Property 7: Missing-data and missing-selector yield blocked-and-continue', () => {
  it('blocks-and-continues on missing selectors while resolving present ones, across mixed sequences', async () => {
    await fc.assert(
      fc.asyncProperty(sequenceArb, async (rawEntries) => {
        // Make every testId/checkId unique per position so a single fake-page lookup maps to a
        // single presence decision, and so same-base selectors at different positions are distinct.
        const plan: PlannedEntry[] = rawEntries.map((raw, index) => ({
          testId: `${raw.base}__${index}`,
          checkId: `check-${index}`,
          present: raw.present,
          count: raw.count,
          marker: { handle: index },
        }));

        // Use the REAL report collector and resolver (no stubs) for genuine behaviour.
        const report = createQaReport();
        const resolver = createSelectorResolver(report);
        const page = makeFakePage(plan);

        const results: Array<Locator | null> = [];
        for (const entry of plan) {
          // A missing selector must NOT throw — it must resolve to null so the loop continues.
          const result = await resolver.byTestId(page, entry.testId, entry.checkId);
          results.push(result);
        }

        // Continue-on-block: every planned check was resolved (the loop never aborted), regardless
        // of how many selectors were missing (Req 2.6, 8.13 — never wait for human input).
        expect(results).toHaveLength(plan.length);

        const entriesById = new Map(report.entries().map((e) => [e.id, e]));

        plan.forEach((entry, index) => {
          const reportEntry = entriesById.get(entry.checkId);
          if (entry.present) {
            // Present selector → non-null handle (the entry's own marker) and NO blocked record.
            expect(results[index]).toBe(entry.marker);
            expect(results[index]).not.toBeNull();
            expect(reportEntry).toBeUndefined();
          } else {
            // Absent selector → null result AND a recorded `blocked` check naming the missing
            // selector under requirement 13.4 (Req 13.4).
            expect(results[index]).toBeNull();
            expect(reportEntry).toBeDefined();
            expect(reportEntry?.result).toBe('blocked');
            expect(reportEntry?.requirement).toBe('13.4');
            expect(reportEntry?.note ?? '').toContain(entry.testId);
          }
        });

        // The report's blocked entries are EXACTLY the absent checks — present checks contribute
        // no entries, and no spurious blocked check is invented.
        const blockedIds = report
          .entries()
          .filter((e) => e.result === 'blocked')
          .map((e) => e.id)
          .sort();
        const expectedBlockedIds = plan
          .filter((entry) => !entry.present)
          .map((entry) => entry.checkId)
          .sort();
        expect(blockedIds).toEqual(expectedBlockedIds);

        // Explicit "continue" teeth: any present check that follows an absent one still resolved to
        // its non-null handle — an earlier missing selector never prevented a later resolution.
        const firstAbsentIndex = plan.findIndex((entry) => !entry.present);
        if (firstAbsentIndex >= 0) {
          for (let i = firstAbsentIndex + 1; i < plan.length; i += 1) {
            if (plan[i].present) {
              expect(results[i]).toBe(plan[i].marker);
            }
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('records a single blocked check naming the absent selector and returns null (concrete example)', async () => {
    const report = createQaReport();
    const resolver = createSelectorResolver(report);
    const page = makeFakePage([
      { testId: 'cubicasa-create-order-button', checkId: 'cubicasa-visible', present: false, count: 0, marker: {} },
    ]);

    const result = await resolver.byTestId(page, 'cubicasa-create-order-button', 'cubicasa-visible');

    expect(result).toBeNull();
    const entries = report.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'cubicasa-visible',
      requirement: '13.4',
      result: 'blocked',
    });
    expect(entries[0].note).toContain('cubicasa-create-order-button');
  });

  it('returns the present element handle and records nothing (concrete example)', async () => {
    const report = createQaReport();
    const resolver = createSelectorResolver(report);
    const marker = { handle: 'first-row' };
    const page = makeFakePage([
      { testId: 'eligible-photographer-row', checkId: 'eligible-rows', present: true, count: 3, marker },
    ]);

    const result = await resolver.byTestId(page, 'eligible-photographer-row', 'eligible-rows');

    expect(result).toBe(marker);
    expect(report.entries()).toHaveLength(0);
  });
});
