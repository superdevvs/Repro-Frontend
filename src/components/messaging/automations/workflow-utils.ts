import type { AutomationRule, AutomationTriggerType, WorkflowDefinition, WorkflowEdge, WorkflowNode, WorkflowNodeType } from '@/types/messaging';
import type { Edge, Node } from '@xyflow/react';
import { Mail, MessageSquare, Bell, Diamond, Clock3, Split, Flag, Timer } from 'lucide-react';

export const triggerLabels: Record<string, string> = {
  ACCOUNT_CREATED: 'Account Created',
  ACCOUNT_VERIFIED: 'Account Verified',
  PASSWORD_RESET: 'Password Reset',
  TERMS_ACCEPTED: 'Terms Accepted',
  SHOOT_REQUESTED: 'Shoot Requested',
  SHOOT_REQUEST_APPROVED: 'Shoot Request Approved',
  SHOOT_BOOKED: 'Shoot Booked',
  SHOOT_SCHEDULED: 'Shoot Scheduled',
  SHOOT_UPDATED: 'Shoot Updated',
  SHOOT_REMINDER: 'Shoot Reminder',
  SHOOT_COMPLETED: 'Shoot Completed',
  SHOOT_CANCELED: 'Shoot Canceled',
  SHOOT_REMOVED: 'Shoot Removed',
  PAYMENT_COMPLETED: 'Payment Completed',
  PAYMENT_FAILED: 'Payment Failed',
  PAYMENT_REFUNDED: 'Payment Refunded',
  INVOICE_DUE: 'Invoice Due',
  INVOICE_OVERDUE: 'Invoice Overdue',
  INVOICE_SUMMARY: 'Invoice Summary',
  INVOICE_PAID: 'Invoice Paid',
  WEEKLY_PHOTOGRAPHER_INVOICE: 'Weekly Photographer Invoice',
  WEEKLY_REP_INVOICE: 'Weekly Rep Invoice',
  WEEKLY_SALES_REPORT: 'Weekly Sales Report',
  WEEKLY_AUTOMATED_INVOICING: 'Weekly Automated Invoicing',
  PHOTO_UPLOADED: 'Photo Uploaded',
  MEDIA_UPLOAD_COMPLETE: 'Media Upload Complete',
  PHOTOGRAPHER_ASSIGNED: 'Photographer Assigned',
  EDITING_COMPLETE: 'Editing Complete',
  PROPERTY_CONTACT_REMINDER: 'Property Contact Reminder',
};

export const triggerGroups = [
  {
    label: 'Account',
    triggers: ['ACCOUNT_CREATED', 'ACCOUNT_VERIFIED', 'PASSWORD_RESET', 'TERMS_ACCEPTED'],
  },
  {
    label: 'Shoot Lifecycle',
    triggers: ['SHOOT_REQUESTED', 'SHOOT_REQUEST_APPROVED', 'SHOOT_BOOKED', 'SHOOT_SCHEDULED', 'SHOOT_UPDATED', 'SHOOT_REMINDER', 'SHOOT_COMPLETED', 'SHOOT_CANCELED', 'SHOOT_REMOVED'],
  },
  {
    label: 'Payments & Invoices',
    triggers: ['PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED', 'INVOICE_DUE', 'INVOICE_OVERDUE', 'INVOICE_SUMMARY', 'INVOICE_PAID', 'WEEKLY_PHOTOGRAPHER_INVOICE', 'WEEKLY_REP_INVOICE'],
  },
  {
    label: 'System',
    triggers: ['WEEKLY_SALES_REPORT', 'WEEKLY_AUTOMATED_INVOICING'],
  },
  {
    label: 'Media & Operations',
    triggers: ['PHOTO_UPLOADED', 'MEDIA_UPLOAD_COMPLETE', 'PHOTOGRAPHER_ASSIGNED', 'EDITING_COMPLETE', 'PROPERTY_CONTACT_REMINDER'],
  },
];

