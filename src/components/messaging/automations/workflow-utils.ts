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
