// Property-based test for the photographer-onboarding-qa confirmation gate.
//
// This is a CORE / REQUIRED property test (Requirement 23.1). It exercises the pure,
// in-memory gating logic in `confirmation-gate.ts` across generated step kinds, confirm
// allow-flag combinations, optional categories, and the presence/absence of a non-charging
// path. It uses no Playwright `page` fixture (no browser is launched) — it is co-located
// here as a `*.e2e.ts` spec only so the existing Playwright runner discovers it.
//
// Validates: Requirements 2.2, 2.3, 2.4, 2.5, 18.11, 18.12, 21.2, 23.1

import { test, expect } from '@playwright/test';
import fc from 'fast-check';

import { createConfirmationGate, type StepKind } from './confirmation-gate';
import type { QaEnv } from './env';

/** The closed set of guarded step kinds the gate recognises. */
const STEP_KINDS: StepKind[] = ['destructive', 'charge', 'message'];

/**
 * A small fixed pool of category tokens. Drawing both `E2E_CONFIRM_CATEGORIES` entries and a
 * step's own category from the same pool makes overlaps (and thus category-based confirmation)
 * occur with meaningful frequency rather than essentially never.
 */
const CATEGORY_POOL = ['cubicasa', 'stripe', 'twilio', 'telnyx', 'square', 'deletes'];

/**
 * Build a full {@link QaEnv}-shaped object. Only the four confirm-related fields influence the
 * gate, but the rest are populated with realistic defaults so the object is structurally a
 * genuine QaEnv (the gate must work against the real shape, not a hand-picked subset).
 */
function makeEnv(flags: {
  confirmDestructive: boolean;
  confirmCharge: boolean;
  confirmMessage: boolean;
  confirmCategories?: string[];
}): QaEnv {
  return {
    baseUrl: 'http://localhost:5173',
    apiBaseUrl: 'http://localhost:5173',
    noServer: true,
    adminEmail: 'admin@example.com',
    adminPassword: 'password',
    previewStorageState: undefined,
    runId: 'qaproperty',
    externalBookingApiKey: undefined,
    notificationMode: 'log',
    emailMode: 'log',
    smsMode: 'log',
    voiceMode: 'disabled',
    confirmDestructive: flags.confirmDestructive,
    confirmCharge: flags.confirmCharge,
    confirmMessage: flags.confirmMessage,
    confirmCategories: flags.confirmCategories,
    seededAddressSet: undefined,
  };
}

/**
 * Independently reproduce the gate's documented confirmation semantics (design.md §5):
 * a step is confirmed when its category opts in via `E2E_CONFIRM_CATEGORIES`, OR when the
 * per-kind allow-flag is set. Computing this here (rather than asking the gate) lets the
 * assertions genuinely verify the "if and only if confirmed" contract.
 */
function expectedConfirmed(
  flags: {
    confirmDestructive: boolean;
    confirmCharge: boolean;
    confirmMessage: boolean;
    confirmCategories?: string[];
  },
  kind: StepKind,
  category?: string,
): boolean {
  if (category && flags.confirmCategories?.includes(category)) {
    return true;
  }
  switch (kind) {
    case 'destructive':
      return flags.confirmDestructive;
    case 'charge':
      return flags.confirmCharge;
    case 'message':
      return flags.confirmMessage;
    default:
      return false;
  }
}

/** Generator for a full set of gate inputs: flags, kind, category, and non-charging-path presence. */
const gateScenarioArb = fc.record({
  confirmDestructive: fc.boolean(),
  confirmCharge: fc.boolean(),
  confirmMessage: fc.boolean(),
  // Optional comma-list of confirmed categories (sometimes absent, sometimes overlapping).
  confirmCategories: fc.option(
    fc.uniqueArray(fc.constantFrom(...CATEGORY_POOL), { minLength: 1, maxLength: CATEGORY_POOL.length }),
    { nil: undefined },
  ),
  kind: fc.constantFrom(...STEP_KINDS),
  // The step's own category — sometimes drawn from the pool, sometimes absent.
  category: fc.option(fc.constantFrom(...CATEGORY_POOL), { nil: undefined }),
  hasNonChargingPath: fc.boolean(),
});

test.describe('Feature: photographer-onboarding-qa, Property 1: The confirmation gate gates execution', () => {
  test('gates every guarded step: non-charging path wins, else action runs iff confirmed (Req 2.2-2.5, 18.11, 18.12, 21.2, 23.1)', async () => {
    await fc.assert(
      fc.asyncProperty(gateScenarioArb, async (scenario) => {
        const flags = {
          confirmDestructive: scenario.confirmDestructive,
          confirmCharge: scenario.confirmCharge,
          confirmMessage: scenario.confirmMessage,
          confirmCategories: scenario.confirmCategories,
        };
        const env = makeEnv(flags);
        const gate = createConfirmationGate(env);

        // Spies recording exactly which path executed and how many times.
        let actionCalls = 0;
        let nonChargingCalls = 0;
        const ACTION_VALUE = 'charging-action-result';
        const SAFE_VALUE = 'non-charging-result';

        const step = {
          name: `guarded-${scenario.kind}`,
          kind: scenario.kind,
          category: scenario.category,
          nonChargingPath: scenario.hasNonChargingPath
            ? async () => {
                nonChargingCalls += 1;
                return SAFE_VALUE;
              }
            : undefined,
          action: async () => {
            actionCalls += 1;
            return ACTION_VALUE;
          },
        };

        const confirmed = expectedConfirmed(flags, scenario.kind, scenario.category);

        // The gate's own confirmation predicate must match the documented semantics.
        expect(gate.isConfirmed(scenario.kind, scenario.category)).toBe(confirmed);

        const result = await gate.run(step);

        if (scenario.hasNonChargingPath) {
          // A non-charging path is ALWAYS preferred and runs without confirmation;
          // the charging action must NEVER be invoked (Req 2.5, 18.12).
          expect(result.status).toBe('executed');
          expect(result.value).toBe(SAFE_VALUE);
          expect(nonChargingCalls).toBe(1);
          expect(actionCalls).toBe(0);
        } else if (confirmed) {
          // No safe path + confirmed → the real mutating/charging action executes
          // exactly once (Req 2.2, 2.4 — the "only if confirmed" half of the iff).
          expect(result.status).toBe('executed');
          expect(result.value).toBe(ACTION_VALUE);
          expect(actionCalls).toBe(1);
          expect(nonChargingCalls).toBe(0);
        } else {
          // No safe path + not confirmed → no mutation occurs and the step is recorded
          // as skipped (Req 2.1, 2.3, 21.2 — the "never unless confirmed" half of the iff).
          expect(result.status).toBe('skipped');
          expect(result.value).toBeUndefined();
          expect(actionCalls).toBe(0);
          expect(nonChargingCalls).toBe(0);
          expect(result.reason).toContain(scenario.kind);
        }

        // Cross-cutting invariant: the charging action runs IF AND ONLY IF there is no
        // non-charging path AND the gate is confirmed for this kind/category.
        const actionShouldRun = !scenario.hasNonChargingPath && confirmed;
        expect(actionCalls === 1).toBe(actionShouldRun);
      }),
      { numRuns: 200 },
    );
  });
});
