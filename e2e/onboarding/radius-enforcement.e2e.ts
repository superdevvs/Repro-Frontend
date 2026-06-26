import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
} from '@playwright/test';

import { loginAsEditor } from '../helpers/auth';
import { createConfirmationGate } from '../helpers/onboarding-qa/confirmation-gate';
import { resolveQaEnv } from '../helpers/onboarding-qa/env';
import { ANCHOR, haversineMiles, type LatLng } from '../helpers/onboarding-qa/seeded-address';

/**
 * LIVE, HEADED radius-enforcement matrix (Option B — flag-gated; QA §4 behavior matrix).
 *
 * Proves the photographer service-radius gate is SERVER-ENFORCED end-to-end on BOTH paths the user
 * called out, against the running local stack with `PHOTOGRAPHER_RADIUS_ENFORCEMENT=true`:
 *
 *   Path 1 — booking eligibility (public `for-booking` query, read-only):
 *     inside radius   → photographer offered
 *     boundary (==)   → photographer offered (<= is inside)
 *     outside radius  → photographer NOT offered
 *     missing coords  → photographer NOT offered (distance unavailable)
 *
 *   Path 2 — manual assignment (POST /shoots/{shoot}/assign-service-photographer →
 *            AssignServicePhotographerAction, a real WRITE; gated behind E2E_CONFIRM_DESTRUCTIVE):
 *     inside radius   → assignment allowed (no radius 422)
 *     outside radius  → assignment BLOCKED with a 422 radius reason
 *
 * The fixture photographer is `test.photographer@example.com` (seeded at the ANCHOR coordinate with
 * a 25-mile radius). Distances are computed north-of-anchor so inside/boundary/outside are exact.
 *
 * Run headed + dark (from frontend/):
 *   $env:E2E_BASE_URL="http://localhost:5173"; $env:E2E_API_BASE_URL="http://127.0.0.1:8000";
 *   $env:E2E_COLOR_SCHEME="dark"; $env:E2E_CONFIRM_DESTRUCTIVE="1";
 *   npx playwright test onboarding/radius-enforcement --headed --project=chromium --workers=1
 */

test.use({ launchOptions: { slowMo: 250 }, colorScheme: 'dark' });

const OUTPUT_DIR = '../output/playwright';
const BACKEND_DIR = resolve(process.cwd(), '..', 'backend');
const env = resolveQaEnv();
const gate = createConfirmationGate(env);

const PHOTOG_EMAIL = process.env.E2E_PHOTOG_EMAIL ?? 'test.photographer@example.com';
const PHOTOG_PASSWORD = process.env.E2E_PHOTOG_PASSWORD ?? 'QaDemo123!';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'qa.admin@example.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'QaDemo123!';
const RADIUS_MILES = 25; // seeded radius for the fixture photographer.

/** A coordinate exactly `miles` due north of the anchor (longitude unchanged). */
function northOfAnchor(miles: number): LatLng {
  // meters = earthRadius * Δφ along a meridian; invert to get Δlat in degrees.
  const EARTH_RADIUS_METERS = 6371000;
  const METERS_PER_MILE = 1609.34;
  const deltaLatDeg = ((miles * METERS_PER_MILE) / EARTH_RADIUS_METERS) * (180 / Math.PI);
  return { lat: ANCHOR.lat + deltaLatDeg, lng: ANCHOR.lng };
}

function nextWeekISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

interface ForBookingEntry {
  id: number | string;
  name: string;
  distance?: number | null;
  is_available_at_time?: boolean;
}

/** Run the QA backend artisan helper and return its JSON line. */
function artisanJson(args: string[]): Record<string, unknown> {
  const out = execFileSync('php', ['artisan', ...args], { cwd: BACKEND_DIR, encoding: 'utf8' });
  const line = out.trim().split(/\r?\n/).filter(Boolean).pop() ?? '{}';
  return JSON.parse(line) as Record<string, unknown>;
}

