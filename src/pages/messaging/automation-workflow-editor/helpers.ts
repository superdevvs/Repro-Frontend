import type { AxiosError } from 'axios';
import type {
  AutomationRecipientRole,
  AutomationRule,
  AutomationSimulationResult,
  AutomationTriggerType,
  AutomationValidationState,
  MessagingJsonObject,
  MessagingJsonValue,
  WorkflowDefinition,
  WorkflowNode,
} from '@/types/messaging';
import type {
  AutomationConditionMatch,
  AutomationConditionOperator,
  AutomationConditionRule,
  AutomationContextKey,
  AutomationPriority,
  AutomationRecipientMode,
  AutomationScheduleConfig,
  AutomationWaitUnit,
} from '@/components/messaging/automations/automationWorkflowTypes';

export const weekdayOptions = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
] as const;

export const ruleOperatorOptions: Array<{ value: AutomationConditionOperator; label: string }> = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Does not equal' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'exists', label: 'Exists' },
  { value: 'in', label: 'Is in list' },
];

export const recipientRoleOptions: Array<{ value: AutomationRecipientRole; label: string }> = [
  { value: 'client', label: 'Client' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'admin', label: 'Admin team' },
  { value: 'rep', label: 'Sales rep' },
];

export const contextRecipientOptions: Array<{ value: AutomationContextKey; label: string }> = [
  { value: 'client', label: 'Client from trigger context' },
  { value: 'photographer', label: 'Photographer from trigger context' },
  { value: 'rep', label: 'Rep from trigger context' },
];

const variableHints: Record<string, string[]> = {
  default: [
    '{{shoot_address}}',
    '{{shoot_datetime}}',
    '{{client.name}}',
    '{{photographer.name}}',
    '{{rep.name}}',
    '{{invoice.total}}',
  ],
  SHOOT_BOOKED: ['{{shoot_address}}', '{{shoot_datetime}}', '{{client.name}}', '{{services}}'],
  SHOOT_UPDATED: ['{{shoot_address}}', '{{shoot_datetime}}', '{{changes.summary}}', '{{client.name}}'],
  PAYMENT_FAILED: ['{{client.name}}', '{{invoice.total}}', '{{invoice.id}}'],
  WEEKLY_AUTOMATED_INVOICING: ['{{period_start}}', '{{period_end}}', '{{invoice_count}}'],
  WEEKLY_SALES_REPORT: ['{{period_start}}', '{{period_end}}', '{{sales_total}}'],
};

export type AutomationEditorMeta = {
  name: string;
  description: string;
  scope: AutomationRule['scope'];
  is_active: boolean;
  editor_mode: 'visual' | 'simple';
  is_system_locked: boolean;
};

export type LocationState = {
  duplicateAutomation?: AutomationRule;
};

export type WorkflowSummary = {
  trigger: WorkflowNode | undefined;
  totalNodes: number;
  totalEdges: number;
  actionCount: number;
  waitCount: number;
  conditionCount: number;
  nodeCounts: Record<string, number>;
};

export const getMutationErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object') {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    const responseMessage = axiosError.response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage) {
      return responseMessage;
    }

    const responseError = axiosError.response?.data?.error;
    if (typeof responseError === 'string' && responseError) {
      return responseError;
    }

    if ('message' in error && typeof error.message === 'string' && error.message) {
      return error.message;
    }
  }

  return fallback;
};

export const asJsonObject = (value: MessagingJsonValue | undefined | null): MessagingJsonObject | undefined => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as MessagingJsonObject;
  }

  return undefined;
};

export const asString = (value: MessagingJsonValue | undefined | null, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

export const asNumber = (value: MessagingJsonValue | undefined | null, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value);
  return fallback;
};

export const asRoleArray = (value: MessagingJsonValue | undefined | null): AutomationRecipientRole[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is AutomationRecipientRole =>
    item === 'client' || item === 'photographer' || item === 'admin' || item === 'rep',
  );
};

