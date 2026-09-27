import type { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';
import type { AutomationRecipientRole, AutomationTriggerType, MessagingJsonObject, MessagingJsonValue, WorkflowNode } from '@/types/messaging';

export type { AutomationRecipientRole };
export type AutomationRecipientMode = 'automation_default' | 'roles' | 'context';
export type AutomationContextKey = 'account' | 'client' | 'photographer' | 'rep' | 'editor' | 'accounting';
export type AutomationConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists' | 'in';
export type AutomationConditionMatch = 'all' | 'any';
export type AutomationWaitUnit = 'minutes' | 'hours' | 'days';
export type AutomationPriority = 'normal' | 'high' | 'urgent';

export type AutomationConditionRule = MessagingJsonObject & {
  field: string;
  operator: AutomationConditionOperator;
  value: MessagingJsonValue;
}

export interface AutomationScheduleConfig {
  type: string;
  day_of_week: number;
  time: string;
  offset?: string;
  cron?: string;
  command?: string;
  accounting_email?: string;
}

export type AutomationFlowNodeData = Record<string, unknown> & {
  label: string;
  subtitle: string;
  accent: string;
  icon: LucideIcon;
  rawNode: WorkflowNode;
  locked: boolean;
  validationErrors: string[];
}

export type AutomationFlowNode = FlowNode<AutomationFlowNodeData, 'automationNode'>;
export type AutomationFlowEdge = FlowEdge;

export const AUTOMATION_RECIPIENT_ROLES: AutomationRecipientRole[] = ['account', 'client', 'photographer', 'previous_photographer', 'new_photographer', 'admin', 'rep', 'editor', 'accounting'];
export const AUTOMATION_CONTEXT_KEYS: AutomationContextKey[] = ['account', 'client', 'photographer', 'rep', 'editor', 'accounting'];
export const SCHEDULE_TRIGGER_TYPES: AutomationTriggerType[] = ['WEEKLY_AUTOMATED_INVOICING', 'WEEKLY_SALES_REPORT', 'INVOICE_SUMMARY', 'WEEKLY_REP_INVOICE', 'WEEKLY_PAYOUT_REPORT', 'WEEKLY_PAYOUT_DIGEST'];
