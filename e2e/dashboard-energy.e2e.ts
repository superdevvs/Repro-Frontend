import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { installDashboardMobileFixtures } from './helpers/dashboard-mobile-fixtures';

// These measurements compare browser work, not watts or laptop battery life.
// Both variants use the same intercepted editing-manager data and Chromium.
const baseline = process.env.E2E_ENERGY_VARIANT === 'baseline';
const sampleMs = Number(process.env.E2E_ENERGY_SAMPLE_MS || 15_000);
const insightMessages = [
  'Review the upcoming photography shoots and check whether every assigned editor has the files needed to finish delivery. Open this insight for the full list and next actions.',
  'The delivery queue is ready for a review. Check the completed photo sets and upcoming deadlines before sending the final work to each client. Open this insight for details.',
];

test.use({ viewport: { width: 1440, height: 900 }, screenshot: 'off', video: 'off', trace: 'off' });
test.setTimeout(120_000);

async function installFixtures(page: Page, baseURL: string | undefined) {
  // No API, provider, notification, or websocket request may reach production.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? route.continue() : route.abort();
  });
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.addInitScript(() => {
    const counters = { rafCallbacks: 0, iconMutations: 0, headerTextMutations: 0, canvasEncodes: 0 };
    const nativeRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => nativeRaf(now => { counters.rafCallbacks += 1; callback(now); });
    const nativeEncode = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      counters.canvasEncodes += 1;
      return nativeEncode.apply(this, args);
    };
    Object.assign(window, { __dashboardEnergy: counters });
  });
  const state = await installDashboardMobileFixtures(page, baseURL, 'editing_manager', true, ['robbie']);
  const chatPrompts: string[] = [];
  await page.route('**/api/voice/browser/config', route => route.fulfill({ json: { enabled: false, ready: false, blockers: [] } }));
  await page.route('**/api/system-telemetry/events', route => route.fulfill({ json: { accepted: true, stored: 1 } }));
  await page.route('**/api/robbie/insights', route => route.fulfill({ json: {
    success: true,
    insights: insightMessages.map((message, index) => ({ id: `energy-${index}`, priority: 'insight', message, prompt: `Open editing queue ${index + 1}`, action: 'Review queue' })),
  } }));
  await page.route('**/api/ai/sessions*', route => route.fulfill({ json: { data: [], meta: { stats: { thisWeekCount: 0, avgMessagesPerSession: 0, topTopic: 'general' } } } }));
  await page.route('**/api/ai/chat', route => {
    const body = route.request().postDataJSON();
    chatPrompts.push(body.message);
    return route.fulfill({ json: {
      sessionId: 'energy-fixture',
      messages: [
        { id: 'energy-user', sender: 'user', content: body.message, createdAt: new Date().toISOString() },
        { id: 'energy-reply', sender: 'assistant', content: 'Fixture editing queue response.', createdAt: new Date().toISOString() },
      ], meta: { suggestions: [] },
    } });
  });
  return { ...state, chatPrompts };
}

async function openDashboard(page: Page) {
  await page.goto('/dashboard');
  await expect(page.locator('[data-page-loading]')).toHaveAttribute('data-page-loading', 'ready');
  await expect(page.getByRole('heading', { name: 'Mobile fixture shoot 01', exact: true })).toBeVisible();
}

