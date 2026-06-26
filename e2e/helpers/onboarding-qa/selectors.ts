import type { Locator, Page } from '@playwright/test';

import type { QaReport } from './report';

/**
 * Stable-selector resolver for the photographer onboarding QA harness.
 *
 * This is harness Component 7 from the design. It resolves onboarding-critical UI elements by
 * their stable `data-testid` `Selector` rather than by button text, CSS class, or layout position
 * (Req 13.3), exposes the named selector contract every spec module relies on (Req 13.1, 13.2),
 * and — when a required `data-testid` is absent — records a `Blocked_Check` on the {@link QaReport}
 * with the missing selector noted and returns `null` instead of falling back to a brittle locator
 * (Req 13.4). Spec modules treat a `null` result as "blocked-and-continue" and never wait for
 * human input.
 *
 * Resolution uses Playwright's `page.getByTestId`, which targets the configured `testIdAttribute`
 * (`data-testid` by default in `playwright.config.ts`), keeping this resolver the single place that
 * knows how onboarding elements are located.
 */

/**
 * The named `data-testid` `Selector` contract the Onboarding_System must expose on its
 * onboarding-critical elements (Req 13.2). Spec modules reference these ids through the resolver so
 * a missing selector surfaces as a `Blocked_Check` rather than a brittle, silently-passing locator.
 */
export const REQUIRED_TESTIDS = [
  'create-photographer-button',
  'photographer-radius-input',
  'booking-address-input',
  'eligible-photographer-row',
  'cubicasa-create-order-button',
  'shoot-status-badge',
  'raw-upload-input',
  'submit-to-editor-button',
  'finalize-delivery-button',
] as const;

/** A `data-testid` value drawn from the {@link REQUIRED_TESTIDS} contract. */
export type RequiredTestId = (typeof REQUIRED_TESTIDS)[number];

export interface SelectorResolver {
  /**
   * Resolve an onboarding-critical element by its `data-testid` `Selector` (Req 13.3).
   *
   * When at least one matching element is present, returns its {@link Locator}. When the selector
   * is absent, records a `Blocked_Check` against `checkId` on the {@link QaReport} with the missing
   * selector noted and returns `null` — no brittle text/CSS/layout fallback is attempted (Req 13.4).
   *
   * @param page   The Playwright page to search.
   * @param testId The `data-testid` selector to resolve (typically a {@link RequiredTestId}).
   * @param checkId The report check id under which a `Blocked_Check` is recorded if absent.
   */
  byTestId(page: Page, testId: string, checkId: string): Promise<Locator | null>;
}

/**
 * Create a {@link SelectorResolver} that records missing selectors against the supplied
 * {@link QaReport}.
 *
 * The resolver never throws on a missing element: a missing `data-testid` is a recorded
 * `Blocked_Check` (Req 13.4), letting the calling spec continue all other checks.
 */
export function createSelectorResolver(report: QaReport): SelectorResolver {
  return {
    async byTestId(page: Page, testId: string, checkId: string): Promise<Locator | null> {
      const locator = page.getByTestId(testId);

      // Presence is determined purely by the stable `data-testid` — never by text/CSS/layout.
      const count = await locator.count();
      if (count === 0) {
        report.record(
          checkId,
          '13.4',
          'blocked',
          `Missing data-testid selector "${testId}" — element not found on the page.`,
        );
        return null;
      }

      // Return the first match so callers get a single, stable handle even when a selector (e.g.
      // `eligible-photographer-row`) legitimately matches multiple elements.
      return locator.first();
    },
  };
}