export type SimpleAutomationActionType = 'email' | 'sms' | 'internal_notification' | 'system_command';
export type SimpleTimingMode = 'immediate' | 'offset';
export type SimpleOffsetDirection = 'before' | 'after';
export type SimpleOffsetUnit = 'm' | 'h' | 'd';
export type SimpleRecipientMode = 'automation_default' | 'roles' | 'context';
export type SimpleTriggerMode = 'event' | 'schedule';

export interface SimpleAutomationDraft {
  name: string;
  description: string;
  trigger_mode: SimpleTriggerMode;
  trigger_type: AutomationTriggerType;
  action_type: SimpleAutomationActionType;
  scope: AutomationRule['scope'];
  is_active: boolean;
  recipient_mode: SimpleRecipientMode;
  recipient_roles: string[];
  context_key: 'client' | 'photographer' | 'rep';
  template_id: string;
  channel_id: string;
  subject: string;
  body_text: string;
  title: string;
  destination_url: string;
  priority: 'normal' | 'high' | 'urgent';
  timing_mode: SimpleTimingMode;
  offset_direction: SimpleOffsetDirection;
  offset_value: string;
  offset_unit: SimpleOffsetUnit;
  use_condition: boolean;
  condition_match: 'all' | 'any';
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  schedule_day_of_week: string;
  schedule_time: string;
  system_command: string;
}

export const shootBasedTriggers = new Set<AutomationTriggerType>([
  'SHOOT_REQUESTED',
  'SHOOT_REQUEST_APPROVED',
  'SHOOT_BOOKED',
  'SHOOT_SCHEDULED',
  'SHOOT_UPDATED',
  'SHOOT_REMINDER',
  'SHOOT_COMPLETED',
  'PHOTOGRAPHER_ASSIGNED',
  'PROPERTY_CONTACT_REMINDER',
]);

const defaultSimpleDraft: SimpleAutomationDraft = {
  name: '',
  description: '',
  trigger_mode: 'event',
  trigger_type: 'SHOOT_BOOKED',
  action_type: 'email',
  scope: 'GLOBAL',
  is_active: true,
  recipient_mode: 'roles',
  recipient_roles: ['client'],
  context_key: 'client',
  template_id: '',
  channel_id: '',
  subject: '',
  body_text: '',
  title: '',
  destination_url: '/shoot-history',
  priority: 'normal',
  timing_mode: 'immediate',
  offset_direction: 'before',
  offset_value: '24',
  offset_unit: 'h',
  use_condition: false,
  condition_match: 'all',
  condition_field: '',
  condition_operator: 'eq',
  condition_value: '',
  schedule_day_of_week: '1',
  schedule_time: '01:00',
  system_command: '',
};

const getOutgoingEdges = (workflow: WorkflowDefinition, sourceId: string) =>
  workflow.edges.filter((edge) => edge.source === sourceId);

const getNodeById = (workflow: WorkflowDefinition, nodeId?: string | null) =>
  workflow.nodes.find((node) => node.id === nodeId);

const createConditionRule = (draft: SimpleAutomationDraft) => ({
  field: draft.condition_field.trim(),
  operator: draft.condition_operator,
  value: draft.condition_value.trim(),
});

