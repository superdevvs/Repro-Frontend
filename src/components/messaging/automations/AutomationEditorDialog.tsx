import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@/lib/sonner-toast';
import { Button } from '@/components/ui/button';
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
import type { AutomationRule, MessageChannelConfig } from '@/types/messaging';
import {
  buildSimpleConditionJson,
  buildSimpleWorkflowFromDraft,
  extractSimpleAutomationDraft,
  formatLegacyOffset,
  shootBasedTriggers,
  triggerGroups,
  triggerLabels,
  type SimpleAutomationDraft,
} from '@/components/messaging/automations/workflow-utils';

import type { AutomationEditorDialogProps, AutomationRecipientRole } from './automationEditorModel';
import {
  actionOptions,
  contextRecipientOptions,
  createDefaultDraft,
  getAutomationEditorErrorMessage,
  getFlowSteps,
  getInitialDraft,
  isAutomationRecipientRole,
  recipientRoleOptions,
  weekdayOptions,
} from './automationEditorModel';

const conditionFieldPresets = [
  ['shoot.status', 'Shoot status'],
  ['presence_option', 'Who is on site'],
  ['has_contact_details', 'Has contact details'],
  ['has_lockbox_details', 'Has lockbox details'],
  ['shoot_services', 'Services'],
  ['shoot_address', 'Address'],
  ['shoot_notes', 'Notes'],
  ['notify_client', 'Notify client'],
  ['notify_photographer', 'Notify photographer'],
  ['photographer_changed', 'Photographer changed'],
] as const;

