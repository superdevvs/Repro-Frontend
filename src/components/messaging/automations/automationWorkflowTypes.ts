import type { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';
import type { AutomationRecipientRole, AutomationTriggerType, MessagingJsonObject, WorkflowNode } from '@/types/messaging';

export type { AutomationRecipientRole };
export type AutomationRecipientMode = 'automation_default' | 'roles' | 'context';
export type AutomationContextKey = 'client' | 'photographer' | 'rep';
export type AutomationConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists' | 'in';
export type AutomationConditionMatch = 'all' | 'any';
export type AutomationWaitUnit = 'minutes' | 'hours' | 'days';
export type AutomationPriority = 'normal' | 'high' | 'urgent';

export type AutomationConditionRule = MessagingJsonObject & {
  field: string;
  operator: AutomationConditionOperator;
  value: string | number | null;
}

export interface AutomationScheduleConfig {
  type: string;
  day_of_week: number;
  time: string;
  offset?: string;
  cron?: string;
  command?: string;
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

export const AUTOMATION_RECIPIENT_ROLES: AutomationRecipientRole[] = ['client', 'photographer', 'admin', 'rep'];
export const AUTOMATION_CONTEXT_KEYS: AutomationContextKey[] = ['client', 'photographer', 'rep'];
export const SCHEDULE_TRIGGER_TYPES: AutomationTriggerType[] = ['WEEKLY_AUTOMATED_INVOICING', 'WEEKLY_SALES_REPORT'];