export const formatLegacyOffset = (draft: Pick<SimpleAutomationDraft, 'offset_direction' | 'offset_value' | 'offset_unit'>) => {
  const amount = Number.parseInt(draft.offset_value, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return `${draft.offset_direction === 'before' ? '-' : '+'}${amount}${draft.offset_unit}`;
};

export const buildSimpleConditionJson = (draft: SimpleAutomationDraft) => {
  if (!draft.use_condition || !draft.condition_field.trim()) {
    return null;
  }

  const field = draft.condition_field.trim();
  const value = draft.condition_value.trim();

  if (draft.condition_operator === 'eq') {
    return {
      [field]: value,
    };
  }

  return {
    [field]: {
      [draft.condition_operator]: value,
    },
  };
};

export const buildSimpleWorkflowFromDraft = (draft: SimpleAutomationDraft): WorkflowDefinition => {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  const y = 180;

  const triggerNode: WorkflowNode = {
    id: 'trigger_start',
    type: draft.trigger_mode === 'schedule' ? 'trigger.schedule' : 'trigger.event',
    position: { x: 80, y },
    config:
      draft.trigger_mode === 'schedule'
        ? {
            triggerType: draft.trigger_type,
            schedule: {
              type: 'weekly',
              day_of_week: Number(draft.schedule_day_of_week || 1),
              time: draft.schedule_time || '01:00',
            },
            command: draft.system_command || undefined,
          }
        : { triggerType: draft.trigger_type },
  };
  nodes.push(triggerNode);

  const endNodeId = 'end_default';
  let nextX = 320;
  let branchSourceId: string | null = null;
  let currentNodeId = triggerNode.id;

  if (draft.use_condition && draft.condition_field.trim()) {
    const conditionNode: WorkflowNode = {
      id: 'condition_default',
      type: 'condition.if',
      position: { x: nextX, y },
      config: {
        match: draft.condition_match,
        rules: [createConditionRule(draft)],
      },
    };
    nodes.push(conditionNode);
    edges.push({
      id: `${currentNodeId}_${conditionNode.id}`,
      source: currentNodeId,
      target: conditionNode.id,
    });
    currentNodeId = conditionNode.id;
    branchSourceId = conditionNode.id;
    nextX += 260;
  }

  if (draft.timing_mode === 'offset') {
    const amount = Number.parseInt(draft.offset_value, 10);
    const waitNode: WorkflowNode = {
      id: 'wait_offset',
      type: 'wait.datetime_offset',
      position: { x: nextX, y },
      config: {
        referenceField: 'shoot_datetime',
        direction: draft.offset_direction,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 24,
        unit: draft.offset_unit === 'd' ? 'days' : draft.offset_unit === 'm' ? 'minutes' : 'hours',
      },
    };
    nodes.push(waitNode);
    edges.push({
      id: `${currentNodeId}_${waitNode.id}`,
      source: currentNodeId,
      target: waitNode.id,
      branchKey: branchSourceId === currentNodeId ? 'true' : undefined,
    });
    currentNodeId = waitNode.id;
    nextX += 260;
  }

  const actionTypeMap: Record<Exclude<SimpleAutomationActionType, 'system_command'>, WorkflowNodeType> = {
    email: 'action.email',
    sms: 'action.sms',
    internal_notification: 'action.internal_notification',
  };

  const actionConfig =
    draft.action_type === 'email'
      ? {
          templateId: draft.template_id ? Number(draft.template_id) : undefined,
          channelId: draft.channel_id ? Number(draft.channel_id) : undefined,
          recipientMode: draft.recipient_mode,
          recipientRoles: draft.recipient_roles,
          contextKey: draft.recipient_mode === 'context' ? draft.context_key : undefined,
          subject: draft.template_id ? undefined : draft.subject.trim(),
          bodyText: draft.template_id ? undefined : draft.body_text.trim(),
        }
      : draft.action_type === 'sms'
        ? {
            templateId: draft.template_id ? Number(draft.template_id) : undefined,
            recipientMode: draft.recipient_mode,
            recipientRoles: draft.recipient_roles,
            contextKey: draft.recipient_mode === 'context' ? draft.context_key : undefined,
            bodyText: draft.template_id ? undefined : draft.body_text.trim(),
          }
        : {
            recipientMode: draft.recipient_mode === 'context' ? 'roles' : draft.recipient_mode,
            recipientRoles: draft.recipient_mode === 'context' ? ['admin'] : draft.recipient_roles,
            title: draft.title.trim(),
            body: draft.body_text.trim(),
            destinationUrl: draft.destination_url.trim() || '/shoot-history',
            priority: draft.priority,
          };

  let actionNode: WorkflowNode | null = null;
  if (draft.action_type !== 'system_command') {
    actionNode = {
      id: 'action_primary',
      type: actionTypeMap[draft.action_type],
      position: { x: nextX, y },
      config: actionConfig,
    };
    nodes.push(actionNode);
    edges.push({
      id: `${currentNodeId}_${actionNode.id}`,
      source: currentNodeId,
      target: actionNode.id,
      branchKey: branchSourceId === currentNodeId ? 'true' : undefined,
    });
    nextX += 260;
  }

  const endNode: WorkflowNode = {
    id: endNodeId,
    type: 'end',
    position: { x: nextX, y },
    config: {},
  };
  nodes.push(endNode);

  if (actionNode) {
    edges.push({
      id: `${actionNode.id}_${endNode.id}`,
      source: actionNode.id,
      target: endNode.id,
    });
  } else {
    edges.push({
      id: `${currentNodeId}_${endNode.id}`,
      source: currentNodeId,
      target: endNode.id,
      branchKey: branchSourceId === currentNodeId ? 'true' : undefined,
    });
  }

  if (branchSourceId) {
    edges.push({
      id: `${branchSourceId}_${endNode.id}_false`,
      source: branchSourceId,
      target: endNode.id,
      branchKey: 'false',
    });
  }

  return {
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    meta: {
      generated_from_simple_form: true,
      summary: {
        trigger: draft.trigger_type,
        trigger_mode: draft.trigger_mode,
        action: draft.action_type,
        has_condition: draft.use_condition,
        has_wait: draft.timing_mode === 'offset',
      },
      ...(draft.action_type === 'system_command' && draft.system_command
        ? { system_command: draft.system_command }
        : {}),
    },
  };
};

export const extractSimpleAutomationDraft = (automation?: Partial<AutomationRule> | null): SimpleAutomationDraft | null => {
  if (!automation?.workflow_definition_json?.nodes?.length) {
    return automation
      ? {
          ...defaultSimpleDraft,
          name: automation.name ?? '',
          description: automation.description ?? '',
          trigger_mode: automation.schedule_json?.type === 'weekly' ? 'schedule' : 'event',
          trigger_type: automation.trigger_type ?? 'SHOOT_BOOKED',
          scope: automation.scope === 'SYSTEM' ? 'GLOBAL' : automation.scope ?? 'GLOBAL',
          is_active: automation.is_active ?? true,
          recipient_roles: Array.isArray(automation.recipients_json)
            ? automation.recipients_json
            : automation.recipients_json?.roles ?? ['client'],
          template_id: automation.template_id ? String(automation.template_id) : '',
          channel_id: automation.channel_id ? String(automation.channel_id) : '',
          schedule_day_of_week: String(automation.schedule_json?.day_of_week ?? 1),
          schedule_time: automation.schedule_json?.time ?? '01:00',
          system_command: automation.schedule_json?.command ?? '',
        }
      : null;
  }

  const workflow = automation.workflow_definition_json;
  const triggerNodes = workflow.nodes.filter((node) => String(node.type).startsWith('trigger.'));
  const conditionNodes = workflow.nodes.filter((node) => node.type === 'condition.if');
  const waitNodes = workflow.nodes.filter((node) => node.type === 'wait.datetime_offset' || node.type === 'wait.duration');
  const actionNodes = workflow.nodes.filter((node) => node.type.startsWith('action.'));
  const endNodes = workflow.nodes.filter((node) => node.type === 'end');
  const supportedTypes = new Set(['trigger.event', 'trigger.schedule', 'condition.if', 'wait.datetime_offset', 'wait.duration', 'action.email', 'action.sms', 'action.internal_notification', 'end']);

  if (
    triggerNodes.length !== 1 ||
    conditionNodes.length > 1 ||
    waitNodes.length > 1 ||
    actionNodes.length > 1 ||
    endNodes.length !== 1 ||
    workflow.nodes.some((node) => !supportedTypes.has(node.type))
  ) {
    return null;
  }

  const triggerNode = triggerNodes[0];
  if (triggerNode.type !== 'trigger.event' && triggerNode.type !== 'trigger.schedule') {
    return null;
  }

  const actionNode = actionNodes[0];
  const actionType =
    !actionNode
      ? 'system_command'
      : actionNode.type === 'action.sms'
      ? 'sms'
      : actionNode.type === 'action.internal_notification'
        ? 'internal_notification'
        : 'email';

  const conditionNode = conditionNodes[0];
  const conditionRule = conditionNode?.config?.rules?.[0];
  const waitNode = waitNodes[0];
  const outgoingConditionEdges = conditionNode ? getOutgoingEdges(workflow, conditionNode.id) : [];
  if (conditionNode) {
    const branchKeys = outgoingConditionEdges.map((edge) => edge.branchKey).filter(Boolean);
    if (!branchKeys.includes('true') || !branchKeys.includes('false')) {
      return null;
    }
  }

  const recipientMode = (actionNode?.config?.recipientMode as SimpleRecipientMode | undefined) ?? 'automation_default';
  const recipientRoles = Array.isArray(actionNode?.config?.recipientRoles)
    ? actionNode.config.recipientRoles.map(String)
    : Array.isArray(automation.recipients_json)
      ? automation.recipients_json
      : automation.recipients_json?.roles ?? (actionType === 'internal_notification' ? ['admin'] : ['client']);

  const draft: SimpleAutomationDraft = {
    ...defaultSimpleDraft,
    name: automation.name ?? '',
    description: automation.description ?? '',
    trigger_mode: triggerNode.type === 'trigger.schedule' ? 'schedule' : 'event',
    trigger_type: (triggerNode.config?.triggerType || automation.trigger_type || 'SHOOT_BOOKED') as AutomationTriggerType,
    action_type: actionType,
    scope: automation.scope === 'SYSTEM' ? 'GLOBAL' : automation.scope ?? 'GLOBAL',
    is_active: automation.is_active ?? true,
    recipient_mode: recipientMode,
    recipient_roles: recipientRoles,
    context_key: (actionNode?.config?.contextKey || 'client') as 'client' | 'photographer' | 'rep',
    template_id: actionNode?.config?.templateId ? String(actionNode.config.templateId) : automation.template_id ? String(automation.template_id) : '',
    channel_id: actionNode?.config?.channelId ? String(actionNode.config.channelId) : automation.channel_id ? String(automation.channel_id) : '',
    subject: actionNode?.config?.subject ?? '',
    body_text: actionNode?.config?.bodyText ?? actionNode?.config?.body ?? '',
    title: actionNode?.config?.title ?? '',
    destination_url: actionNode?.config?.destinationUrl ?? '/shoot-history',
    priority: (actionNode?.config?.priority as 'normal' | 'high' | 'urgent') ?? 'normal',
    timing_mode: 'immediate',
    offset_direction: 'before',
    offset_value: '24',
    offset_unit: 'h',
    use_condition: Boolean(conditionNode && conditionRule),
    condition_match: (conditionNode?.config?.match as 'all' | 'any') ?? 'all',
    condition_field: conditionRule?.field ?? '',
    condition_operator: conditionRule?.operator ?? 'eq',
    condition_value: conditionRule?.value != null ? String(conditionRule.value) : '',
    schedule_day_of_week: String(triggerNode.config?.schedule?.day_of_week ?? automation.schedule_json?.day_of_week ?? 1),
    schedule_time: triggerNode.config?.schedule?.time ?? automation.schedule_json?.time ?? '01:00',
    system_command: triggerNode.config?.command ?? workflow.meta?.system_command ?? automation.schedule_json?.command ?? '',
  };

  if (waitNode) {
    draft.timing_mode = 'offset';
    if (waitNode.type === 'wait.datetime_offset') {
      draft.offset_direction = waitNode.config?.direction === 'after' ? 'after' : 'before';
      draft.offset_value = String(waitNode.config?.amount ?? 24);
      draft.offset_unit = waitNode.config?.unit === 'days' ? 'd' : waitNode.config?.unit === 'minutes' ? 'm' : 'h';
    } else {
      draft.offset_direction = 'after';
      draft.offset_value = String(waitNode.config?.amount ?? 30);
      draft.offset_unit = waitNode.config?.unit === 'days' ? 'd' : waitNode.config?.unit === 'hours' ? 'h' : 'm';
    }
  }

  return draft;
};

const nodeMeta: Record<WorkflowNodeType, { label: string; accent: string; icon: any }> = {
  'trigger.event': { label: 'Event Trigger', accent: 'from-blue-600 to-cyan-500', icon: Flag },
  'trigger.schedule': { label: 'Schedule Trigger', accent: 'from-violet-600 to-fuchsia-500', icon: Clock3 },
  'condition.if': { label: 'Condition', accent: 'from-amber-500 to-orange-500', icon: Split },
  'wait.duration': { label: 'Wait Duration', accent: 'from-slate-600 to-slate-400', icon: Timer },
  'wait.datetime_offset': { label: 'Wait to Date Offset', accent: 'from-indigo-600 to-blue-500', icon: Clock3 },
  'action.email': { label: 'Send Email', accent: 'from-emerald-600 to-green-500', icon: Mail },
  'action.sms': { label: 'Send SMS', accent: 'from-emerald-500 to-teal-500', icon: MessageSquare },
  'action.internal_notification': { label: 'Internal Notification', accent: 'from-rose-500 to-pink-500', icon: Bell },
  end: { label: 'End', accent: 'from-zinc-700 to-zinc-500', icon: Diamond },
};

export const nodeTypesPalette: Array<{ type: WorkflowNodeType; label: string }> = [
  { type: 'condition.if', label: 'Condition' },
  { type: 'wait.duration', label: 'Wait Duration' },
  { type: 'wait.datetime_offset', label: 'Wait to Date Offset' },
  { type: 'action.email', label: 'Send Email' },
  { type: 'action.sms', label: 'Send SMS' },
  { type: 'action.internal_notification', label: 'Internal Notification' },
  { type: 'end', label: 'End' },
];

export const createEmptyWorkflow = (triggerType: AutomationTriggerType = 'SHOOT_BOOKED'): WorkflowDefinition => ({
  nodes: [
    {
      id: 'trigger_start',
      type: 'trigger.event',
      position: { x: 80, y: 180 },
      config: { triggerType },
    },
    {
      id: 'action_email',
      type: 'action.email',
      position: { x: 360, y: 180 },
      config: {
        recipientMode: 'automation_default',
        recipientRoles: ['client'],
      },
    },
    {
      id: 'end_default',
      type: 'end',
      position: { x: 640, y: 180 },
      config: {},
    },
  ],
  edges: [
    { id: 'trigger_start_action_email', source: 'trigger_start', target: 'action_email' },
    { id: 'action_email_end_default', source: 'action_email', target: 'end_default' },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
  meta: {},
});

export const getNodePresentation = (node: WorkflowNode, automation?: Partial<AutomationRule>) => {
  const meta = nodeMeta[node.type];
  let subtitle = '';

  switch (node.type) {
    case 'trigger.event':
      subtitle = triggerLabels[node.config?.triggerType as string] || 'Select trigger';
      break;
    case 'trigger.schedule':
      subtitle = `${node.config?.schedule?.type || 'weekly'} ${node.config?.schedule?.time || ''}`.trim();
      break;
    case 'condition.if':
      subtitle = `${node.config?.rules?.length || 0} rule${node.config?.rules?.length === 1 ? '' : 's'}`;
      break;
    case 'wait.duration':
      subtitle = `${node.config?.amount || 0} ${node.config?.unit || 'minutes'}`;
      break;
    case 'wait.datetime_offset':
      subtitle = `${node.config?.direction || 'before'} ${node.config?.amount || 0} ${node.config?.unit || 'hours'}`;
      break;
    case 'action.email':
      subtitle = node.config?.templateId ? `Template #${node.config.templateId}` : 'Inline or template email';
      break;
    case 'action.sms':
      subtitle = node.config?.templateId ? `Template #${node.config.templateId}` : 'Inline SMS';
      break;
    case 'action.internal_notification':
      subtitle = node.config?.title || 'Team inbox item';
      break;
    case 'end':
      subtitle = automation?.is_system_locked ? 'Protected flow' : 'Stop workflow';
      break;
  }

  return {
    ...meta,
    subtitle,
  };
};

export const workflowToFlow = (workflow: WorkflowDefinition, automation?: Partial<AutomationRule>) => {
  const nodes: Node[] = workflow.nodes.map((node) => ({
    id: node.id,
    type: 'automationNode',
    position: node.position,
    data: {
      ...getNodePresentation(node, automation),
      rawNode: node,
      locked: Boolean(automation?.is_system_locked),
      validationErrors: automation?.validation_state?.node_errors?.[node.id] ?? [],
    },
  }));

  const edges: Edge[] = workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.branchKey || undefined,
    label: edge.branchKey ? edge.branchKey.toUpperCase() : undefined,
    animated: Boolean(edge.branchKey),
    style: edge.branchKey ? { strokeDasharray: '5 5' } : undefined,
  }));

  return { nodes, edges };
};

