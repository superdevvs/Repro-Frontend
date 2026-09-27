import { expect, test, type Page } from '@playwright/test';
import type { AutomationRule, WorkflowDefinition } from '../src/types/messaging';
import { installDashboardMobileFixtures } from './helpers/dashboard-mobile-fixtures';

const validation = { valid: true, errors: [], warnings: [], node_errors: {}, summary: { node_count: 3, edge_count: 2, reachable_action_count: 1 } };
const workflow = (complex = false): WorkflowDefinition => ({
  nodes: [
    { id: 'trigger', type: 'trigger.event', position: { x: 80, y: 140 }, config: { triggerType: complex ? 'PROPERTY_CONTACT_REMINDER' : 'PHOTOGRAPHER_SHOOT_REMINDER', schedule: complex ? { days_before: 2, time: '09:00' } : { offset: '-2h' } } },
    ...(complex ? [{ id: 'condition', type: 'condition.if' as const, position: { x: 320, y: 140 }, config: { match: 'all', rules: [{ field: 'days_before', operator: 'eq', value: 2 }, { field: 'has_contact_details', operator: 'eq', value: false }] } }] : []),
    { id: 'email', type: 'action.email', position: { x: complex ? 560 : 320, y: 140 }, config: { templateId: 4, recipientMode: 'roles', recipientRoles: complex ? ['client'] : ['photographer'] } },
    { id: 'end', type: 'end', position: { x: complex ? 800 : 560, y: 140 }, config: {} },
  ],
  edges: complex ? [
    { id: 't-c', source: 'trigger', target: 'condition' },
    { id: 'c-e', source: 'condition', target: 'email', branchKey: 'true' },
    { id: 'c-end', source: 'condition', target: 'end', branchKey: 'false' },
    { id: 'e-end', source: 'email', target: 'end' },
  ] : [{ id: 't-e', source: 'trigger', target: 'email' }, { id: 'e-end', source: 'email', target: 'end' }],
});

async function fixtures(page: Page, baseURL?: string, complex = false) {
  await installDashboardMobileFixtures(page, baseURL, 'superadmin');
  let rule = {
    id: 17, name: complex ? 'Property access reminder' : 'Photographer reminder',
    description: 'Local acceptance fixture', trigger_type: complex ? 'PROPERTY_CONTACT_REMINDER' : 'PHOTOGRAPHER_SHOOT_REMINDER',
    scope: 'GLOBAL', is_active: true, is_system_locked: false, template_id: 4,
    recipients_json: complex ? ['client'] : ['photographer'],
    schedule_json: complex ? { days_before: 2, time: '09:00' } : { offset: '-2h' },
    workflow_definition_json: workflow(complex), validation_state: validation,
    created_at: '', updated_at: '', recent_runs: [],
  } as AutomationRule;
  const writes: Partial<AutomationRule>[] = [];
  const messages: string[] = [];
  await page.route('**/api/voice/browser/config', route => route.fulfill({ json: { enabled: false, ready: false, blockers: [], presence_verification: 'provider' } }));
  await page.route('**/api/system-telemetry/events', route => route.fulfill({ json: { accepted: true } }));
  await page.route('**/api/me/permissions', route => route.fulfill({ json: { permissionIds: ['messaging-automations:view', 'messaging-automations:update'], permissions: [{ resource: 'messaging-automations', action: 'view' }, { resource: 'messaging-automations', action: 'update' }] } }));
  await page.route('**/api/messaging/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/templates')) return route.fulfill({ json: [
      { id: 4, name: 'Reminder email', channel: 'EMAIL', category: 'REMINDER', scope: 'GLOBAL', is_active: true, subject: 'Upcoming shoot', body_text: 'Details', body_html: '<p>Details</p>' },
      { id: 5, name: 'Reminder SMS', channel: 'SMS', category: 'REMINDER', scope: 'GLOBAL', is_active: true, body_text: 'Upcoming shoot details' },
    ] });
    if (path.endsWith('/settings/email')) return route.fulfill({ json: { channels: [] } });
    if (path.endsWith('/settings/sms')) return route.fulfill({ json: { numbers: [{ id: 3, phone_number: '+15555550123' }, { id: 8, phone_number: '+15555550128' }] } });
    if (path.endsWith('/automations/validate')) return route.fulfill({ json: validation });
    if (path.endsWith('/automations')) return route.fulfill({ json: [rule] });
    if (path.endsWith('/automations/17')) {
      if (request.method() === 'PUT') {
        const payload = request.postDataJSON();
        writes.push(payload);
        rule = { ...rule, ...payload };
      }
      return route.fulfill({ json: rule });
    }
    if (request.method() !== 'GET') messages.push(path);
    return route.fulfill({ status: request.method() === 'GET' ? 200 : 501, json: { data: [] } });
  });
  return { writes, messages, rule: () => rule };
}

