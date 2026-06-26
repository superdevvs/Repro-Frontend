import { expect, test, type TestInfo } from '@playwright/test';

import * as auth from '../helpers/auth';
import { resolveQaEnv, type QaEnv } from '../helpers/onboarding-qa/env';

/**
 * Config / spec-wiring smoke checks for the photographer onboarding QA suite.
 *
 * These are intentionally **self-contained** (no network, no live target server) so they pass in
 * CI without a running stack. Where a check would genuinely require the running app, it is guarded
 * with `test.skip` and a clear message (blocked-and-continue philosophy) rather than failing.
 *
 * Coverage (Requirement 1 — test execution and configuration):
 *   1.1 — new onboarding specs match the `**\/*.e2e.ts` glob and live under `frontend/e2e/`.
 *   1.2 — the suite runs via `npm run test:e2e` in the single `chromium` project.
 *   1.3 — auth is wired through `frontend/e2e/helpers/auth.ts`.
 *   1.4 — documented env resolution works with the correct precedence
 *         (`apiBaseUrl = E2E_API_BASE_URL ?? E2E_BASE_URL ?? default`).
 *   1.5 — notification-sink configuration is resolved.
 *   1.6 — the managed-server toggle (`E2E_NO_SERVER`) is reflected by `env.noServer`.
 */

/** Default Dashboard base URL — must match `playwright.config.ts` and `env.ts`. */
const DEFAULT_BASE_URL = 'http://localhost:5173';

/**
 * The env keys this spec mutates while asserting precedence. We snapshot and restore exactly these
 * so the test leaves `process.env` untouched for any subsequent spec (Playwright reuses the worker
 * process across files).
 */
const MUTATED_ENV_KEYS = [
  'E2E_API_BASE_URL',
  'E2E_BASE_URL',
  'E2E_NO_SERVER',
  'E2E_NOTIFICATION_MODE',
  'E2E_EMAIL_MODE',
  'E2E_SMS_MODE',
  'E2E_VOICE_MODE',
] as const;

/**
 * Run `fn` with `process.env` mutated to `overrides`, then restore the original values for the
 * mutated keys (deleting keys that were originally unset). Synchronous so `resolveQaEnv()` — which
 * reads `process.env` eagerly — observes exactly the overridden environment.
 */
function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const snapshot = new Map<string, string | undefined>();
  for (const key of MUTATED_ENV_KEYS) {
    snapshot.set(key, process.env[key]);
  }
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fn();
  } finally {
    for (const [key, original] of snapshot) {
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  }
}

/** Normalize an absolute path to forward slashes so the glob/dir assertions are OS-independent. */
function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

test.describe('onboarding QA — config/wiring smoke checks (Requirement 1)', () => {
  test('1.1 onboarding specs match **/*.e2e.ts and live under frontend/e2e/', ({}, testInfo: TestInfo) => {
    const specPath = toPosix(testInfo.file);

    // Lives under the frontend e2e tree (the suite's testDir is ./e2e).
    expect(specPath, 'spec must live under frontend/e2e/').toContain('/frontend/e2e/');
    // Lives in the new onboarding subfolder per the design's directory layout.
    expect(specPath, 'onboarding specs live under frontend/e2e/onboarding/').toContain(
      '/frontend/e2e/onboarding/',
    );
    // Matches the `**/*.e2e.ts` glob enforced by playwright.config.ts `testMatch`.
    expect(specPath, 'spec filename must match the **/*.e2e.ts glob').toMatch(/\.e2e\.ts$/);

    // The fact that this file was collected and is executing is itself proof the glob matched;
    // the assertions above pin the documented location so future onboarding specs follow suit.
  });

  test('1.2 suite runs in the chromium project (npm run test:e2e)', ({}, testInfo: TestInfo) => {
    // playwright.config.ts defines a single project named 'chromium'; `npm run test:e2e` runs it.
    expect(testInfo.project.name).toBe('chromium');
  });

  test('1.3 auth is wired through helpers/auth.ts', () => {
    // Reference the shared helper so a regression in its export surface fails this smoke check.
    expect(typeof auth.loginAsAdmin, 'loginAsAdmin must be exported from helpers/auth.ts').toBe(
      'function',
    );
    expect(typeof auth.loginAsEditor, 'loginAsEditor must be exported from helpers/auth.ts').toBe(
      'function',
    );
    expect(typeof auth.ADMIN_EMAIL, 'ADMIN_EMAIL must be exported from helpers/auth.ts').toBe(
      'string',
    );
  });

  test('1.4 documented env resolution returns the documented fields', () => {
    const env: QaEnv = resolveQaEnv();

    // Documented field surface (Req 1.4 / 1.5) with the expected primitive shapes.
    expect(typeof env.baseUrl).toBe('string');
    expect(typeof env.apiBaseUrl).toBe('string');
    expect(typeof env.noServer).toBe('boolean');
    expect(typeof env.adminEmail).toBe('string');
    expect(typeof env.adminPassword).toBe('string');
    expect(typeof env.runId).toBe('string');
    expect(env.runId.length).toBeGreaterThan(0);

    // Notification-sink fields (Req 1.5) resolve to their documented enums.
    expect(['log', 'live']).toContain(env.notificationMode);
    expect(['log', 'live']).toContain(env.emailMode);
    expect(['log', 'live']).toContain(env.smsMode);
    expect(['disabled', 'live']).toContain(env.voiceMode);

    // Confirmation-gate flags default to read-only (declined) unless explicitly enabled.
    expect(typeof env.confirmDestructive).toBe('boolean');
    expect(typeof env.confirmCharge).toBe('boolean');
    expect(typeof env.confirmMessage).toBe('boolean');
  });

  test('1.4 apiBaseUrl precedence: E2E_API_BASE_URL ?? E2E_BASE_URL ?? default', () => {
    // 1) Explicit API base URL wins over everything.
    withEnv(
      { E2E_API_BASE_URL: 'https://api.qa.example.com', E2E_BASE_URL: 'https://app.qa.example.com' },
      () => {
        expect(resolveQaEnv().apiBaseUrl).toBe('https://api.qa.example.com');
      },
    );

    // 2) No API base URL → fall back to E2E_BASE_URL.
    withEnv({ E2E_API_BASE_URL: undefined, E2E_BASE_URL: 'https://app.qa.example.com' }, () => {
      const env = resolveQaEnv();
      expect(env.apiBaseUrl).toBe('https://app.qa.example.com');
      expect(env.baseUrl).toBe('https://app.qa.example.com');
    });

    // 3) Neither set → documented default.
    withEnv({ E2E_API_BASE_URL: undefined, E2E_BASE_URL: undefined }, () => {
      const env = resolveQaEnv();
      expect(env.apiBaseUrl).toBe(DEFAULT_BASE_URL);
      expect(env.baseUrl).toBe(DEFAULT_BASE_URL);
    });
  });

  test('1.5/1.6 managed-server toggle is reflected by env.noServer', () => {
    // E2E_NO_SERVER === '1' → run against the external stack without a managed dev server.
    withEnv({ E2E_NO_SERVER: '1' }, () => {
      expect(resolveQaEnv().noServer).toBe(true);
    });

    // Unset → managed-server path remains enabled (noServer false).
    withEnv({ E2E_NO_SERVER: undefined }, () => {
      expect(resolveQaEnv().noServer).toBe(false);
    });

    // Any non-'1' value is treated as unset (read-only/strict toggle semantics).
    withEnv({ E2E_NO_SERVER: 'true' }, () => {
      expect(resolveQaEnv().noServer).toBe(false);
    });
  });
});
