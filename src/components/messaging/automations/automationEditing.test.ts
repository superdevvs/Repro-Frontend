import { describe, expect, it } from 'vitest';
import type { AutomationRule } from '@/types/messaging';
import { createDefaultDraft } from './automationEditorModel';
import { buildSimpleWorkflowFromDraft, extractSimpleAutomationDraft } from './workflow-utils';
import { createMetaFromAutomation, deriveWorkflowPayload } from '@/pages/messaging/automation-workflow-editor/helpers';
import { recipientSummary, whenSummary } from '@/pages/messaging/automationMoments';
import { scheduleFromWorkflow } from './automationSchedule';

const fixture = (changes: Partial<AutomationRule> = {}): AutomationRule => ({
  id: 9, name: 'Reminder', trigger_type: 'SHOOT_REMINDER', scope: 'GLOBAL', is_active: true,
  created_at: '', updated_at: '', ...changes,
});

describe('editable automation round trips', () => {
  it('keeps reminder timing on the trigger without another wait after dispatch', () => {
    const draft = { ...createDefaultDraft(), trigger_type: 'PHOTOGRAPHER_SHOOT_REMINDER' as const, template_id: '4', recipient_roles: ['photographer'] as const, schedule_json: { offset: '-90m' } };
    const workflow = buildSimpleWorkflowFromDraft({ ...draft, recipient_roles: [...draft.recipient_roles] });
    expect(workflow.nodes.some((node) => node.type.startsWith('wait.'))).toBe(false);
    const rule = fixture({ workflow_definition_json: workflow, schedule_json: { offset: '-24h' } });
    const payload = deriveWorkflowPayload(createMetaFromAutomation(rule), workflow, rule);
    expect(payload.schedule_json?.offset).toBe('-90m');
    expect(extractSimpleAutomationDraft({ ...rule, ...payload })?.schedule_json?.offset).toBe('-90m');
  });

  it('repairs an actionless reminder as email instead of coercing it into a weekly command', () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), trigger_type: 'SHOOT_REMINDER' });
    workflow.nodes = workflow.nodes.filter((node) => !node.type.startsWith('action.'));
    workflow.edges = [{ id: 'start-end', source: 'trigger_start', target: 'end_default' }];
    const draft = extractSimpleAutomationDraft(fixture({ workflow_definition_json: workflow }));
    expect(draft?.action_type).toBe('email');
    expect(draft?.trigger_mode).toBe('event');
  });

  it('routes multi-condition workflows out of the simple form and preserves them when saved', () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), use_condition: true, condition_field: 'days_before', condition_value: '2' });
    const condition = workflow.nodes.find((node) => node.type === 'condition.if')!;
    condition.config.rules = [
      { field: 'days_before', operator: 'eq', value: 2 },
      { field: 'has_contact_details', operator: 'eq', value: false },
      { field: 'shoot.status', operator: 'in', value: ['scheduled', 'booked'] },
    ];
    workflow.nodes[0].config = { triggerType: 'PROPERTY_CONTACT_REMINDER', schedule: { days_before: 1, time: '08:45' } };
    const rule = fixture({ trigger_type: 'PROPERTY_CONTACT_REMINDER', workflow_definition_json: workflow });
    expect(extractSimpleAutomationDraft(rule)).toBeNull();
    const payload = deriveWorkflowPayload(createMetaFromAutomation(rule), workflow, rule);
    expect(payload.schedule_json).toMatchObject({ days_before: 1, time: '08:45' });
    expect(payload.workflow_definition_json.nodes.find((node) => node.type === 'condition.if')?.config.rules).toEqual([
      { field: 'days_before', operator: 'eq', value: 1 },
      { field: 'has_contact_details', operator: 'eq', value: false },
      { field: 'shoot.status', operator: 'in', value: ['scheduled', 'booked'] },
    ]);
    expect(condition.config.rules[0]).toEqual({ field: 'days_before', operator: 'eq', value: 2 });
  });

  it('uses edited wait timing for ordinary event workflows and clears removed waits', () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), timing_mode: 'offset', offset_value: '3' });
    workflow.nodes[0].config.schedule = { offset: '-24h' };
    expect(scheduleFromWorkflow(workflow, { offset: '-24h' })?.offset).toBe('-3h');
    workflow.nodes = workflow.nodes.filter((node) => node.type !== 'wait.datetime_offset');
    expect(scheduleFromWorkflow(workflow, { offset: '-24h' })).toBeNull();
  });

  it('does not restore a stale template when the action was changed to inline content', () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), subject: 'Update', body_text: 'Updated details' });
    const rule = fixture({ template_id: 42, workflow_definition_json: workflow });
    expect(extractSimpleAutomationDraft(rule)?.template_id).toBe('');
    expect(deriveWorkflowPayload(createMetaFromAutomation(rule), workflow, rule).template_id).toBeNull();
  });

  it('keeps invoice cadence editable and reports actual workflow recipients', () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), trigger_type: 'INVOICE_OVERDUE', recipient_roles: ['client', 'admin'], schedule_json: { time: '10:00', overdue_days: [1, 7, 14], repeat_every_days: 15 } });
    const rule = fixture({ trigger_type: 'INVOICE_OVERDUE', recipients_json: ['photographer'], workflow_definition_json: workflow });
    const payload = deriveWorkflowPayload(createMetaFromAutomation(rule), workflow, rule);
    expect(payload.schedule_json).toEqual({ time: '10:00', overdue_days: [1, 7, 14], repeat_every_days: 15 });
    expect(recipientSummary(rule)).toBe('Client, Admin');
    expect(whenSummary(rule)).toBe('Days 1, 7, 14, then every 15 days at 10:00');
  });

  it('round trips the SMS sending number without treating it as an email channel', () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), action_type: 'sms', body_text: 'Please add access details', sms_number_id: 3, channel_id: '12' });
    const action = workflow.nodes.find((node) => node.type === 'action.sms')!;
    expect(action.config.smsNumberId).toBe(3);
    expect(action.config.channelId).toBeUndefined();
    expect(extractSimpleAutomationDraft(fixture({ workflow_definition_json: workflow }))?.sms_number_id).toBe(3);
  });

  it('retains the new-account recipient in advanced workflow saves', () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), trigger_type: 'ACCOUNT_CREATED', recipient_mode: 'automation_default', recipient_roles: ['account'], template_id: '4' });
    const rule = fixture({ trigger_type: 'ACCOUNT_CREATED', recipients_json: ['account'], workflow_definition_json: workflow });
    const payload = deriveWorkflowPayload(createMetaFromAutomation(rule), workflow, rule);
    expect(payload.recipients_json).toEqual(['account']);
    expect(recipientSummary({ ...rule, ...payload })).toBe('New account');
  });

  it('saves comma-separated one-of choices as an array and preserves typed saved arrays', () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), use_condition: true, condition_field: 'shoot.status', condition_operator: 'in', condition_value: 'scheduled, completed' });
    const condition = workflow.nodes.find((node) => node.type === 'condition.if')!;
    expect(condition.config.rules).toEqual([{ field: 'shoot.status', operator: 'in', value: ['scheduled', 'completed'] }]);
    condition.config.rules = [{ field: 'custom_value', operator: 'in', value: [1, false, 'a,b'] }];
    const rule = fixture({ workflow_definition_json: workflow });
    const draft = extractSimpleAutomationDraft(rule)!;
    expect(draft).not.toBeNull();
    expect(buildSimpleWorkflowFromDraft(draft).nodes.find((node) => node.type === 'condition.if')?.config.rules).toEqual(condition.config.rules);
    expect(deriveWorkflowPayload(createMetaFromAutomation(rule), workflow, rule).workflow_definition_json.nodes.find((node) => node.type === 'condition.if')?.config.rules).toEqual(condition.config.rules);
  });
});
