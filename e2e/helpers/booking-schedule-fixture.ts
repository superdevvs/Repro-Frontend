import { expect, type Page } from '@playwright/test';

export type Scenario = 'available' | 'same-building' | 'incoming' | 'outgoing' | 'overlap' | 'unknown' | 'disabled';
export async function bookingScheduleFixture(page: Page, baseURL: string | undefined, scenario: Scenario, role = 'admin', draftOptions: { legacyDuration?: number; overrideDuration?: number } = {}) {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Booking fixtures must run locally.');
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00Z'));
  const user = { id: 900503, name: 'Scheduling QA', email: 'schedule@example.test', role, account_status: 'active', email_verified_at: '2026-10-01T09:00:00Z', metadata: { terms_accepted_at: '2026-10-01T09:00:00Z' } };
  const service = { id: '501', name: '10 Exterior HDR', price: 100, quantity: 1, shoot_duration_minutes: 15, booking_duration_default_minutes: 15, photographer_required: true, category: { id: '1', name: 'Photography' }, pricing_type: 'fixed' };
  const people = [{ id: '201', name: 'QA Delmar', role: 'photographer' }, { id: '202', name: 'QA Jaz', role: 'photographer' }];
  const slots = [{ start_time: '07:00', end_time: '21:00', status: 'available' }];
  const requests: { path: string; method: string; body: Record<string, unknown> | null }[] = [];
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ user, service, draftOptions }) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('authToken', 'local-schedule-fixture'); localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('theme', 'light');
    const cachedService = draftOptions.legacyDuration ? { ...service, shoot_duration_minutes: draftOptions.legacyDuration, booking_duration_default_minutes: undefined } : service;
    localStorage.setItem('bookShoot_form_cache', JSON.stringify({ client: '101', address: '615 North Highland Avenue', city: 'Baltimore', state: 'MD', zip: '21205', date: '2026-10-05T12:00:00-04:00', time: '8:30 AM', photographer: '201', selectedServices: [cachedService], bookingQuantityVersion: 1, servicePhotographers: { '501': '201' }, serviceSchedules: draftOptions.overrideDuration ? { '501': { duration_minutes: draftOptions.overrideDuration } } : {}, propertySqft: 1500, propertyDetails: { sqft: 1500, bedrooms: 3, bathrooms: 2, listingType: 'for_sale', presenceOption: 'lockbox', lockboxCode: 'QA', lockboxLocation: 'front door' }, notes: '', bypassPayment: true, sendNotification: false }));
  }, { user, service, draftOptions });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname.replace(/^\/api/, '');
    if (!url.pathname.startsWith('/api/')) return ['localhost', '127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort();
    const body = request.postDataJSON() as Record<string, unknown> | null;
    requests.push({ path: p, method: request.method(), body });
    let data: unknown = { success: true, data: [], unread_count: 0, notifications: [] };
    if (p === '/user') data = user;
    else if (p === '/me/permissions') { const permissions = ['dashboard', 'shoots', 'book-shoot', 'accounts', 'availability'].flatMap(resource => ['view', 'create', 'edit'].map(action => ({ resource, action }))); data = { permissions, permissionIds: permissions.map(x => `${x.resource}:${x.action}`) }; }
    else if (p === '/services' || p === '/admin/services') data = { data: [service] };
    else if (p === '/admin/clients') data = { data: [{ id: 101, name: 'QA Jocelyn', email: 'client@example.test', role: 'client', account_status: 'active', metadata: {} }] };
    else if (/\/photographers$/.test(p)) data = { data: people };
    else if (p === '/photographer/availability/bulk-index') data = { data: Object.fromEntries(people.map(x => [x.id, slots.map(s => ({ ...s, date: body?.from_date, day_of_week: 'monday' }))])) };
    else if (p === '/photographer/availability/check') data = { data: slots, timezone: 'America/New_York', from_config: true };
    else if (p === '/photographer/availability/for-booking') data = { hybrid_travel_enabled: scenario !== 'disabled', data: people.map(x => ({ ...x, distance: 2, availability_slots: slots, net_available_slots: slots, booked_slots: [], unavailable_slots: [], is_available_at_time: true, has_availability: true, eligible_service_ids: [501], requires_travel_check: scenario !== 'disabled' })) };
    else if (p === '/photographer/availability/feasibility') data = { data: feasibility(scenario, body ?? {}) };
    else if (p === '/voice/browser/config') data = { enabled: false, ready: false, blockers: [] };
    else if (p === '/notifications') data = { data: { activity_log: [], unread_count: 0 } };
    else if (p === '/shoots' && request.method() === 'POST') data = { data: { ...body, id: 99001, status: 'scheduled', workflow_status: 'scheduled' } };
    else if (request.method() !== 'GET' && !/telemetry|availability|broadcasting|geocode|weather/.test(p)) return route.fulfill({ status: 400, json: { message: 'Unexpected local QA mutation' } });
    return route.fulfill({ json: data });
  });
  await page.goto('/book-shoot');
  // Restore a legitimate saved draft, then use the actual wizard components.
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Services & access', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Select Date', exact: true })).toBeVisible();
  await expect.poll(() => requests.filter(r => r.path.endsWith('/feasibility')).length).toBeGreaterThan(0);
  await expect(page.getByText('Checking travel · time is provisional', { exact: true })).toHaveCount(0);
  return { requests, errors, saves: () => requests.filter(r => r.path === '/shoots' && r.method === 'POST') };
}

