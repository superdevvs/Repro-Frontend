import { Bell, Clock3, Mail, MessageSquare } from 'lucide-react';

import type { AutomationRule } from '@/types/messaging';
import {
  extractSimpleAutomationDraft,
  triggerLabels,
  type SimpleAutomationActionType,
  type SimpleAutomationDraft,
  type SimpleTriggerMode,
} from '@/components/messaging/automations/workflow-utils';
interface AutomationEditorDialogProps {
  automation: AutomationRule | null;
  mode: 'create' | 'duplicate' | 'edit';
  open: boolean;
  onClose: () => void;
  onSuccess: (automation: AutomationRule) => void;
}

const actionOptions: Array<{ value: SimpleAutomationActionType; label: string; description: string; icon: typeof Mail }> = [
  { value: 'email', label: 'Email', description: 'Send a branded email using a template or inline copy.', icon: Mail },
  { value: 'sms', label: 'SMS', description: 'Send a short text reminder or update.', icon: MessageSquare },
  { value: 'internal_notification', label: 'Internal notification', description: 'Create an internal inbox item for the team.', icon: Bell },
  { value: 'system_command', label: 'System command', description: 'Run a scheduled internal automation command.', icon: Clock3 },
];

const recipientRoleOptions: Array<{ value: AutomationRecipientRole; label: string }> = [
  { value: 'client', label: 'Client' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'admin', label: 'Admin team' },
  { value: 'rep', label: 'Sales rep' },
];

const weekdayOptions = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const contextRecipientOptions = [
  { value: 'client', label: 'Client from trigger' },
  { value: 'photographer', label: 'Photographer from trigger' },
  { value: 'rep', label: 'Rep from trigger' },
] as const;

type AutomationRecipientRole = 'client' | 'photographer' | 'admin' | 'rep';

const automationRecipientRoles: AutomationRecipientRole[] = ['client', 'photographer', 'admin', 'rep'];

const isAutomationRecipientRole = (value: string): value is AutomationRecipientRole => {
  return automationRecipientRoles.includes(value as AutomationRecipientRole);
};

const getAutomationEditorErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const response = 'response' in error
      ? (error as { response?: { data?: { message?: unknown } } }).response
      : undefined;
    const responseMessage = response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage) {
      return responseMessage;
    }

    const message = 'message' in error ? (error as { message?: unknown }).message : undefined;
    if (typeof message === 'string' && message) {
      return message;
    }
  }

  return fallback;
};

const createDefaultDraft = (): SimpleAutomationDraft => ({
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
});

const getFlowSteps = (draft: SimpleAutomationDraft) => {
  const steps = [triggerLabels[draft.trigger_type] || draft.trigger_type];
  if (draft.use_condition && draft.condition_field.trim()) {
    steps.push('Condition');
  }
  if (draft.timing_mode === 'offset') {
    steps.push('Wait');
  }
  steps.push(
    draft.action_type === 'system_command'
      ? 'Run Command'
      : draft.action_type === 'email'
      ? 'Send Email'
      : draft.action_type === 'sms'
        ? 'Send SMS'
        : 'Internal Alert',
  );
  steps.push('End');

  return steps;
};

const getInitialDraft = (automation: AutomationRule | null) => {
  const extracted = extractSimpleAutomationDraft(automation);
  if (extracted) {
    return extracted;
  }

  const base = createDefaultDraft();
  if (!automation) {
    return base;
  }

  return {
    ...base,
    name: automation.name,
    description: automation.description || '',
    trigger_mode: (automation.schedule_json?.type === 'weekly' ? 'schedule' : 'event') as SimpleTriggerMode,
    trigger_type: automation.trigger_type,
    template_id: automation.template_id ? String(automation.template_id) : '',
    channel_id: automation.channel_id ? String(automation.channel_id) : '',
    recipient_roles: Array.isArray(automation.recipients_json)
      ? automation.recipients_json
      : automation.recipients_json?.roles || ['client'],
    is_active: automation.is_active,
    scope: automation.scope === 'SYSTEM' ? 'GLOBAL' : automation.scope,
    schedule_day_of_week: String(automation.schedule_json?.day_of_week ?? 1),
    schedule_time: automation.schedule_json?.time ?? '01:00',
    system_command: automation.schedule_json?.command ?? '',
  };
};
export type { AutomationEditorDialogProps, AutomationRecipientRole };
export {
  actionOptions,
  contextRecipientOptions,
  createDefaultDraft,
  getAutomationEditorErrorMessage,
  getFlowSteps,
  getInitialDraft,
  isAutomationRecipientRole,
  recipientRoleOptions,
  weekdayOptions,
};