const shootStatusValues = ['requested', 'scheduled', 'uploaded', 'editing', 'review', 'ready', 'delivered', 'on_hold', 'cancelled', 'declined'];
const presenceValues = ['self', 'other', 'lockbox'];

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

  const emailChannels: MessageChannelConfig[] = settingsData?.channels ?? [];
  const filteredTemplates = useMemo(
    () =>
      templates.filter((template) =>
        draft.action_type === 'sms' ? template.channel === 'SMS' : template.channel === 'EMAIL',
      ),
    [draft.action_type, templates],
  );

  const selectedTemplate = filteredTemplates.find((template) => String(template.id) === draft.template_id);
  const flowSteps = getFlowSteps(draft);
  const conditionPreset = conditionFieldPresets.find(([value]) => value === draft.condition_field);
  const conditionChoices = draft.condition_field === 'shoot.status'
    ? shootStatusValues
    : draft.condition_field === 'presence_option'
      ? presenceValues
      : null;
  const recipientLine = isSystemCommandWorkflow
    ? 'the system'
    : draft.recipient_mode === 'automation_default'
      ? 'the default recipients'
      : draft.recipient_mode === 'context'
        ? contextRecipientOptions.find((option) => option.value === draft.context_key)?.label ?? 'a contact from the trigger'
        : draft.recipient_roles.map((role) => recipientRoleOptions.find((option) => option.value === role)?.label ?? role).join(', ') || 'someone';
  const liveSentence = `When ${triggerLabels[draft.trigger_type] || draft.trigger_type}, ${actionOptions.find((option) => option.value === draft.action_type)?.label.toLowerCase() ?? 'send'} to ${recipientLine}.`;

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
    onError: (error: unknown) => {
      toast.error(getAutomationEditorErrorMessage(error, 'Failed to save automation'));
    },
  });

  const toggleRecipient = (role: AutomationRecipientRole) => {
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
    const selectedRoles: AutomationRecipientRole[] =
      draft.recipient_mode === 'roles'
        ? draft.recipient_roles.filter(isAutomationRecipientRole)
        : draft.recipient_mode === 'context'
          ? [draft.context_key]
          : draft.recipient_roles.filter(isAutomationRecipientRole);

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
      recipients_json: selectedRoles,
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
      <DialogContent className="flex max-h-[min(92vh,860px)] w-[min(96vw,760px)] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>
            {isEditMode ? 'Change automation' : automation ? 'Duplicate automation' : 'New automation'}
          </DialogTitle>
          <DialogDescription>{liveSentence}</DialogDescription>
          <p className="text-xs text-muted-foreground">{flowSteps.join(' → ')}</p>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {willSimplifyAdvancedWorkflow && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This automation was built in the workflow editor. Saving here replaces that path with this one-message version.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor="automation-when">When</Label>
              <Select
                value={draft.trigger_type}
                onValueChange={(value) => setDraft((current) => ({ ...current, trigger_type: value as AutomationRule['trigger_type'] }))}
                disabled={lockStructure}
              >
                <SelectTrigger id="automation-when">
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
            <div className="min-w-0">
              <Label htmlFor="automation-runs">Runs</Label>
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
                <SelectTrigger id="automation-runs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">When that happens</SelectItem>
                  <SelectItem value="schedule">Every week</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="automation-sends">Sends</Label>
              <Select
                value={draft.action_type}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    action_type: value as SimpleAutomationDraft['action_type'],
                    trigger_mode: value === 'system_command' ? 'schedule' : current.trigger_mode,
                    template_id: '',
                    channel_id: value === 'email' ? current.channel_id : '',
                    recipient_mode: value === 'internal_notification' ? 'roles' : current.recipient_mode,
                    recipient_roles:
                      value === 'internal_notification' && current.recipient_roles.length === 0
                        ? ['admin']
                        : current.recipient_roles,
                  }))
                }
                disabled={lockStructure}
              >
                <SelectTrigger id="automation-sends">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions
                    .filter((option) => option.value !== 'system_command' || isScheduleWorkflow || isSystemCommandWorkflow)
                    .map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="automation-name">Name</Label>
              <Input
                id="automation-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Property access follow-up"
              />
            </div>
          </div>

          {isScheduleWorkflow && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Day</Label>
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
                <Label htmlFor="automation-time">Time</Label>
                <Input
                  id="automation-time"
                  type="time"
                  value={draft.schedule_time}
                  onChange={(event) => setDraft((current) => ({ ...current, schedule_time: event.target.value }))}
                />
              </div>
            </div>
          )}

          {isSystemCommandWorkflow && (
            <div className="rounded-2xl border bg-muted/30 px-4 py-3 text-sm">
              <div className="font-medium">System command</div>
              <div className="mt-1 text-muted-foreground">{draft.system_command || 'No command configured'}</div>
            </div>
          )}

          {!isSystemCommandWorkflow && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Label>Who</Label>
                {draft.action_type !== 'internal_notification' && (
                  <div className="min-w-[16rem]">
                    <Select
                      value={draft.recipient_mode}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          recipient_mode: value as SimpleAutomationDraft['recipient_mode'],
                        }))
                      }
                    >
                      <SelectTrigger aria-label="Recipient source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="roles">Choose people here</SelectItem>
                        <SelectItem value="automation_default">Use the automation default</SelectItem>
                        <SelectItem value="context">Use a contact from the trigger</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {draft.recipient_mode === 'context' && draft.action_type !== 'internal_notification' ? (
                <Select
                  value={draft.context_key}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      context_key: value as SimpleAutomationDraft['context_key'],
                    }))
                  }
                >
                  <SelectTrigger aria-label="Context recipient">
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
              ) : (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Who">
                  {recipientRoleOptions.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      aria-pressed={draft.recipient_roles.includes(role.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${draft.recipient_roles.includes(role.value) ? 'border-primary bg-primary/10' : 'bg-background'}`}
                      onClick={() => toggleRecipient(role.value)}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {draft.action_type !== 'internal_notification' && draft.action_type !== 'system_command' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor="automation-message">Message</Label>
                <Select
                  value={draft.template_id || 'inline'}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      template_id: value === 'inline' ? '' : value,
                    }))
                  }
                >
                  <SelectTrigger id="automation-message">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inline">Write the message</SelectItem>
                    {filteredTemplates.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && <p className="mt-2 text-xs text-muted-foreground">Using {selectedTemplate.name}</p>}
              </div>
              {draft.action_type === 'email' && (
                <div className="min-w-0">
                  <Label>Sending channel</Label>
                  <Select
                    value={draft.channel_id || 'default'}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        channel_id: value === 'default' ? '' : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default channel</SelectItem>
                      {emailChannels.map((channel) => (
                        <SelectItem key={channel.id} value={String(channel.id)}>
                          {channel.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {!draft.template_id && draft.action_type === 'email' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="automation-subject">Subject</Label>
                <Input
                  id="automation-subject"
                  value={draft.subject}
                  onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Your shoot has been confirmed"
                />
              </div>
              <div>
                <Label htmlFor="automation-body">Message</Label>
                <Textarea
                  id="automation-body"
                  value={draft.body_text}
                  onChange={(event) => setDraft((current) => ({ ...current, body_text: event.target.value }))}
                  placeholder="Hi {{client.name}}, here is your update..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {!draft.template_id && draft.action_type === 'sms' && (
            <div>
              <Label htmlFor="automation-sms">Text</Label>
              <Textarea
                id="automation-sms"
                value={draft.body_text}
                onChange={(event) => setDraft((current) => ({ ...current, body_text: event.target.value }))}
                placeholder="Hi {{client.name}}, please send over the lockbox details."
                rows={4}
              />
            </div>
          )}

          {draft.action_type === 'internal_notification' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="automation-title">Notification title</Label>
                <Input
                  id="automation-title"
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Review missing access details"
                />
              </div>
              <div>
                <Label htmlFor="automation-note">Notification message</Label>
                <Textarea
                  id="automation-note"
                  value={draft.body_text}
                  onChange={(event) => setDraft((current) => ({ ...current, body_text: event.target.value }))}
                  placeholder="Property contact details are still missing for {{shoot_address}}."
                  rows={4}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="automation-link">Destination link</Label>
                  <Input
                    id="automation-link"
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
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="automation-description">Description</Label>
              <Textarea
                id="automation-description"
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Explain what this automation should do."
                rows={2}
              />
            </div>
            <div>
              <Label>Scope</Label>
              <Select
                value={draft.scope === 'SYSTEM' ? 'GLOBAL' : draft.scope}
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

          {!isScheduleWorkflow && (
            <div className="space-y-3">
              <Label>Wait</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={draft.timing_mode === 'immediate'}
                  className={`rounded-full border px-3 py-1.5 text-sm ${draft.timing_mode === 'immediate' ? 'border-primary bg-primary/10' : 'bg-background'}`}
                  onClick={() => setDraft((current) => ({ ...current, timing_mode: 'immediate' }))}
                >
                  Right away
                </button>
                <button
                  type="button"
                  aria-pressed={draft.timing_mode === 'offset'}
                  className={`rounded-full border px-3 py-1.5 text-sm ${draft.timing_mode === 'offset' ? 'border-primary bg-primary/10' : 'bg-background'} ${!shootBasedTriggers.has(draft.trigger_type) ? 'cursor-not-allowed opacity-60' : ''}`}
                  disabled={!shootBasedTriggers.has(draft.trigger_type)}
                  onClick={() =>
                    shootBasedTriggers.has(draft.trigger_type) &&
                    setDraft((current) => ({ ...current, timing_mode: 'offset' }))
                  }
                >
                  From the shoot time
                </button>
              </div>
              {!shootBasedTriggers.has(draft.trigger_type) && (
                <p className="text-xs text-amber-700">This trigger has no shoot time, so it sends right away.</p>
              )}
              {draft.timing_mode === 'offset' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select
                    value={draft.offset_direction}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        offset_direction: value as SimpleAutomationDraft['offset_direction'],
                      }))
                    }
                  >
                    <SelectTrigger aria-label="Direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Before the shoot</SelectItem>
                      <SelectItem value="after">After the shoot</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    aria-label="Amount"
                    value={draft.offset_value}
                    onChange={(event) => setDraft((current) => ({ ...current, offset_value: event.target.value }))}
                  />
                  <Select
                    value={draft.offset_unit}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        offset_unit: value as SimpleAutomationDraft['offset_unit'],
                      }))
                    }
                  >
                    <SelectTrigger aria-label="Unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m">Minutes</SelectItem>
                      <SelectItem value="h">Hours</SelectItem>
                      <SelectItem value="d">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 rounded-2xl border px-4 py-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={draft.use_condition}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, use_condition: checked }))}
                aria-label="Only send if"
              />
              <span className="text-sm font-medium">Only send if</span>
            </div>
            {draft.use_condition && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  value={conditionPreset ? draft.condition_field : 'custom'}
                  onValueChange={(value) =>
                    setDraft((current) => {
                      const choices = value === 'shoot.status' ? shootStatusValues : value === 'presence_option' ? presenceValues : null;
                      return {
                        ...current,
                        condition_field: value === 'custom'
                          ? (conditionFieldPresets.some(([preset]) => preset === current.condition_field) ? '' : current.condition_field)
                          : value,
                        condition_value: choices && current.condition_operator !== 'exists' && !choices.includes(current.condition_value)
                          ? choices[0]
                          : current.condition_value,
                      };
                    })
                  }
                >
                  <SelectTrigger aria-label="Field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionFieldPresets.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom field</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={draft.condition_operator}
                  onValueChange={(value) => setDraft((current) => ({ ...current, condition_operator: value }))}
                >
                  <SelectTrigger aria-label="Check">
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
                    <SelectItem value="in">Is one of</SelectItem>
                    <SelectItem value="exists">Exists</SelectItem>
                  </SelectContent>
                </Select>
                {!conditionPreset && (
                  <Input
                    aria-label="Field name"
                    value={draft.condition_field}
                    onChange={(event) => setDraft((current) => ({ ...current, condition_field: event.target.value }))}
                    placeholder="days_before"
                  />
                )}
                {draft.condition_operator !== 'exists' && (
                  conditionChoices ? (
                    <Select
                      value={conditionChoices.includes(draft.condition_value) ? draft.condition_value : conditionChoices[0]}
                      onValueChange={(value) => setDraft((current) => ({ ...current, condition_value: value }))}
                    >
                      <SelectTrigger aria-label="Value">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {conditionChoices.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      aria-label="Value"
                      value={draft.condition_value}
                      onChange={(event) => setDraft((current) => ({ ...current, condition_value: event.target.value }))}
                      placeholder={draft.condition_operator === 'in' ? 'scheduled, completed' : 'Value'}
                    />
                  )
                )}
                <Select
                  value={draft.condition_match}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      condition_match: value as SimpleAutomationDraft['condition_match'],
                    }))
                  }
                >
                  <SelectTrigger aria-label="Match rule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All rules must pass</SelectItem>
                    <SelectItem value="any">Any rule can pass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={draft.is_active}
              onCheckedChange={(checked) => setDraft((current) => ({ ...current, is_active: checked }))}
              aria-label="On when saved"
            />
            On when saved
          </label>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? 'Saving...'
                : isEditMode
                  ? 'Save and open workflow'
                  : automation
                    ? 'Duplicate and open workflow'
                    : 'Create and open workflow'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