function feasibility(scenario: Scenario, body: Record<string, unknown>) {
  const issue = ['incoming', 'outgoing', 'overlap', 'unknown'].includes(scenario);
  const outgoing = scenario === 'outgoing';
  const unknown = scenario === 'unknown';
  const same = scenario === 'same-building';
  return {
    enabled: scenario !== 'disabled', status: unknown ? 'review_required' : issue ? 'conflict' : 'available', available: !issue,
    reason_codes: scenario === 'overlap' ? ['capture_overlap'] : issue ? [unknown ? 'travel_review_required' : 'insufficient_travel_time'] : [],
    can_override: issue && scenario !== 'overlap', can_confirm_location: unknown, policy_version: 'fixture-policy', schedule_version: 'fixture-schedule', confirmation_version: 'fixture-confirmation',
    transitions: scenario === 'available' || scenario === 'disabled' || scenario === 'overlap' ? [] : [{
      id: 'transition-1', direction: outgoing ? 'outgoing' : 'incoming', source: same ? 'same_building' : unknown ? 'unknown' : 'google_routes',
      required_minutes: same ? 0 : unknown ? null : 25, available_minutes: same ? 0 : 15, shortfall_minutes: same ? 0 : unknown ? null : 10,
      reason_code: same ? 'same_building' : unknown ? 'location_unknown' : 'insufficient_travel_time',
      ...(same || unknown ? {} : { drive_minutes: 18, attribution: 'Google Maps' }),
      candidate_start: '2026-10-05T08:30:00-04:00', candidate_end: '2026-10-05T08:45:00-04:00',
      neighbor: { shoot_id: 99000, scheduled_at: outgoing ? '2026-10-05T09:00:00-04:00' : '2026-10-05T08:00:00-04:00', end_at: outgoing ? '2026-10-05T09:15:00-04:00' : '2026-10-05T08:15:00-04:00', timezone: 'America/New_York', services: [{ id: 501, name: '10 Exterior HDR' }], photographer: { id: 201, name: 'QA Delmar' }, can_view_details: true },
    }],
    alternatives: body.include_alternatives ? [{ scheduled_at: '2026-10-05T09:10:00-04:00', photographer_id: 201 }] : [],
  };
}

export async function reviewBooking(page: Page) {
  await page.getByRole('button', { name: /^confirm$/i }).click();
  await expect(page.getByText('Review & Confirm', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Book Shoot', exact: true }).click();
}
