import { expect, test, type Page, type Route } from '@playwright/test';
import path from 'node:path';

const output = path.resolve('..', 'output', 'calls-support-implementation', 'calls-browser');
const people = Array.from({ length: 45 }, (_, i) => ({ id: `user:${i + 1}`, user_id: i + 1, name: `Review Person ${String(i + 1).padStart(2, '0')}`, role: i % 3 === 0 ? 'photographer' : i % 3 === 1 ? 'salesRep' : 'client', phone: `+1202555${String(i + 100).padStart(4, '0')}`, callable: true, company_name: 'Review Account' }));
const calls = people.map((person, i) => ({ id: i + 1, provider: 'telnyx', direction: 'INBOUND', status: i === 0 ? 'in_progress' : 'completed', handled_by: i === 0 ? 'ai' : 'human', from_phone: person.phone, to_phone: '+12025550100', caller_user: person, summary: 'The caller needs help with delivered photo downloads.', transcript: Array.from({ length: 80 }, (_, j) => `Caller segment ${j + 1}: I need help with downloading my shoot photos.\nStaff: Open your shoot and use Download Center.`).join('\n'), duration_seconds: 132, recording_consent_given: true, answered_at: '2026-10-01T09:00:00Z', ended_at: i === 0 ? null : '2026-10-01T09:02:12Z', created_at: '2026-10-01T09:00:00Z', needs_follow_up: i % 2 === 0, metadata: {} }));
const settings = { enabled: true, outbound_mode: 'none', recording_enabled: true, allow_unverified_transfer: false, provider: 'telnyx', support_handoff_number: '+12025550100', quiet_hours: { enabled: true, start: '20:00', end: '08:00', timezone: 'America/New_York' }, business_hours: { timezone: 'America/New_York', weekly: Object.fromEntries(['monday','tuesday','wednesday','thursday','friday'].map(day => [day, [['09:00','17:00']]])) }, holidays: [], greeting_text: 'Thanks for calling REPro. How can I help?', disclosure_text: 'With your permission, this call may be recorded.', automation_toggles: { missed_call_callback: true }, tool_allowlist: ['verify_caller', 'get_shoot_details'], confirmation_gated_tools: ['book_shoot'] };