export const flowToWorkflow = (nodes: Node[], edges: Edge[], previous?: WorkflowDefinition): WorkflowDefinition => ({
  nodes: nodes.map((node) => ({
    id: node.id,
    type: (node.data?.rawNode?.type || 'end') as WorkflowNodeType,
    position: node.position,
    config: node.data?.rawNode?.config || {},
    validation: node.data?.rawNode?.validation || [],
  })),
  edges: edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    branchKey: edge.sourceHandle || undefined,
  })),
  viewport: previous?.viewport ?? { x: 0, y: 0, zoom: 1 },
  meta: previous?.meta ?? {},
});

export const createNodeDefinition = (type: WorkflowNodeType, index: number): WorkflowNode => {
  const id = `${type.replace(/\./g, '_')}_${Date.now()}_${index}`;

  const config: Record<string, any> = {
    'trigger.event': { triggerType: 'SHOOT_BOOKED' },
    'trigger.schedule': { triggerType: 'WEEKLY_AUTOMATED_INVOICING', schedule: { type: 'weekly', day_of_week: 1, time: '01:00' } },
    'condition.if': { match: 'all', rules: [{ field: 'status', operator: 'eq', value: 'scheduled' }] },
    'wait.duration': { amount: 30, unit: 'minutes' },
    'wait.datetime_offset': { referenceField: 'shoot_datetime', direction: 'before', amount: 24, unit: 'hours' },
    'action.email': { recipientMode: 'automation_default', recipientRoles: ['client'] },
    'action.sms': { recipientMode: 'automation_default', recipientRoles: ['client'] },
    'action.internal_notification': { recipientMode: 'roles', recipientRoles: ['admin'], title: 'Review workflow event', body: 'Check {{shoot_address}}', destinationUrl: '/shoot-history' },
    end: {},
  }[type] ?? {};

  return {
    id,
    type,
    position: { x: 280 + index * 60, y: 120 + index * 40 },
    config,
  };
};

export const ensureWorkflowMetadata = (workflow?: WorkflowDefinition, triggerType: AutomationTriggerType = 'SHOOT_BOOKED'): WorkflowDefinition => {
  if (!workflow || !workflow.nodes?.length) {
    return createEmptyWorkflow(triggerType);
  }

  return {
    ...workflow,
    viewport: workflow.viewport ?? { x: 0, y: 0, zoom: 1 },
    meta: workflow.meta ?? {},
  };
};