test('LIVE radius matrix — for-booking eligibility is server-enforced (Path 1, read-only)', async ({ browser }) => {
  test.setTimeout(120_000);
  await mkdir(OUTPUT_DIR, { recursive: true }).catch(() => undefined);

  const api: APIRequestContext = await apiRequest.newContext({ baseURL: env.apiBaseUrl });

  // Resolve the fixture photographer id (login is read-only).
  const login = await api.post('/api/login', { data: { email: PHOTOG_EMAIL, password: PHOTOG_PASSWORD } });
  expect(login.ok(), `photographer login (${login.status()})`).toBeTruthy();
  const photographerId = ((await login.json()) as { user?: { id: number | string } }).user?.id;
  expect(photographerId, 'photographer id').toBeTruthy();

  const date = nextWeekISO();

  const probe = async (coords: LatLng | null): Promise<ForBookingEntry | undefined> => {
    const data: Record<string, unknown> = {
      date,
      time: '02:00 PM',
      shoot_address: 'QA Radius Probe',
      shoot_city: 'Alexandria',
      shoot_state: 'VA',
      shoot_zip: '22310',
    };
    if (coords) {
      data.shoot_latitude = coords.lat;
      data.shoot_longitude = coords.lng;
    }
    const res = await api.post('/api/photographer/availability/for-booking', {
      headers: { Accept: 'application/json' },
      data,
    });
    expect(res.ok(), `for-booking (${res.status()})`).toBeTruthy();
    const body = (await res.json()) as { data?: ForBookingEntry[] } | ForBookingEntry[];
    const list = Array.isArray(body) ? body : (body.data ?? []);
    return list.find((e) => String(e.id) === String(photographerId));
  };

  const insideCoords = northOfAnchor(RADIUS_MILES * 0.4); // 10mi
  const boundaryCoords = northOfAnchor(RADIUS_MILES); // 25mi
  const outsideCoords = northOfAnchor(RADIUS_MILES * 2); // 50mi

  // Self-check the fixture distances are exact (mirrors the backend haversine).
  expect(Math.round(haversineMiles(ANCHOR, insideCoords))).toBe(10);
  expect(Math.round(haversineMiles(ANCHOR, boundaryCoords))).toBe(25);
  expect(Math.round(haversineMiles(ANCHOR, outsideCoords))).toBe(50);

  const inside = await probe(insideCoords);
  const boundary = await probe(boundaryCoords);
  const outside = await probe(outsideCoords);
  const missing = await probe(null);

  // eslint-disable-next-line no-console
  console.log(
    `[radius] for-booking: inside(present=${!!inside}, d=${inside?.distance}) ` +
      `boundary(present=${!!boundary}, d=${boundary?.distance}) ` +
      `outside(present=${!!outside}) missing(present=${!!missing})`,
  );

  expect(inside, 'inside-radius photographer MUST be offered').toBeTruthy();
  expect(boundary, 'boundary (== radius) photographer MUST be offered').toBeTruthy();
  expect(outside, 'outside-radius photographer must NOT be offered').toBeFalsy();
  expect(missing, 'photographer with unresolvable distance must NOT be offered').toBeFalsy();

  // Visible dark-mode evidence: the staff booking screen.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await loginAsEditor(page, ADMIN_EMAIL, ADMIN_PASSWORD).catch(() => undefined);
  await page.waitForTimeout(800);
  for (const [route, label] of [['/shoots', 'shoots'], ['/dashboard', 'dashboard']] as const) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUTPUT_DIR}/radius-forbooking-${label}.png`, fullPage: true }).catch(() => undefined);
  }
  await ctx.close();
  await api.dispose();
});

test('LIVE radius matrix — manual assignment is server-enforced (Path 2, confirmed write)', async () => {
  test.setTimeout(120_000);

  if (!gate.isConfirmed('destructive', 'photographer-settings')) {
    test.skip(true, 'Assignment write is gated; set E2E_CONFIRM_DESTRUCTIVE=1 to run it.');
    return;
  }

  const api: APIRequestContext = await apiRequest.newContext({ baseURL: env.apiBaseUrl });

  try {
    // Photographer id (fixture).
    const pLogin = await api.post('/api/login', { data: { email: PHOTOG_EMAIL, password: PHOTOG_PASSWORD } });
    expect(pLogin.ok(), `photographer login (${pLogin.status()})`).toBeTruthy();
    const photographerId = ((await pLogin.json()) as { user?: { id: number } }).user?.id;
    expect(photographerId, 'photographer id').toBeTruthy();

    // Admin token (performs the assignment).
    const aLogin = await api.post('/api/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    expect(aLogin.ok(), `admin login (${aLogin.status()})`).toBeTruthy();
    const adminToken = String(((await aLogin.json()) as { token?: string }).token ?? '');
    expect(adminToken, 'admin token').toBeTruthy();
    const auth = { Authorization: `Bearer ${adminToken}`, Accept: 'application/json' };

    // Clean any leftover QA radius shoots before starting.
    artisanJson(['qa:radius-shoot', 'cleanup']);

    const assign = async (coords: LatLng) => {
      const created = artisanJson(['qa:radius-shoot', 'create', `--lat=${coords.lat}`, `--lng=${coords.lng}`]);
      const shootId = Number(created.shoot_id);
      const serviceId = Number(created.service_id);
      const res = await api.post(`/api/shoots/${shootId}/assign-service-photographer`, {
        headers: auth,
        data: { service_id: serviceId, photographer_id: photographerId },
      });
      return { status: res.status(), body: await res.text() };
    };

    // INSIDE (10mi) → allowed (no radius 422).
    const inside = await assign(northOfAnchor(RADIUS_MILES * 0.4));
    // OUTSIDE (50mi) → blocked with 422 radius reason.
    const outside = await assign(northOfAnchor(RADIUS_MILES * 2));

    // eslint-disable-next-line no-console
    console.log(`[radius] assignment: inside.status=${inside.status} outside.status=${outside.status}`);
    // eslint-disable-next-line no-console
    console.log(`[radius] assignment outside.body=${outside.body}`);

    expect(inside.status, `inside-radius assignment should be allowed (got ${inside.status}: ${inside.body})`).toBeLessThan(400);
    expect(outside.status, 'outside-radius assignment must be blocked (422)').toBe(422);
    expect(outside.body.toLowerCase(), 'block reason should mention service radius').toContain('radius');
  } finally {
    artisanJson(['qa:radius-shoot', 'cleanup']);
    await api.dispose();
  }
});
