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

async function fixtures(page: Page, baseURL?: string, complex = false, payout = false) {
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
  if (payout) {
    rule = { ...rule, name: 'Accounting payout digest', trigger_type: 'WEEKLY_PAYOUT_DIGEST', scope: 'SYSTEM', recipients_json: ['accounting'], schedule_json: { type: 'weekly', day_of_week: 0, time: '05:00', accounting_email: 'accounts@example.com' } };
    rule.workflow_definition_json!.nodes[0] = { ...rule.workflow_definition_json!.nodes[0], type: 'trigger.schedule', config: { triggerType: rule.trigger_type, schedule: { ...rule.schedule_json } } };
    rule.workflow_definition_json!.nodes[1].config.recipientRoles = ['accounting'];
  }
  const writes: Partial<AutomationRule>[] = [];
  const templateWrites: Record<string, unknown>[] = [];
  const templates = [
    { id: 4, name: 'Reminder email', channel: 'EMAIL', category: 'REMINDER', scope: 'GLOBAL', is_active: true, subject: 'Upcoming shoot', body_text: 'Details', body_html: '<p>Details</p>' },
    { id: 5, name: 'Reminder SMS', channel: 'SMS', category: 'REMINDER', scope: 'GLOBAL', is_active: true, body_text: 'Upcoming shoot details' },
    { id: 6, name: 'Revised reminder SMS', channel: 'SMS', category: 'REMINDER', scope: 'GLOBAL', is_active: true, body_text: 'Revised upcoming shoot details' },
  ];
  const messages: string[] = [];
  await page.route('**/api/voice/browser/config', route => route.fulfill({ json: { enabled: false, ready: false, blockers: [], presence_verification: 'provider' } }));
  await page.route('**/api/system-telemetry/events', route => route.fulfill({ json: { accepted: true } }));
  await page.route('**/api/me/permissions', route => route.fulfill({ json: { permissionIds: ['messaging-automations:view', 'messaging-automations:update'], permissions: [{ resource: 'messaging-automations', action: 'view' }, { resource: 'messaging-automations', action: 'update' }] } }));
  await page.route('**/api/messaging/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/templates')) return route.fulfill({ json: templates.filter((template) => template.channel === (new URL(request.url()).searchParams.get('channel') ?? 'EMAIL')) });
    if (path.endsWith('/templates/6') && request.method() === 'PUT') {
      const payload = request.postDataJSON();
      templateWrites.push(payload);
      templates[2] = { ...templates[2], ...payload };
      return route.fulfill({ json: templates[2] });
    }
    if (path.endsWith('/settings/email')) return route.fulfill({ json: { channels: [{ id: 11, display_name: 'Operations email', type: 'EMAIL', is_active: true }] } });
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
  return { writes, templateWrites, messages, rule: () => rule };
}

for (const mobile of [false, true]) {
  test(`reminder failure history distinguishes repaired and current runs on ${mobile ? 'phone' : 'desktop'}`, async ({ page, baseURL }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1560, height: 1000 });
    const state = await fixtures(page, baseURL);
    Object.assign(state.rule(), {
      id: 21, name: 'Shoot Reminder - 2 Hours Before', trigger_type: 'SHOOT_REMINDER', scope: 'SYSTEM',
      updated_at: '2026-09-27T04:59:11Z',
      recent_runs: [{ id: 857, automation_rule_id: 21, status: 'failed', created_at: '2026-09-15T13:00:04Z',
        started_at: '2026-09-15T13:00:04Z', completed_at: '2026-09-15T13:00:04Z', updated_at: '2026-09-15T13:00:04Z',
        error_message: 'Automation could not complete. Review its configuration and try again.' }],
    });
    await page.goto('/messaging/email/automations');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'On site moment' }).click();
    await expect(page.getByText('Updated since this failed run; awaiting next run.')).toBeVisible();
    await expect(page.getByText(/Previous run failed/)).toBeVisible();
    await expect(page.locator('time').first()).toHaveAttribute('datetime', '2026-09-15T13:00:04.000Z');
    await expect(page.getByRole('button', { name: 'Change', exact: true })).toBeVisible();
    await expect(page.getByLabel('Needs a fix', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Run needs attention', { exact: true })).toHaveCount(0);
    await page.getByText('View run history', { exact: true }).click();
    await expect(page.getByText(state.rule().recent_runs![0].error_message!, { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('historical-reminder-failure.png'), fullPage: true, animations: 'disabled' });

    // A previously started run resumes and fails after the edit: still actionable.
    state.rule().recent_runs!.push({ ...state.rule().recent_runs![0], id: 858, completed_at: '2026-09-27T05:00:00Z', updated_at: '2026-09-27T05:00:00Z', error_message: null });
    await page.reload();
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'On site moment' }).click();
    await expect(page.getByText(/Last run failed/)).toBeVisible();
    await expect(page.getByText(/awaiting next run/)).toHaveCount(0);
    await expect(page.getByLabel('Run needs attention', { exact: true })).toHaveCount(1);
    await page.getByText('View run history', { exact: true }).click();
    await expect(page.getByText('This run failed without an error message.')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('current-reminder-failure.png'), fullPage: true, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    expect(state.writes).toEqual([]);
    expect(state.messages).toEqual([]);
  });

  test(`weekly accounting address saves and reopens on ${mobile ? 'phone' : 'desktop'}`, async ({ page, baseURL }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1560, height: 1000 });
    const state = await fixtures(page, baseURL, false, true);
    await page.goto('/messaging/email/automations');
    await page.getByRole('button', { name: 'Money moment' }).click();
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await page.getByLabel('Accounting email').fill('finance@example.com');
    await page.getByLabel('Time', { exact: true }).fill('06:45');
    await page.getByRole('button', { name: 'Save and open workflow' }).click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.rule().schedule_json).toMatchObject({ accounting_email: 'finance@example.com', time: '06:45', day_of_week: 0 });
    expect(state.rule().recipients_json).toEqual(['accounting']);
    if (!mobile) {
      await expect(page.locator('[data-page-loading]')).toHaveAttribute('data-page-loading', 'ready');
      await expect(page.getByLabel('Accounting email')).toHaveValue('finance@example.com');
      await page.locator('input[type="time"]').fill('07:15');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect.poll(() => state.writes.length).toBe(2);
      expect(state.rule().schedule_json).toMatchObject({ accounting_email: 'finance@example.com', time: '07:15', day_of_week: 0 });
    }
    await page.goto('/messaging/email/automations');
    await page.getByRole('button', { name: 'Money moment' }).click();
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await expect(page.getByLabel('Accounting email')).toHaveValue('finance@example.com');
    await expect(page.getByLabel('Time', { exact: true })).toHaveValue(mobile ? '06:45' : '07:15');
    await page.getByLabel('Accounting email').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('saved-payout-digest.png'), fullPage: true, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    expect(state.messages).toEqual([]);
  });

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