for (const mobile of [false, true]) {
  test(`simple reminder saves and reopens on ${mobile ? 'phone' : 'desktop'}`, async ({ page, baseURL }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const state = await fixtures(page, baseURL);
    await page.goto('/messaging/email/automations');
    await page.getByRole('button', { name: 'On site moment' }).click();
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await page.getByLabel('Send before shoot (minutes)').fill('90');
    await page.getByRole('button', { name: 'Admin team', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit message template' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('edited-reminder.png'), fullPage: true });
    await page.getByRole('button', { name: 'Save and open workflow' }).click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.rule().schedule_json?.offset).toBe('-90m');
    expect(state.rule().recipients_json).toEqual(['photographer', 'admin']);
    await page.goto('/messaging/email/automations');
    await page.getByRole('button', { name: 'On site moment' }).click();
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await expect(page.getByLabel('Send before shoot (minutes)')).toHaveValue('90');
    await expect(page.getByRole('button', { name: 'Admin team', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    expect(state.messages).toEqual([]);
  });
}

test('advanced property schedule saves all conditions and reopens cleanly', async ({ page, baseURL }, testInfo) => {
  await page.setViewportSize({ width: 1560, height: 1000 });
  const state = await fixtures(page, baseURL, true);
  await page.goto('/messaging/email/automations');
  await page.getByRole('button', { name: 'On site moment' }).click();
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(page).toHaveURL(/automations\/17$/);
  await expect(page.locator('[data-page-loading]')).toHaveAttribute('data-page-loading', 'ready');
  await page.getByLabel('Days before shoot').click();
  await page.getByLabel('Days before shoot').fill('1');
  await expect(page.getByLabel('Days before shoot')).toHaveValue('1');
  await page.getByLabel('Send time').fill('08:45');
  await expect(page.getByLabel('Days before shoot')).toHaveValue('1');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await expect(page.getByText('Unsaved', { exact: true })).toHaveCount(0);
  expect(state.rule().workflow_definition_json?.nodes.find((node) => node.type === 'condition.if')?.config.rules).toEqual([
    { field: 'days_before', operator: 'eq', value: 1 }, { field: 'has_contact_details', operator: 'eq', value: false },
  ]);
  await page.reload();
  await expect(page.locator('[data-page-loading]')).toHaveAttribute('data-page-loading', 'ready');
  await expect(page.getByLabel('Days before shoot')).toHaveValue('1');
  await expect(page.getByLabel('Send time')).toHaveValue('08:45');
  await page.screenshot({ path: testInfo.outputPath('saved-advanced-workflow.png'), fullPage: true });
  expect(state.messages).toEqual([]);
});

test('SMS action saves the selected sending number independently of email channels', async ({ page, baseURL }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await fixtures(page, baseURL);
  const action = state.rule().workflow_definition_json!.nodes.find((node) => node.type === 'action.email')!;
  action.type = 'action.sms';
  action.config = { ...action.config, templateId: 5, smsNumberId: 3 };
  state.rule().template_id = 5;
  await page.goto('/messaging/email/automations');
  await page.getByRole('button', { name: 'On site moment' }).click();
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await page.getByRole('combobox', { name: 'SMS sending number' }).click();
  await page.getByRole('option', { name: '+15555550128' }).click();
  await page.screenshot({ path: testInfo.outputPath('sms-sending-number.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save and open workflow' }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  const saved = state.rule().workflow_definition_json!.nodes.find((node) => node.type === 'action.sms')!;
  expect(saved.config.smsNumberId).toBe(8);
  expect(saved.config.channelId).toBeUndefined();
  expect(state.messages).toEqual([]);
});