test('editing manager dashboard settles the tab icon and avoids repeated typing work', async ({ page, baseURL }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = await installFixtures(page, baseURL);
  await openDashboard(page);
  const insightAction = page.getByRole('button', { name: /^Robbie insight:/ });
  await expect(insightAction).toHaveAttribute('aria-label', `Robbie insight: ${insightMessages[0]}`);
  await page.waitForTimeout(5000);

  await insightAction.evaluate(button => {
    const counters = (window as unknown as { __dashboardEnergy: Record<string, number> }).__dashboardEnergy;
    for (const key of Object.keys(counters)) counters[key] = 0;
    const icon = document.querySelector('link[data-re-favicon]');
    const iconObserver = new MutationObserver(records => { counters.iconMutations += records.length; });
    if (icon) iconObserver.observe(icon, { attributes: true, attributeFilter: ['href', 'type'] });
    const headerObserver = new MutationObserver(records => { counters.headerTextMutations += records.length; });
    if (button.parentElement) headerObserver.observe(button.parentElement, { subtree: true, childList: true, characterData: true });
  });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const before = await cdp.send('Performance.getMetrics');
  const startedAt = Date.now();
  await page.waitForTimeout(sampleMs);
  const after = await cdp.send('Performance.getMetrics');
  const counters = await page.evaluate(() => (window as unknown as { __dashboardEnergy: Record<string, number> }).__dashboardEnergy);
  const metricDelta = Object.fromEntries(['ScriptDuration', 'TaskDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(name => [
    name, (after.metrics.find(metric => metric.name === name)?.value || 0) - (before.metrics.find(metric => metric.name === name)?.value || 0),
  ]));
  const report = {
    variant: baseline ? 'baseline' : 'optimized', role: 'editing_manager', browser: testInfo.project.name,
    viewport: page.viewportSize(), settleMs: 5000, elapsedMs: Date.now() - startedAt,
    counters, metricDeltaSeconds: metricDelta, runtimeErrors: errors,
    apiRequests: state.requests,
    limitations: 'Headless Chromium with local API fixtures. Browser CPU work only; not battery life or Safari hardware profiling.',
  };
  await testInfo.attach('browser-idle-work', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  if (process.env.E2E_ENERGY_REPORT_DIR) {
    mkdirSync(process.env.E2E_ENERGY_REPORT_DIR, { recursive: true });
    writeFileSync(path.join(process.env.E2E_ENERGY_REPORT_DIR, `${report.variant}.json`), JSON.stringify(report, null, 2));
  }
  if (!baseline) {
    expect(counters.iconMutations).toBe(0);
    expect(counters.canvasEncodes).toBe(0);
    expect(counters.headerTextMutations).toBeLessThan(15);
  }
  expect(errors).toEqual([]);
  const activePrompt = (await insightAction.getAttribute('aria-label')) === `Robbie insight: ${insightMessages[0]}` ? 'Open editing queue 1' : 'Open editing queue 2';
  // Dispatching click checks the actual action without needing to hover a
  // deliberately revealed-on-hover button during the idle sample.
  await insightAction.dispatchEvent('click');
  await expect(page).toHaveURL(/\/chat-with-reproai/);
  await expect.poll(() => state.chatPrompts.at(-1)).toBe(activePrompt);
  await expect(page.getByText('Fixture editing queue response.', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  await cdp.detach();
});

test('the narrow layout unmounts Robbie and remounts it at the visible breakpoint', async ({ page, baseURL }) => {
  test.skip(baseline, 'Baseline deliberately retains the hidden mounted strip.');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 664 });
  await installFixtures(page, baseURL);
  await openDashboard(page);
  await expect(page.getByText('Robbie', { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 640, height: 900 });
  await expect(page.getByText('Robbie', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Robbie insight:/ })).toHaveAttribute('aria-label', `Robbie insight: ${insightMessages[0]}`);
  await page.setViewportSize({ width: 639, height: 900 });
  await expect(page.getByText('Robbie', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a hidden tab pauses and returning resumes Robbie rotation', async ({ page, baseURL }) => {
  test.skip(baseline, 'Baseline deliberately keeps rotating hidden.');
  await installFixtures(page, baseURL);
  await openDashboard(page);
  const insightAction = page.getByRole('button', { name: /^Robbie insight:/ });
  await expect(insightAction).toHaveAttribute('aria-label', `Robbie insight: ${insightMessages[0]}`);
  // Chromium headless has no foreground OS tab. Exercise the actual document
  // visibilitychange integration with a controlled visibility getter.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(6000);
  await expect(insightAction).toHaveAttribute('aria-label', `Robbie insight: ${insightMessages[0]}`);
  await page.evaluate(() => {
    delete (document as unknown as Record<string, unknown>).hidden;
    delete (document as unknown as Record<string, unknown>).visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(insightAction).toHaveAttribute('aria-label', `Robbie insight: ${insightMessages[1]}`, { timeout: 7000 });
});