test('dual email and SMS workflow saves and reopens with independent templates and senders', async ({ page, baseURL }, testInfo) => {
  await page.setViewportSize({ width: 1560, height: 1000 });
  const state = await fixtures(page, baseURL);
  const definition = state.rule().workflow_definition_json!;
  const email = definition.nodes.find((node) => node.type === 'action.email')!;
  email.config.channelId = 11;
  definition.nodes.find((node) => node.type === 'end')!.position = { x: 800, y: 140 };
  definition.nodes.push({ id: 'sms', type: 'action.sms', position: { x: 560, y: 140 }, config: { templateId: 5, smsNumberId: 3, recipientMode: 'roles', recipientRoles: ['photographer'] } });
  definition.edges = [
    { id: 't-e', source: 'trigger', target: 'email' },
    { id: 'e-s', source: 'email', target: 'sms' },
    { id: 's-end', source: 'sms', target: 'end' },
  ];

  await page.goto('/messaging/email/automations');
  await page.getByRole('button', { name: 'On site moment' }).click();
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(page).toHaveURL(/automations\/17$/);
  await expect(page.locator('[data-page-loading]')).toHaveAttribute('data-page-loading', 'ready');
  await page.locator('.react-flow__node[data-id="sms"]').click();
  await page.getByRole('combobox', { name: 'SMS sending number' }).click();
  await page.getByRole('option', { name: '+15555550128' }).click();
  await page.getByRole('combobox').filter({ hasText: /^Reminder SMS$/ }).click();
  await page.getByRole('option', { name: 'Revised reminder SMS', exact: true }).click();
  await page.getByRole('button', { name: 'Edit message template', exact: true }).click();
  const templateDialog = page.getByRole('dialog', { name: 'Edit Template' });
  await expect(templateDialog.getByLabel('SMS message content')).toHaveValue('Revised upcoming shoot details');
  await expect(templateDialog.getByLabel('Email Subject *')).toHaveCount(0);
  await expect(templateDialog.getByRole('button', { name: 'Send test email' })).toHaveCount(0);
  await templateDialog.getByLabel('SMS message content').fill('Updated shoot details: {{shoot_address}}');
  await templateDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => state.templateWrites.length).toBe(1);
  expect(state.templateWrites[0]).toMatchObject({ channel: 'SMS', subject: '', body_text: 'Updated shoot details: {{shoot_address}}', override_enabled: false });
  await page.getByRole('button', { name: 'Edit message template', exact: true }).click();
  await expect(templateDialog.getByLabel('SMS message content')).toHaveValue('Updated shoot details: {{shoot_address}}');
  await templateDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);

  const saved = state.rule().workflow_definition_json!;
  expect(saved.nodes.filter((node) => node.type.startsWith('action.'))).toHaveLength(2);
  expect(saved.nodes.find((node) => node.type === 'action.email')?.config).toMatchObject({ templateId: 4, channelId: 11, recipientRoles: ['photographer'] });
  expect(saved.nodes.find((node) => node.type === 'action.sms')?.config).toMatchObject({ templateId: 6, smsNumberId: 8, recipientRoles: ['photographer'] });
  expect(saved.nodes.find((node) => node.type === 'action.sms')?.config.channelId).toBeUndefined();
  expect(saved.edges.map(({ source, target }) => [source, target])).toEqual([['trigger', 'email'], ['email', 'sms'], ['sms', 'end']]);

  await page.reload();
  await expect(page.locator('[data-page-loading]')).toHaveAttribute('data-page-loading', 'ready');
  await page.locator('.react-flow__node[data-id="sms"]').click();
  await expect(page.getByRole('combobox', { name: 'SMS sending number' })).toHaveText('+15555550128');
  await expect(page.getByRole('combobox').filter({ hasText: /^Revised reminder SMS$/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('saved-dual-channel-workflow.png'), fullPage: true, animations: 'disabled' });
  await page.locator('.react-flow__node[data-id="email"]').click();
  await expect(page.getByRole('combobox').filter({ hasText: /^Reminder email$/ })).toBeVisible();
  await expect(page.getByRole('combobox').filter({ hasText: /^Operations email$/ })).toBeVisible();
  expect(state.messages).toEqual([]);
});