export const getTriggerNode = (workflow: WorkflowDefinition) =>
  workflow.nodes.find((node) => String(node.type).startsWith('trigger.'));

export const getPrimaryActionNode = (workflow: WorkflowDefinition) =>
  workflow.nodes.find((node) => node.type === 'action.email' || node.type === 'action.sms');

export const getTriggerTypeForWorkflow = (
  workflow: WorkflowDefinition,
  automation?: AutomationRule | null,
): AutomationTriggerType => {
  const triggerNode = getTriggerNode(workflow);
  const value = asString(triggerNode?.config?.triggerType, automation?.trigger_type ?? 'SHOOT_BOOKED');
  return value as AutomationTriggerType;
};

export const getScheduleConfig = (
  source?: MessagingJsonObject | AutomationRule['schedule_json'] | null,
): AutomationScheduleConfig => {
  const config = asJsonObject(source as MessagingJsonValue) ?? (source as MessagingJsonObject | undefined) ?? {};

  return {
    type: asString(config.type, 'weekly'),
    day_of_week: asNumber(config.day_of_week, 1),
    time: asString(config.time, '01:00'),
    offset: asString(config.offset, '') || undefined,
    cron: asString(config.cron, '') || undefined,
    command: asString(config.command, '') || undefined,
  };
};

export const summarizeSchedule = (workflow: WorkflowDefinition, automation?: AutomationRule | null) => {
  const triggerNode = getTriggerNode(workflow);

  if (triggerNode?.type === 'trigger.schedule') {
    const schedule = getScheduleConfig(asJsonObject(triggerNode.config?.schedule));
    const dayOfWeek = weekdayOptions.find((option) => option.value === String(schedule.day_of_week))?.label ?? 'Monday';
    return `${schedule.type || 'weekly'} on ${dayOfWeek} at ${schedule.time || '01:00'}`;
  }

  if (automation?.schedule_json?.offset) {
    return `Offset ${automation.schedule_json.offset}`;
  }

  return 'Event-driven';
};

export const createMetaFromAutomation = (automation?: AutomationRule | null): AutomationEditorMeta => ({
  name: automation?.name ?? '',
  description: automation?.description ?? '',
  scope: automation?.scope ?? 'GLOBAL',
  is_active: automation?.is_active ?? true,
  editor_mode: (automation?.editor_mode as 'visual' | 'simple') ?? 'visual',
  is_system_locked: Boolean(automation?.is_system_locked),
});

export const getWorkflowVariables = (triggerType?: string) => variableHints[triggerType || ''] ?? variableHints.default;

export const getConditionRules = (node?: WorkflowNode | null): AutomationConditionRule[] => {
  if (!node || node.type !== 'condition.if') {
    return [];
  }

  const rawRules = node.config?.rules;
  if (!Array.isArray(rawRules)) {
    return [];
  }

  return rawRules.map((rule) => {
    const ruleObject = asJsonObject(rule) ?? {};
    return {
      field: asString(ruleObject.field),
      operator: (asString(ruleObject.operator, 'eq') as AutomationConditionOperator) ?? 'eq',
      value:
        typeof ruleObject.value === 'number' || typeof ruleObject.value === 'string'
          ? ruleObject.value
          : ruleObject.value == null
            ? null
            : asString(ruleObject.value),
    };
  });
};

export const getConditionMatch = (node?: WorkflowNode | null): AutomationConditionMatch => {
  return (asString(node?.config?.match, 'all') as AutomationConditionMatch) || 'all';
};

export const getRecipientMode = (node?: WorkflowNode | null): AutomationRecipientMode => {
  return (asString(node?.config?.recipientMode, 'automation_default') as AutomationRecipientMode) || 'automation_default';
};

export const getRecipientRoles = (node?: WorkflowNode | null, automation?: AutomationRule | null): AutomationRecipientRole[] => {
  const nodeRoles = asRoleArray(node?.config?.recipientRoles);
  if (nodeRoles.length) {
    return nodeRoles;
  }

  if (Array.isArray(automation?.recipients_json)) {
    return automation.recipients_json;
  }

  return automation?.recipients_json?.roles ?? ['client'];
};

