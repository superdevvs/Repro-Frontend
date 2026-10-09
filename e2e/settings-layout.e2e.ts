import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const sectionNames = ['My Account', 'Branding', 'Editing', 'Business', 'Integrations', 'Robbie AI'];
const fixtureUser = (role: string) => ({ id: '900099', name: 'Settings QA', email: 'settings@example.test', role,
  phone: '+15555550199', company: 'QA Company', timezone: 'America/New_York', bio: '',
  account_status: 'active', email_verified_at: '2026-01-01T00:00:00Z', metadata: { terms_accepted_at: '2026-01-01T00:00:00Z', preferences: {} } });

async function fixture(page: Page, baseURL: string | undefined, role = 'superadmin', theme = 'light') {
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Settings fixtures require a loopback preview.');
  let actor = fixtureUser(role);
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => { errors.push(error.message); console.log('Settings runtime error:', error.message); });
  await page.addInitScript(({ user, theme }) => {
    if (!localStorage.getItem('user')) localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('authToken', 'local-settings-fixture-not-a-real-token');
    localStorage.setItem('repro:user-profile:last-fetch-at', String(Date.now()));
    localStorage.setItem('theme', theme);
  }, { user: actor, theme });
  const resources = role === 'editing_manager' ? ['settings', 'dashboard']
    : ['settings', 'dashboard', 'accounts', 'coupons', 'integrations', 'watermark-settings', 'robbie-settings'];
  await page.route('**/api/**', async route => {
    const req = route.request(); const pathname = new URL(req.url()).pathname;
    let body: unknown = { data: [] };
    if (pathname === '/api/user') body = actor;
    if (pathname === '/api/admin/system-overview/snapshot') body = { data: null };
    if (pathname.includes('/voice/browser/config')) body = { ready: false, blockers: [], presence_verification: 'provider' };
    if (pathname === '/api/me/permissions') body = { permissions: resources.flatMap(resource => ['view', 'create', 'update'].map(action => ({ resource, action }))), permissionIds: [] };
    if (pathname.endsWith('/branding')) body = { data: { branding: {} } };
    if (pathname === '/api/profile' && req.method() === 'PUT') {
      const input = req.postDataJSON(); writes.push({ path: pathname, body: input });
      actor = { ...actor, ...input, phone: input.phone_number ?? actor.phone, company: input.company_name ?? actor.company,
        metadata: { ...actor.metadata, preferences: { ...actor.metadata.preferences, ...(input.preferences ?? {}) } } };
      body = { user: actor, message: 'Profile updated successfully' };
    }
    if (pathname === '/api/desktop-editing') body = { data: { available: false, reason: 'Local fixture', installers: {}, devices: [] } };
    if (pathname === '/api/studio/provider-settings') body = { data: { services: [], credentials: { fotello: { keyConfigured: false, teamIdConfigured: false } } } };
    if (pathname === '/api/admin/watermark-settings') body = { id: 1, logo_enabled: true, logo_position: 'center', logo_opacity: 50, logo_size: 25, logo_offset_x: 0, logo_offset_y: 0, custom_logo_url: null,
      text_enabled: false, text_content: 'REPRO', text_style: 'diagonal', text_opacity: 30, text_color: '#ffffff', text_size: 40, text_spacing: 100, text_angle: -30, overlay_enabled: false, overlay_color: '#000000' };
    if (pathname === '/api/admin/robbie-settings') {
      const defaults = { model: 'gpt-4o', temperature: 0.7, max_tokens: 2000, tools: { enabled: true, allow: [], deny: [] }, features: { voice: { enabled: false }, media_links: { enabled: true } }, system_prompt: '' };
      body = { success: true, data: { defaults, global: {}, role_configs: {}, merged_configs: {}, roles: ['admin', 'client'] } };
    }
    if (pathname.includes('/admin/settings/')) body = { data: { value: {} } };
    if (pathname.includes('/admin/short-links/settings')) body = { data: { enabled: true, code_length: 10, types: {} } };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { writes, errors };
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function capture(page: Page, name: string) {
  if (process.env.REPRO_SETTINGS_ARTIFACTS) await page.screenshot({ path: path.join(process.env.REPRO_SETTINGS_ARTIFACTS, `${name}.png`), animations: 'disabled', fullPage: true });
}

for (const width of [390, 1280]) {
  test(`six sections and all legacy links remain usable at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page, baseURL);
    await page.goto('/settings');
    await expect(page.getByLabel('Full Name', { exact: true })).toBeVisible();
    const categories = page.getByRole('tablist', { name: 'Settings sections', exact: true });
    expect(await categories.getByRole('tab').evaluateAll(tabs => tabs.map(tab => tab.getAttribute('aria-label')))).toEqual(sectionNames);
    if (width < 768) expect(await categories.getByRole('tab').first().evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await noOverflow(page);
    await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeInViewport();
    await capture(page, `personal-${width}`);
    await categories.getByRole('tab', { name: 'Business', exact: true }).click();
    await page.getByRole('tab', { name: 'Service Areas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Service Area Assignment', exact: true })).toBeVisible();
    await categories.getByRole('tab', { name: 'My Account', exact: true }).click();
    await categories.getByRole('tab', { name: 'Business', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Service Areas', exact: true })).toHaveAttribute('aria-selected', 'true');

    for (const [tab, marker] of [
      ['account', 'Account & security'], ['notifications', 'Notification Preferences'], ['branding', 'Branding'],
      ['watermark', 'Logo Watermark'], ['desktop-editing', 'Desktop editing'], ['ai-editing', 'AI Editing'],
      ['coupons', 'Discounts'], ['service-areas', 'Service Area Assignment'], ['integrations', 'Link shortening'], ['robbie', 'Robbie AI Configuration'],
    ]) {
      await page.goto(`/settings?tab=${tab}`);
      await expect(page.getByRole('heading', { name: marker, exact: true }).last()).toBeVisible();
      await noOverflow(page);
      await capture(page, `${tab}-${width}`);
    }
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });

  test(`profile, account and notifications save through the real forms at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page, baseURL);
    await page.goto('/settings');
    await page.getByLabel('Full Name', { exact: true }).fill('Settings Updated');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Settings Updated', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Account & security' }).click();
    await page.getByLabel('Company', { exact: true }).fill('Updated Company');
    await page.getByRole('button', { name: 'Update Account', exact: true }).click();
    await expect(page.getByText('Account Updated', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Notifications', exact: true }).click();
    await page.getByRole('switch', { name: 'Booking updates', exact: true }).click();
    await page.getByRole('button', { name: 'Save Preferences' }).click();
    await expect(page.getByText('Preferences updated', { exact: true })).toBeVisible();
    expect(state.writes).toHaveLength(3);
    expect(state.writes[0].body).toEqual({ name: 'Settings Updated' });
    expect(state.writes[1].body.company_name).toBe('Updated Company');
    expect((state.writes[2].body.preferences as { smsCategories: { bookingUpdates: boolean } }).smsCategories.bookingUpdates).toBe(false);
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Booking updates', exact: true })).toHaveAttribute('aria-checked', 'false');
    expect(state.errors).toEqual([]);
  });

  test(`admin cannot open AI provider or monitor settings at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page, baseURL, 'admin');
    await page.goto('/settings?tab=desktop-editing');
    await expect(page.getByRole('heading', { name: 'Desktop editing', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'AI providers' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'System Monitor', exact: true })).toHaveCount(0);
    await page.goto('/settings?tab=ai-editing');
    await expect(page.getByLabel('Full Name', { exact: true })).toBeVisible();
    await page.goto('/system-monitor');
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByLabel('Full Name', { exact: true })).toBeVisible();
    for (let click = 0; click < 6; click++) await page.getByRole('tab', { name: 'Account & security', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'System Monitor', exact: true })).toHaveCount(0);
  });

  test(`monitor requires five consecutive Account clicks and stays inside Settings at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 600 });
    const state = await fixture(page, baseURL);
    await page.goto('/system-monitor?view=server');
    await expect(page).toHaveURL(/\/settings\?view=server&tab=account$/);
    await expect(page.getByRole('heading', { name: 'Account & security', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'System Monitor', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'System Monitor', exact: true })).toHaveCount(0);
    await page.goto('/settings?tab=overview');
    await expect(page.getByLabel('Full Name', { exact: true })).toBeVisible();
    const account = page.getByRole('tab', { name: 'Account & security', exact: true });
    for (let click = 0; click < 4; click++) await account.click();
    await expect(page.getByRole('tab', { name: 'System Monitor', exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Notifications', exact: true }).click();
    for (let click = 0; click < 4; click++) await account.click();
    await expect(page.getByRole('tab', { name: 'System Monitor', exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Branding', exact: true }).click();
    await page.getByRole('tab', { name: 'My Account', exact: true }).click();
    for (let click = 0; click < 4; click++) await account.click();
    await expect(page.getByRole('tab', { name: 'System Monitor', exact: true })).toHaveCount(0);
    await account.click();
    await expect(page.getByRole('tab', { name: 'System Monitor', exact: true })).toBeVisible();
    await expect(account).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await expect(page.getByRole('tab', { name: 'System Monitor', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'System Monitor', exact: true }).click();
    await expect(page).toHaveURL(/\/settings\?tab=overview$/);
    await expect(page.getByRole('tablist', { name: 'Overview views', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'System Monitor', exact: true })).toHaveCount(0);
    await noOverflow(page);
    await capture(page, `hidden-monitor-unlocked-${width}`);
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });

  test(`editing manager only sees allowed categories and dark mode remains compact at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page, baseURL, 'editing_manager', 'dark');
    await page.goto('/settings?tab=desktop-editing');
    await expect(page.getByRole('heading', { name: 'Desktop editing', exact: true })).toBeVisible();
    const expected = ['My Account', 'Editing'];
    expect(await page.getByRole('tablist', { name: 'Settings sections', exact: true }).getByRole('tab').evaluateAll(tabs => tabs.map(tab => tab.getAttribute('aria-label')))).toEqual(expected);
    await expect(page.locator('html')).toHaveClass(/dark/);
    await noOverflow(page);
    await capture(page, `editing-manager-dark-${width}`);
  });
}

test('subsection keyboard navigation and automatic email verification disclosure', async ({ page, baseURL }) => {
  await fixture(page, baseURL);
  await page.goto('/settings');
  const categories = page.getByRole('tablist', { name: 'Settings sections', exact: true });
  await categories.getByRole('tab', { name: 'My Account', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(categories.getByRole('tab', { name: 'Branding', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(categories.getByRole('tab', { name: 'My Account', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Personal details' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Account & security' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Current Password', { exact: true })).not.toBeVisible();
  await page.getByLabel('Email Address').fill('changed@example.test');
  await expect(page.getByLabel('Current Password', { exact: true })).toBeVisible();
  await page.getByLabel('Email Address').fill('settings@example.test');
  await page.getByText('Change password or verify an email change', { exact: true }).click();
  await expect(page.getByLabel('New Password', { exact: true })).toBeVisible();
});

for (const width of [320, 768, 1024]) {
  test(`narrow and tablet layouts fit every major tool in dark mode at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page, baseURL, 'superadmin', 'dark');
    for (const tab of ['account', 'notifications', 'branding', 'watermark', 'ai-editing', 'integrations', 'robbie']) {
      await page.goto(`/settings?tab=${tab}`);
      await expect(page.locator('[data-settings-content] > [role="tabpanel"][data-state="active"]')).toBeVisible();
      await expect(page.locator('html')).toHaveClass(/dark/);
      await noOverflow(page);
    }
    await capture(page, `robbie-dark-${width}`);
    expect(state.errors).toEqual([]);
    expect(state.writes).toEqual([]);
  });
}

for (const viewport of [{ width: 390, height: 600 }, { width: 320, height: 568 }, { width: 667, height: 375 }]) {
  test(`compact navigation and save controls remain usable on ${viewport.width}x${viewport.height}`, async ({ page, baseURL }) => {
    await page.setViewportSize(viewport);
    const state = await fixture(page, baseURL, 'superadmin', 'dark');
    await page.goto('/settings');
    await expect(page.getByLabel('Full Name', { exact: true })).toBeVisible();
    const categories = page.getByRole('tablist', { name: 'Settings sections', exact: true });
    const initialHeight = await page.locator('[data-settings-layout] > div').first().evaluate(element => element.getBoundingClientRect().height);
    expect(initialHeight).toBeLessThanOrEqual(50);
    for (const name of sectionNames) {
      await categories.getByRole('tab', { name, exact: true }).click();
      await expect(categories.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
      await noOverflow(page);
      if (name === 'Integrations' || name === 'Robbie AI') await expect(page.getByRole('tablist', { name: `${name} options`, exact: true })).toHaveCount(0);
    }
    await categories.getByRole('tab', { name: 'My Account', exact: true }).click();
    await page.getByRole('tab', { name: 'Personal details', exact: true }).click();
    const save = page.getByRole('button', { name: 'Save Changes', exact: true });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    await page.getByRole('tab', { name: 'Account & security', exact: true }).click();
    await page.getByRole('button', { name: 'Update Account', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Update Account', exact: true })).toBeInViewport();
    await page.getByRole('tab', { name: 'Notifications', exact: true }).click();
    await page.getByRole('button', { name: 'Save Preferences', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Save Preferences', exact: true })).toBeInViewport();
    await page.getByRole('tab', { name: 'Personal details', exact: true }).click();
    await categories.scrollIntoViewIfNeeded();
    await capture(page, `short-height-${viewport.width}x${viewport.height}`);
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}
