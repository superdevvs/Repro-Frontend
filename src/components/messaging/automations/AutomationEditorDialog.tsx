import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Bell, Clock3, Mail, MessageSquare, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { createAutomation, getEmailSettings, getTemplates, updateAutomation } from '@/services/messaging';
import type { AutomationRule } from '@/types/messaging';
import {
  buildSimpleConditionJson,
  buildSimpleWorkflowFromDraft,
  extractSimpleAutomationDraft,
  formatLegacyOffset,
  shootBasedTriggers,
  triggerGroups,
  triggerLabels,
  type SimpleAutomationActionType,
  type SimpleAutomationDraft,
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

const recipientRoleOptions = [
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
    trigger_mode: automation.schedule_json?.type === 'weekly' ? 'schedule' : 'event',
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

export function AutomationEditorDialog({ automation, mode, open, onClose, onSuccess }: AutomationEditorDialogProps) {
  const [draft, setDraft] = useState<SimpleAutomationDraft>(createDefaultDraft());
  const isEditMode = mode === 'edit';
  const canExtractSimpleDraft = useMemo(() => Boolean(extractSimpleAutomationDraft(automation)), [automation]);
  const isScheduleWorkflow = draft.trigger_mode === 'schedule';
  const isSystemCommandWorkflow = draft.action_type === 'system_command';
  const lockStructure = Boolean(automation?.is_system_locked);
  const willSimplifyAdvancedWorkflow = isEditMode && Boolean(automation) && !canExtractSimpleDraft;

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(getInitialDraft(automation));
  }, [automation, open]);

  const { data: templates = [] } = useQuery({
    queryKey: ['automation-simple-templates'],
    queryFn: () => getTemplates({ is_active: true }),
  });

  const { data: settingsData } = useQuery({
    queryKey: ['automation-simple-email-settings'],
    queryFn: getEmailSettings,
  });

  const emailChannels = settingsData?.channels || [];
  const filteredTemplates = useMemo(
    () =>
      templates.filter((template) =>
        draft.action_type === 'sms' ? template.channel === 'SMS' : template.channel === 'EMAIL',
      ),
    [draft.action_type, templates],
  );

  const selectedTemplate = filteredTemplates.find((template) => String(template.id) === draft.template_id);
  const flowSteps = getFlowSteps(draft);

  useEffect(() => {
    setDraft((current) => {
      if (current.action_type === 'system_command') {
        return {
          ...current,
          trigger_mode: 'schedule',
          template_id: '',
          channel_id: '',
          recipient_mode: 'roles',
          recipient_roles: [],
          timing_mode: 'immediate',
        };
      }

      if (current.action_type === 'internal_notification') {
        return {
          ...current,
          template_id: '',
          channel_id: '',
          recipient_mode: 'roles',
          recipient_roles: current.recipient_roles.length ? current.recipient_roles : ['admin'],
        };
      }

      if (current.action_type === 'sms' && current.channel_id) {
        return {
          ...current,
          channel_id: '',
        };
      }

      return current;
    });
  }, [draft.action_type]);

  useEffect(() => {
    if (draft.timing_mode === 'offset' && !shootBasedTriggers.has(draft.trigger_type)) {
      setDraft((current) => ({
        ...current,
        timing_mode: 'immediate',
      }));
    }
  }, [draft.trigger_type, draft.timing_mode]);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<AutomationRule>) => {
      if (mode === 'edit' && automation) {
        return updateAutomation(automation.id, payload);
      }

      return createAutomation(payload);
    },
    onSuccess: (savedAutomation) => {
      toast.success(
        mode === 'edit'
          ? 'Automation updated'
          : mode === 'duplicate'
            ? 'Automation duplicated'
            : 'Automation created',
      );
      onSuccess(savedAutomation);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to save automation');
    },
  });

  const toggleRecipient = (role: string) => {
    setDraft((current) => {
      const roles = current.recipient_roles.includes(role)
        ? current.recipient_roles.filter((item) => item !== role)
        : [...current.recipient_roles, role];

      return {
        ...current,
        recipient_roles: roles,
      };
    });
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      toast.error('Add an automation name');
      return;
    }

    if (draft.action_type !== 'system_command' && draft.recipient_mode === 'roles' && draft.recipient_roles.length === 0) {
      toast.error('Choose at least one recipient');
      return;
    }

    if (draft.action_type === 'email' && !draft.template_id && (!draft.subject.trim() || !draft.body_text.trim())) {
      toast.error('Email actions need a template or inline subject and message');
      return;
    }

    if (draft.action_type === 'sms' && !draft.template_id && !draft.body_text.trim()) {
      toast.error('SMS actions need a template or message body');
      return;
    }

    if (
      draft.action_type === 'internal_notification' &&
      (!draft.title.trim() || !draft.body_text.trim() || !draft.destination_url.trim())
    ) {
      toast.error('Internal notifications need a title, message, and destination link');
      return;
    }

    if (draft.trigger_mode === 'schedule' && !draft.schedule_time.trim()) {
      toast.error('Choose a schedule time');
      return;
    }

    if (draft.timing_mode === 'offset') {
      const offsetValue = Number.parseInt(draft.offset_value, 10);
      if (!Number.isFinite(offsetValue) || offsetValue <= 0) {
        toast.error('Enter a valid delay');
        return;
      }
    }

    if (draft.use_condition && !draft.condition_field.trim()) {
      toast.error('Add a field for the condition');
      return;
    }

    if (draft.use_condition && draft.condition_operator !== 'exists' && !draft.condition_value.trim()) {
      toast.error('Add a comparison value for the condition');
      return;
    }

    const workflow = buildSimpleWorkflowFromDraft(draft);
    const scheduleOffset = draft.timing_mode === 'offset' ? formatLegacyOffset(draft) : null;
    const selectedRoles =
      draft.recipient_mode === 'roles'
        ? draft.recipient_roles
        : draft.recipient_mode === 'context'
          ? [draft.context_key]
          : draft.recipient_roles;

    const scheduleJson =
      draft.trigger_mode === 'schedule'
        ? {
            type: 'weekly',
            day_of_week: Number(draft.schedule_day_of_week || 1),
            time: draft.schedule_time || '01:00',
            ...(draft.system_command ? { command: draft.system_command } : {}),
          }
        : scheduleOffset
          ? { offset: scheduleOffset }
          : null;

    const payload: Partial<AutomationRule> = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      trigger_type: draft.trigger_type,
      editor_mode: 'simple',
      engine_version: 2,
      is_active: draft.is_active,
      scope: draft.trigger_mode === 'schedule' && automation?.scope === 'SYSTEM' ? 'SYSTEM' : draft.scope,
      template_id:
        draft.action_type === 'internal_notification' || draft.action_type === 'system_command' || !draft.template_id
          ? null
          : Number(draft.template_id),
      channel_id:
        draft.action_type !== 'email' || !draft.channel_id
          ? null
          : Number(draft.channel_id),
      recipients_json: selectedRoles as any,
      condition_json: buildSimpleConditionJson(draft) ?? null,
      schedule_json: scheduleJson,
      workflow_definition_json: workflow,
      entry_trigger_json: {
        trigger_type: draft.trigger_type,
        node_id: 'trigger_start',
        node_type: draft.trigger_mode === 'schedule' ? 'trigger.schedule' : 'trigger.event',
        config:
          draft.trigger_mode === 'schedule'
            ? {
                triggerType: draft.trigger_type,
                schedule: {
                  type: 'weekly',
                  day_of_week: Number(draft.schedule_day_of_week || 1),
                  time: draft.schedule_time || '01:00',
                },
                ...(draft.system_command ? { command: draft.system_command } : {}),
              }
            : { triggerType: draft.trigger_type },
      },
      is_system_locked: automation?.is_system_locked ?? false,
    };

    saveMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex h-[min(92vh,920px)] w-[min(96vw,1200px)] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>
            {isEditMode ? 'Edit Automation' : automation ? 'Duplicate Automation' : 'Create Automation'}
          </DialogTitle>
          <DialogDescription>
            Start with a quick form for the common case. We&apos;ll build the workflow for you, then open the advanced editor so you can fine-tune it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <div className="rounded-3xl border bg-gradient-to-br from-muted/40 to-background p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Generated workflow preview
            </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {flowSteps.map((step, index) => (
                  <div key={`${step}-${index}`} className="flex items-center gap-2">
                    <span className="rounded-full border bg-background px-3 py-1 font-medium text-foreground shadow-sm">{step}</span>
                  {index < flowSteps.length - 1 && <ArrowRight className="h-4 w-4" />}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                This quick builder creates a clean one-action workflow first. You can branch it out in the editor right after saving.
              </p>
            </div>

            {willSimplifyAdvancedWorkflow && (
              <div className="rounded-3xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                This automation was built in advanced mode. Saving here will convert it into the normal single-action workflow format.
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)]">
              <div className="space-y-5">
                <div className="rounded-3xl border p-5">
                <div className="mb-4">
                  <h3 className="font-semibold">Automation Basics</h3>
                  <p className="text-sm text-muted-foreground">Define what starts the automation and how it should be labeled.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={draft.name}
                      onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Property access follow-up"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={draft.description}
                      onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Explain what this automation should do."
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Automation type</Label>
                      <Select
                        value={draft.trigger_mode}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            trigger_mode: value as SimpleAutomationDraft['trigger_mode'],
                            timing_mode: value === 'schedule' ? 'immediate' : current.timing_mode,
                          }))
                        }
                        disabled={lockStructure}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="event">Event-based</SelectItem>
                          <SelectItem value="schedule">Scheduled weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Trigger</Label>
                      <Select
                        value={draft.trigger_type}
                        onValueChange={(value) => setDraft((current) => ({ ...current, trigger_type: value as AutomationRule['trigger_type'] }))}
                        disabled={lockStructure}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {triggerGroups.map((group) => (
                            <SelectGroup key={group.label}>
                              <SelectLabel>{group.label}</SelectLabel>
                              {group.triggers.map((trigger) => (
                                <SelectItem key={trigger} value={trigger}>
                                  {triggerLabels[trigger] || trigger}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Scope</Label>
                      <Select
                        value={draft.scope}
                        onValueChange={(value) => setDraft((current) => ({ ...current, scope: value as AutomationRule['scope'] }))}
                        disabled={lockStructure || draft.trigger_mode === 'schedule'}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GLOBAL">Global</SelectItem>
                          <SelectItem value="ACCOUNT">Account</SelectItem>
                          <SelectItem value="USER">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {isScheduleWorkflow && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Runs every</Label>
                        <Select
                          value={draft.schedule_day_of_week}
                          onValueChange={(value) => setDraft((current) => ({ ...current, schedule_day_of_week: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {weekdayOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Run time</Label>
                        <Input
                          type="time"
                          value={draft.schedule_time}
                          onChange={(event) => setDraft((current) => ({ ...current, schedule_time: event.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between rounded-2xl border p-4">
                    <div>
                      <div className="font-medium">Active on save</div>
                      <div className="text-sm text-muted-foreground">You can toggle it off later from the workflow view.</div>
                    </div>
                    <Switch
                      checked={draft.is_active}
                      onCheckedChange={(checked) => setDraft((current) => ({ ...current, is_active: checked }))}
                    />
                  </div>
                </div>
              </div>

                <div className="rounded-3xl border p-5">
                <div className="mb-4">
                  <h3 className="font-semibold">Action</h3>
                  <p className="text-sm text-muted-foreground">Choose the channel and message source for this automation.</p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {actionOptions
                    .filter((option) => option.value !== 'system_command' || isScheduleWorkflow || isSystemCommandWorkflow)
                    .map((option) => {
                    const Icon = option.icon;
                    const isActive = draft.action_type === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`rounded-2xl border p-4 text-left transition ${isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                        disabled={lockStructure}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            action_type: option.value,
                            trigger_mode: option.value === 'system_command' ? 'schedule' : current.trigger_mode,
                            template_id: '',
                            channel_id: option.value === 'email' ? current.channel_id : '',
                            recipient_mode: option.value === 'internal_notification' ? 'roles' : current.recipient_mode,
                            recipient_roles:
                              option.value === 'internal_notification' && current.recipient_roles.length === 0
                                ? ['admin']
                                : current.recipient_roles,
                          }))
                        }
                      >
                        <Icon className="h-5 w-5 text-primary" />
                        <div className="mt-3 font-medium">{option.label}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 space-y-4">
                  {isSystemCommandWorkflow && (
                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <div className="font-medium">System command workflow</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        This automation is executed by the system runner on a weekly schedule.
                      </div>
                      <div className="mt-3 rounded-xl border bg-background px-3 py-2 text-sm">
                        {draft.system_command || 'No command configured'}
                      </div>
                    </div>
                  )}

                  {draft.action_type !== 'internal_notification' && (
                    <div>
                      <Label>{draft.action_type === 'sms' ? 'SMS Template' : 'Email Template'}</Label>
                      <Select
                        value={draft.template_id || 'inline'}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            template_id: value === 'inline' ? '' : value,
                          }))
                        }
                        disabled={isSystemCommandWorkflow}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inline">Write inline copy</SelectItem>
                          {filteredTemplates.map((template) => (
                            <SelectItem key={template.id} value={String(template.id)}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTemplate && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Using template: <span className="font-medium text-foreground">{selectedTemplate.name}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {draft.action_type === 'email' && (
                    <div>
                      <Label>Email Channel</Label>
                      <Select
                        value={draft.channel_id || 'default'}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            channel_id: value === 'default' ? '' : value,
                          }))
                        }
                        disabled={isSystemCommandWorkflow}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Use default sending channel</SelectItem>
                          {emailChannels.map((channel: any) => (
                            <SelectItem key={channel.id} value={String(channel.id)}>
                              {channel.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!draft.template_id && draft.action_type === 'email' && (
                    <>
                      <div>
                        <Label>Email Subject</Label>
                        <Input
                          value={draft.subject}
                          onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                          placeholder="Your shoot has been confirmed"
                        />
                      </div>
                      <div>
                        <Label>Email Copy</Label>
                        <Textarea
                          value={draft.body_text}
                          onChange={(event) => setDraft((current) => ({ ...current, body_text: event.target.value }))}
                          placeholder="Hi {{client.name}}, here is your update..."
                          rows={4}
                        />
                      </div>
                    </>
                  )}

                  {!draft.template_id && draft.action_type === 'sms' && (
                    <div>
                      <Label>SMS Copy</Label>
                      <Textarea
                        value={draft.body_text}
                        onChange={(event) => setDraft((current) => ({ ...current, body_text: event.target.value }))}
                        placeholder="Hi {{client.name}}, please send over the lockbox details."
                        rows={4}
                      />
                    </div>
                  )}

                  {draft.action_type === 'internal_notification' && (
                    <>
                      <div>
                        <Label>Notification Title</Label>
                        <Input
                          value={draft.title}
                          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                          placeholder="Review missing access details"
                        />
                      </div>
                      <div>
                        <Label>Notification Body</Label>
                        <Textarea
                          value={draft.body_text}
                          onChange={(event) => setDraft((current) => ({ ...current, body_text: event.target.value }))}
                          placeholder="Property contact details are still missing for {{shoot_address}}."
                          rows={4}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label>Destination Link</Label>
                          <Input
                            value={draft.destination_url}
                            onChange={(event) => setDraft((current) => ({ ...current, destination_url: event.target.value }))}
                            placeholder="/shoot-history"
                          />
                        </div>
                        <div>
                          <Label>Priority</Label>
                          <Select
                            value={draft.priority}
                            onValueChange={(value) => setDraft((current) => ({ ...current, priority: value as SimpleAutomationDraft['priority'] }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

              <div className="space-y-5">
                <div className="rounded-3xl border p-5">
                <div className="mb-4">
                  <h3 className="font-semibold">Recipients</h3>
                  <p className="text-sm text-muted-foreground">Choose who should receive the generated action.</p>
                </div>

                {isSystemCommandWorkflow ? (
                  <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    System command automations run internally and do not send to recipients directly.
                  </div>
                ) : (
                  <>
                {draft.action_type !== 'internal_notification' && (
                  <div className="space-y-3">
                    <Label>Recipient source</Label>
                    <Select
                      value={draft.recipient_mode}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          recipient_mode: value as SimpleAutomationDraft['recipient_mode'],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="roles">Choose recipients here</SelectItem>
                        <SelectItem value="automation_default">Use automation default recipients</SelectItem>
                        <SelectItem value="context">Use one contact from the trigger</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {draft.recipient_mode === 'context' && draft.action_type !== 'internal_notification' ? (
                  <div className="mt-4">
                    <Label>Context recipient</Label>
                    <Select
                      value={draft.context_key}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          context_key: value as SimpleAutomationDraft['context_key'],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {contextRecipientOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    {recipientRoleOptions.map((role) => (
                      <label key={role.value} className="flex items-center gap-3 rounded-2xl border p-3">
                        <Checkbox
                          checked={draft.recipient_roles.includes(role.value)}
                          onCheckedChange={() => toggleRecipient(role.value)}
                        />
                        <span className="text-sm font-medium">{role.label}</span>
                      </label>
                    ))}
                  </div>
                )}
                  </>
                )}
              </div>

                <div className="rounded-3xl border p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">Timing & Filter</h3>
                    <p className="text-sm text-muted-foreground">Optionally wait from shoot time or add one quick rule.</p>
                  </div>
                  <Clock3 className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="space-y-4">
                  {!isScheduleWorkflow && (
                  <div>
                    <Label>Send timing</Label>
                    <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                      <button
                        type="button"
                        className={`rounded-2xl border p-3 text-left transition ${draft.timing_mode === 'immediate' ? 'border-primary bg-primary/5' : 'border-border'}`}
                        onClick={() => setDraft((current) => ({ ...current, timing_mode: 'immediate' }))}
                      >
                        <div className="font-medium">Immediately on trigger</div>
                        <div className="text-xs text-muted-foreground">Best for confirmations and instant alerts.</div>
                      </button>
                      <button
                        type="button"
                        className={`rounded-2xl border p-3 text-left transition ${draft.timing_mode === 'offset' ? 'border-primary bg-primary/5' : 'border-border'} ${!shootBasedTriggers.has(draft.trigger_type) ? 'cursor-not-allowed opacity-60' : ''}`}
                        onClick={() =>
                          shootBasedTriggers.has(draft.trigger_type) &&
                          setDraft((current) => ({ ...current, timing_mode: 'offset' }))
                        }
                        disabled={!shootBasedTriggers.has(draft.trigger_type)}
                      >
                        <div className="font-medium">Wait from shoot time</div>
                        <div className="text-xs text-muted-foreground">Useful for reminders before or after the scheduled shoot.</div>
                      </button>
                    </div>
                  </div>
                  )}

                  {!isScheduleWorkflow && draft.timing_mode === 'offset' && (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <Label>Direction</Label>
                        <Select
                          value={draft.offset_direction}
                          onValueChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              offset_direction: value as SimpleAutomationDraft['offset_direction'],
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="before">Before shoot</SelectItem>
                            <SelectItem value="after">After shoot</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          min="1"
                          value={draft.offset_value}
                          onChange={(event) => setDraft((current) => ({ ...current, offset_value: event.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Unit</Label>
                        <Select
                          value={draft.offset_unit}
                          onValueChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              offset_unit: value as SimpleAutomationDraft['offset_unit'],
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="m">Minutes</SelectItem>
                            <SelectItem value="h">Hours</SelectItem>
                            <SelectItem value="d">Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {!isScheduleWorkflow && !shootBasedTriggers.has(draft.trigger_type) && (
                    <p className="text-xs text-amber-600">This trigger does not carry a shoot date/time, so only immediate delivery is supported.</p>
                  )}

                  <div className="flex items-center justify-between rounded-2xl border p-4">
                    <div>
                      <div className="font-medium">Add one condition</div>
                      <div className="text-sm text-muted-foreground">Filter this workflow before the action runs.</div>
                    </div>
                    <Switch
                      checked={draft.use_condition}
                      onCheckedChange={(checked) => setDraft((current) => ({ ...current, use_condition: checked }))}
                    />
                  </div>

                  {draft.use_condition && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label>Field</Label>
                        <Input
                          value={draft.condition_field}
                          onChange={(event) => setDraft((current) => ({ ...current, condition_field: event.target.value }))}
                          placeholder="status or days_before"
                        />
                      </div>
                      <div>
                        <Label>Operator</Label>
                        <Select
                          value={draft.condition_operator}
                          onValueChange={(value) => setDraft((current) => ({ ...current, condition_operator: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eq">Equals</SelectItem>
                            <SelectItem value="neq">Does not equal</SelectItem>
                            <SelectItem value="gt">Greater than</SelectItem>
                            <SelectItem value="gte">Greater than or equal</SelectItem>
                            <SelectItem value="lt">Less than</SelectItem>
                            <SelectItem value="lte">Less than or equal</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="exists">Exists</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Match rule</Label>
                        <Select
                          value={draft.condition_match}
                          onValueChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              condition_match: value as SimpleAutomationDraft['condition_match'],
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All rules must pass</SelectItem>
                            <SelectItem value="any">Any rule can pass</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {draft.condition_operator !== 'exists' && (
                        <div className="sm:col-span-2">
                          <Label>Value</Label>
                          <Input
                            value={draft.condition_value}
                            onChange={(event) => setDraft((current) => ({ ...current, condition_value: event.target.value }))}
                            placeholder="scheduled"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            After saving, the advanced workflow editor opens so you can inspect or expand the generated flow.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? 'Saving...'
                : isEditMode
                  ? 'Save and Open Workflow'
                  : automation
                    ? 'Duplicate and Open Workflow'
                    : 'Create and Open Workflow'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