export const getContextKey = (node?: WorkflowNode | null): AutomationContextKey => {
  const key = asString(node?.config?.contextKey, 'client');
  return key === 'photographer' || key === 'rep' ? key : 'client';
};

export const getWaitAmount = (node: WorkflowNode | null | undefined, fallback: number): number => asNumber(node?.config?.amount, fallback);
export const getWaitUnit = (node: WorkflowNode | null | undefined, fallback: AutomationWaitUnit): AutomationWaitUnit => {
  const unit = asString(node?.config?.unit, fallback);
  return unit === 'days' || unit === 'hours' || unit === 'minutes' ? unit : fallback;
};

export const getInternalPriority = (node?: WorkflowNode | null): AutomationPriority => {
  const priority = asString(node?.config?.priority, 'normal');
  return priority === 'high' || priority === 'urgent' ? priority : 'normal';
};

export const deriveWorkflowPayload = (
  meta: AutomationEditorMeta,
  workflow: WorkflowDefinition,
  automation?: AutomationRule | null,
) => {
  const triggerNode = getTriggerNode(workflow);
  const primaryActionNode = getPrimaryActionNode(workflow);
  const firstConditionNode = workflow.nodes.find((node) => node.type === 'condition.if');
  const derivedTriggerType = getTriggerTypeForWorkflow(workflow, automation);
  const recipientRoles = getRecipientRoles(primaryActionNode, automation);

  const scheduleJson =
    triggerNode?.type === 'trigger.schedule'
      ? {
          ...getScheduleConfig(asJsonObject(triggerNode.config?.schedule)),
          ...(asString(workflow.meta?.system_command) ? { command: asString(workflow.meta?.system_command) } : {}),
        }
      : automation?.schedule_json ?? null;

  return {
    name: meta.name,
    description: meta.description,
    trigger_type: derivedTriggerType,
    editor_mode: meta.editor_mode,
    engine_version: 2,
    is_active: meta.is_active,
    scope: meta.scope,
    template_id: primaryActionNode?.config?.templateId ? Number(primaryActionNode.config.templateId) : automation?.template_id ?? null,
    channel_id: primaryActionNode?.config?.channelId ? Number(primaryActionNode.config.channelId) : automation?.channel_id ?? null,
    recipients_json: recipientRoles,
    condition_json: firstConditionNode?.config ?? automation?.condition_json ?? null,
    schedule_json: scheduleJson,
    workflow_definition_json: workflow,
    entry_trigger_json: {
      trigger_type: derivedTriggerType,
      node_id: triggerNode?.id ?? null,
      node_type: triggerNode?.type ?? null,
      config: triggerNode?.config ?? {},
    },
    is_system_locked: meta.is_system_locked,
  };
};

export const buildWorkflowSummary = (workflow: WorkflowDefinition): WorkflowSummary => {
  const nodeCounts = workflow.nodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.type] = (acc[node.type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    trigger: getTriggerNode(workflow),
    totalNodes: workflow.nodes.length,
    totalEdges: workflow.edges.length,
    actionCount: workflow.nodes.filter((node) => node.type.startsWith('action.')).length,
    waitCount: workflow.nodes.filter((node) => node.type.startsWith('wait.')).length,
    conditionCount: workflow.nodes.filter((node) => node.type === 'condition.if').length,
    nodeCounts,
  };
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not run yet';

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const getTraceRecipientsText = (simulationResult: AutomationSimulationResult | null, index: number): string => {
  const entry = simulationResult?.trace?.[index];
  if (!entry?.preview_recipients?.length) {
    return '';
  }

  return entry.preview_recipients
    .map((recipient) => recipient.email || recipient.phone)
    .filter((recipient): recipient is string => Boolean(recipient))
    .join(', ');
};
