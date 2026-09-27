import type { AutomationRule, AutomationScheduleJson, MessagingJsonObject, WorkflowDefinition } from '@/types/messaging';

export const isTimedShootReminder = (trigger: string) => ['SHOOT_REMINDER', 'PHOTOGRAPHER_SHOOT_REMINDER'].includes(trigger);

export function scheduleFromWorkflow(workflow: WorkflowDefinition, previous?: AutomationScheduleJson | null): AutomationScheduleJson | null {
  const trigger = workflow.nodes.find((node) => node.type.startsWith('trigger.'));
  const configured = trigger?.config.schedule;
  const schedule: AutomationScheduleJson = {
    ...previous,
    ...(configured && typeof configured === 'object' && !Array.isArray(configured) ? configured : {}),
  };
  if (trigger?.type !== 'trigger.schedule') {
    delete schedule.type;
    delete schedule.day_of_week;
    const wait = workflow.nodes.find((node) => node.type === 'wait.datetime_offset' && node.config.referenceField === 'shoot_datetime');
    const hasTriggerOffset = configured && typeof configured === 'object' && !Array.isArray(configured) && configured.offset;
    if (!isTimedShootReminder(String(trigger?.config.triggerType ?? ''))) delete schedule.offset;
    if (wait && (!isTimedShootReminder(String(trigger?.config.triggerType ?? '')) || !hasTriggerOffset)) {
      const unit = wait.config.unit === 'days' ? 'd' : wait.config.unit === 'minutes' ? 'm' : 'h';
      schedule.offset = `${wait.config.direction === 'after' ? '+' : '-'}${Number(wait.config.amount)}${unit}`;
    }
  }
  return Object.keys(schedule).length ? schedule : null;
}

// Older property reminders also store their day selection as a condition. Keep
// that selector in sync without disturbing other access or contact checks.
export function syncReminderDayConditions(workflow: WorkflowDefinition, trigger: string, schedule?: AutomationScheduleJson | null): WorkflowDefinition {
  if (trigger !== 'PROPERTY_CONTACT_REMINDER' || schedule?.days_before == null) return workflow;
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => node.type !== 'condition.if' || !Array.isArray(node.config.rules) ? node : {
      ...node,
      config: { ...node.config, rules: node.config.rules.map((rule) => rule && typeof rule === 'object' && !Array.isArray(rule) && rule.field === 'days_before'
        ? { ...rule, operator: 'eq', value: schedule.days_before! } : rule) },
    }),
  };
}

export function syncLegacyReminderCondition(condition: AutomationRule['condition_json'] | null | undefined, trigger: string, schedule?: AutomationScheduleJson | null): MessagingJsonObject | null {
  if (!condition) return null;
  if (trigger !== 'PROPERTY_CONTACT_REMINDER' || schedule?.days_before == null || !('days_before' in condition)) return condition;
  return { ...condition, days_before: schedule.days_before };
}

export function storedReminderSchedule(automation?: Partial<AutomationRule> | null): AutomationScheduleJson | undefined {
  if (!automation) return undefined;
  const result = { ...automation.schedule_json };
  if (automation.trigger_type === 'PROPERTY_CONTACT_REMINDER' && result.days_before == null) {
    const legacyDay = automation.condition_json?.days_before;
    const condition = automation.workflow_definition_json?.nodes.find((node) => node.type === 'condition.if');
    const rule = Array.isArray(condition?.config.rules) ? condition.config.rules.find((item) => item && typeof item === 'object' && !Array.isArray(item) && item.field === 'days_before') : null;
    const value = rule && typeof rule === 'object' && !Array.isArray(rule) ? rule.value : legacyDay;
    if (typeof value === 'number' || (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))) result.days_before = Number(value);
  }
  return result;
}
