import { expect, test, type Page, type Response } from '@playwright/test';

import {
  PHOTO_EDITOR_EMAIL,
  PHOTO_EDITOR_PASSWORD,
  loginAsEditor,
} from './helpers/auth';

/**
 * QA #13 — Extras must stay hidden from editors.
 *
 * Editors do photo/video editing. Non-editing extras (drone, floor plans, 3D tours,
 * virtual staging) are produced by external/automated pipelines and must NEVER appear
 * in an editor's task list. In addition, editors must never receive CLIENT PRICING for
 * any service (price / balance_due / payment_status) — the editor UI only surfaces
 * editor payout, which is fetched separately.
 *
 * This spec drives the REAL editor dashboard and inspects the REAL `/api/shoots`
 * payload the editor receives, asserting:
 *   13.1  No service in the editor payload belongs to a non-editing extra category.
 *   13.2  No service in the editor payload exposes client pricing fields.
 *
 * ENVIRONMENT — needs the full seeded stack (see e2e/README.md):
 *   • Laravel backend on http://127.0.0.1:8000 (migrated WITH the requires_editing
 *     migration + seeded), with at least one editor account that has an assigned shoot
 *     which also carries a non-editing extra (e.g. drone / floor plans).
 *   • Credentials via E2E_PHOTO_EDITOR_EMAIL / E2E_PHOTO_EDITOR_PASSWORD.
 *
 * Runs HEADLESS. It targets real routes/controls so a green run is a genuine verification.
 */

/** Category names that represent non-editing extras (must be hidden from editors). */
const NON_EDITING_CATEGORY_PATTERNS = [
  /drone/i,
  /floor\s*plan/i,
  /360/i,
  /3d\s*tour/i,
  /matterport/i,
  /iguide/i,
  /virtual\s*staging/i,
];

/** Pricing fields that must never be present (non-null) in an editor's service payload. */
const FORBIDDEN_PRICING_FIELDS = [
  'price',
  'balance_due',
  'balanceDue',
  'payment_status',
  'paymentStatus',
  'paid_amount',
  'paidAmount',
  'photographer_pay',
] as const;

interface ServicePayload {
  name?: string;
  category_name?: string | null;
  category?: { name?: string } | null;
  [key: string]: unknown;
}

interface ShootPayload {
  services?: ServicePayload[];
  serviceObjects?: ServicePayload[];
}

/** Collect every `/api/shoots` (list or detail) JSON response while the editor browses. */
async function collectShootPayloads(page: Page): Promise<ShootPayload[]> {
  const payloads: ShootPayload[] = [];

  const handler = async (response: Response) => {
    const url = response.url();
    if (!/\/api\/shoots(\?|\/|$)/.test(url)) return;
    if (!response.ok()) return;
    try {
      const body = await response.json();
      const data = body?.data ?? body;
      const shoots = Array.isArray(data) ? data : data?.shoots ?? [data];
      for (const shoot of shoots) {
        if (shoot && typeof shoot === 'object') payloads.push(shoot as ShootPayload);
      }
    } catch {
      // Non-JSON or unrelated payload — ignore.
    }
  };

  page.on('response', handler);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard/);
  // Give the editor queue requests time to settle.
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1500);

  page.off('response', handler);
  return payloads;
}

function servicesOf(shoot: ShootPayload): ServicePayload[] {
  return [...(shoot.services ?? []), ...(shoot.serviceObjects ?? [])];
}

function categoryNameOf(service: ServicePayload): string {
  return String(service.category_name ?? service.category?.name ?? service.name ?? '');
}

test.describe('QA #13 — extras hidden from editor', () => {
  test('13.1 — editor service payload contains no non-editing extras', async ({ page }) => {
    await loginAsEditor(page, PHOTO_EDITOR_EMAIL, PHOTO_EDITOR_PASSWORD);
    const shoots = await collectShootPayloads(page);

    test.skip(shoots.length === 0, 'No editor shoots returned; seed assigned shoots to verify.');

    for (const shoot of shoots) {
      for (const service of servicesOf(shoot)) {
        const category = categoryNameOf(service);
        for (const pattern of NON_EDITING_CATEGORY_PATTERNS) {
          expect(
            pattern.test(category),
            `Editor received a non-editing extra "${category}" that must be hidden (QA #13)`,
          ).toBe(false);
        }
      }
    }
  });

  test('13.2 — editor service payload exposes no client pricing', async ({ page }) => {
    await loginAsEditor(page, PHOTO_EDITOR_EMAIL, PHOTO_EDITOR_PASSWORD);
    const shoots = await collectShootPayloads(page);

    test.skip(shoots.length === 0, 'No editor shoots returned; seed assigned shoots to verify.');

    for (const shoot of shoots) {
      for (const service of servicesOf(shoot)) {
        for (const field of FORBIDDEN_PRICING_FIELDS) {
          const value = service[field];
          expect(
            value === undefined || value === null,
            `Editor service "${service.name}" leaked pricing field "${field}"=${JSON.stringify(value)} (QA #13)`,
          ).toBe(true);
        }
      }
    }
  });
});