async function fixture(page: Page, baseURL: string | undefined, theme: string) {
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only.');
  const requests: { path: string; method: string; query: string }[] = [];
  let failPage = false;
  const user = { id: '900501', name: 'Review Admin', email: 'review@example.test', role: 'admin', account_status: 'active', email_verified_at: '2026-01-01', metadata: { terms_accepted_at: '2026-01-01' } };
  await page.addInitScript(({ user, theme }) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('authToken', 'local-calls-review'); localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('theme', theme); }, { user, theme });
  const reply = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const paginate = (rows: unknown[], url: URL) => { const page = Number(url.searchParams.get('page') || 1); const per = Number(url.searchParams.get('per_page') || 20); return { data: rows.slice((page - 1) * per, page * per), current_page: page, last_page: Math.max(1, Math.ceil(rows.length / per)), per_page: per, total: rows.length }; };
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const p = url.pathname.replace(/^\/api/, '');
    requests.push({ path: p, method: request.method(), query: url.search });
    if (p === '/user') return reply(route, user);
    if (p === '/me/permissions') return reply(route, { permissions: ['view','operate','manage','supervise'].map(action => ({ resource: 'voice-calls', action })).concat([{ resource: 'messaging-sms', action: 'view' }, { resource: 'robbie', action: 'view' }]), permissionIds: ['voice-calls:view','voice-calls:operate','voice-calls:manage','voice-calls:supervise','robbie:view'] });
    if (p === '/voice/browser/config') return reply(route, { enabled: false, ready: false, blockers: ['Carrier connectivity is disabled in local review.'], capabilities: { human_outbound: false, receive_calls: false } });
    if (p === '/voice/numbers') return reply(route, { numbers: [{ id: 1, phone_number: '+12025550100', label: 'Main business line', is_default: true, voice_ai_enabled: true, sms_ai_enabled: false }] });
    if (p === '/voice/health') return reply(route, { can_place_calls: false, readiness_blockers: ['Carrier connectivity is disabled in local review.'], outbound_mode: 'none', assistant_sync: { status: 'current', policy_instructions_current: true, missing_tools: [] } });
    if (p === '/voice/settings') return reply(route, settings);
    if (p === '/voice/directory') { let rows = people; const q = (url.searchParams.get('q') || '').toLowerCase(); const role = url.searchParams.get('role'); if (role && role !== 'all') rows = rows.filter(person => person.role === role); if (q) rows = rows.filter(person => person.name.toLowerCase().includes(q) || person.phone.includes(q)); return reply(route, paginate(rows, url)); }
    if (p === '/voice/calls') { if (failPage && url.searchParams.get('page') === '2') return reply(route, { message: 'Review network failure' }, 500); return reply(route, paginate(url.searchParams.get('filter') === 'live' ? calls.slice(0, 1) : calls, url)); }
    if (p === '/voice/calls/insights') return reply(route, { range: '7d', answered_rate: 91, answered_rate_delta: null, median_answer_seconds: 12, median_answer_delta: null, bookings_from_calls: 3, bookings_delta: null, missed_recovered_rate: 70, missed_recovered_delta: null, inbound_total: 45, volume_by_day: Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-${24 + i}`, label: ['Thu','Fri','Sat','Sun','Mon','Tue','Wed'][i], team: i + 2, ai: 2, missed: 1, total: i + 5 })), intents: [{ key: 'support', label: 'Support', count: 12, pct: 28 }], handoff_connected_rate: 90, handoffs_needing_callback: 3, updated_at: '2026-10-01T09:00:00Z' });
    if (/^\/voice\/calls\/\d+$/.test(p)) return reply(route, calls.find(call => call.id === Number(p.split('/')[3])) || calls[0]);
    if (p.endsWith('/recording-url')) return reply(route, { url: null });
    if (p.endsWith('/transcript') || p.endsWith('/transcript/reconcile')) return reply(route, { transcript: calls[1].transcript, state: 'partial', last_chunk_at: '2026-10-01T09:02:00Z', segment_count: 80, summary_stale: true, can_rebuild: true, completeness: 'provider_unverified', recording_available: false, message: 'Saved transcript segments are available. Provider completeness is unverified.' });
    if (p.endsWith('/stream')) return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'event: transcript\ndata: '+JSON.stringify({ chunks: Array.from({ length: 35 }, (_, i) => ({ seq: i, text: 'Open the shoot, then choose Download Center. You can download web or full resolution photos.', speaker: i % 2 ? 'Staff' : 'Caller', ts: '2026-10-01T09:00:00Z' })) })+'\n\nevent: closed\ndata: {}\n\n' });
    if (p.endsWith('/cockpit-opened')) return reply(route, { insights: null, budget_paused: false });
    if (p === '/voice/incoming-offers') return reply(route, { data: [{ id: 'review-offer-1', voice_call_id: 1, status: 'waiting', expires_at: '2099-01-01T00:00:00Z', caller_name: 'Review Incoming', remote_phone: '+12025550111', claimed_by: null, can_claim: false, phone_available: false }] });
    if (p === '/voice/schedule/state') return reply(route, { state: { state: 'team_open', label: 'Team hours', office_timezone: 'America/New_York' } });
    if (p === '/voice/schedule/overrides') return reply(route, { overrides: [] });
    if (p === '/voice/llm-usage') return reply(route, { spend_usd: 1.4, budget_usd: 50, by_model: [] });
    if (p === '/voice/automation-rules') return reply(route, { rules: [], managed_triggers: [], assignees: [] });
    if (p === '/voice/automation-rules/runs') return reply(route, { data: [], total: 0, current_page: 1, last_page: 1 });
    if (p === '/voice/scheduled-calls') return reply(route, paginate(people.map((person, i) => ({ id: i + 1, status: i % 2 ? 'failed' : 'scheduled', target_phone: person.phone, caller_user: person, reason: 'Review the client download issue', scheduled_at: '2099-01-01T09:00:00Z', next_attempt_at: '2099-01-01T09:00:00Z', attempts: 1, max_attempts: 3, original_voice_call_id: i + 1 })), url));
    if (p === '/voice/push/settings') return reply(route, { configured: false, blockers: ['Push transport is disabled for local review.'], public_key: null, preferences: { incoming_calls: false }, devices: [] });
    if (p === '/voice/phone/settings') return reply(route, { available: true, phone_enabled: false, phone_number: null, phone_verified_at: null, pending_phone: null });
    if (p === '/notifications') return reply(route, { data: { activity_log: [], unread_count: 0 } });
    return reply(route, { data: [], success: true });
  });
  return { requests, failNextPage: () => { failPage = true; } };
}
const screens = [
  ['inbox', '/calls/inbox', 'Conversations'], ['detail', '/calls/inbox/2', 'Review Person 02'], ['live', '/calls/live', 'Team queue'], ['cockpit', '/calls/live/1', 'Transcript'], ['recap', '/calls/inbox/2/wrap-up', 'Call recap'], ['people', '/calls/people', 'People'], ['follow-ups', '/calls/follow-ups', 'Follow-ups'], ['schedule', '/calls/schedule', 'Business hours'], ['assistant', '/calls/assistant', 'Robbie'], ['automations', '/calls/automations', 'Automations'], ['insights', '/calls/insights', 'Call insights'], ['settings', '/calls/settings', 'Audio & alerts'], ['business-settings', '/calls/settings?section=business', 'Business settings'],
] as const;
for (const width of [1440,390]) for (const theme of ['light','dark']) {
  test(`Calls routes and interactions ${width}px ${theme}`, async ({ page, baseURL }) => {
    test.setTimeout(180_000); await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); const state = await fixture(page, baseURL, theme);
    for (const [name, url, heading] of screens) {
      await page.goto(url); await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible({ timeout: 30000 });
      await expect(page.locator('.calls-shell')).toBeVisible();
      await expect(page.getByText('This view could not load')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: path.join(output, `${width}-${theme}-${name}.png`) });
    }
    await page.goto('/calls/inbox');
    await expect(page.getByRole('button', { name: 'Next conversations' })).toBeEnabled();
    const scroll = page.getByLabel('Conversation results');
    expect(await scroll.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    await page.getByRole('button', { name: 'Next conversations' }).click();
    await expect(page.getByText('Review Person 21', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Review Person 21/ }).click();
    await expect(page.getByRole('heading', { name: 'Review Person 21' })).toBeVisible();
    if (width === 390) { await page.getByRole('button', { name: 'Back to inbox' }).click(); await expect(page.getByLabel('Conversation results').getByText('Review Person 21', { exact: true })).toBeVisible(); }
    await page.goto('/calls/people'); await expect(page.getByText('Review Person 01', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next people' }).click(); await expect(page.getByText('Review Person 21', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Photographers', exact: true }).click();
    await expect(page.getByText('Review Person 01', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Search people' }).fill('Person 04'); await expect(page.getByText('Review Person 04', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Call', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('heading', { name: 'Call someone' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Search everyone or enter a number' }).fill('Person 07');
    await page.getByRole('button', { name: /Review Person 07/ }).click(); await expect(page.getByLabel('Review Person 07')).toHaveValue(people[6].phone);
    await page.screenshot({ path: path.join(output, `${width}-${theme}-new-call.png`) }); await page.keyboard.press('Escape');
    expect(state.requests.some(request => request.path.includes('/sms'))).toBe(false);
    expect(state.requests.filter(request => request.path === '/voice/calls/human' || request.path === '/voice/calls/outbound')).toEqual([]);
    expect(errors).toEqual([]);
  });
}
test('history keeps pagination reachable after an older page fails', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL, 'light'); await page.goto('/calls/inbox');
  await expect(page.getByRole('button', { name: 'Next conversations' })).toBeEnabled(); state.failNextPage(); await page.getByRole('button', { name: 'Next conversations' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load conversations' })).toBeVisible({ timeout:30000 });
  await expect(page.getByRole('button', { name: 'Previous conversations' })).toBeEnabled(); await page.getByRole('button', { name: 'Previous conversations' }).click(); await expect(page.getByText('Review Person 01', { exact: true })).toBeVisible();
});
