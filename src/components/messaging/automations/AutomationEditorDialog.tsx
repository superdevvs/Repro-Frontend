import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { createAutomation, updateAutomation, getTemplates, getEmailSettings } from '@/services/messaging';
import type { AutomationRule } from '@/types/messaging';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ScheduleMode = 'immediate' | 'offset';

interface AutomationEditorDialogProps {
  automation: AutomationRule | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const triggerGroups = [
  {
    label: 'Account',
    triggers: [
      { value: 'ACCOUNT_CREATED', label: 'Account Created' },
      { value: 'ACCOUNT_VERIFIED', label: 'Account Verified' },
      { value: 'PASSWORD_RESET', label: 'Password Reset' },
      { value: 'TERMS_ACCEPTED', label: 'Terms Accepted' },
    ],
  },
  {
    label: 'Shoot Lifecycle',
    triggers: [
      { value: 'SHOOT_REQUESTED', label: 'Shoot Requested' },
      { value: 'SHOOT_REQUEST_APPROVED', label: 'Shoot Request Approved' },
      { value: 'SHOOT_BOOKED', label: 'Shoot Booked' },
      { value: 'SHOOT_SCHEDULED', label: 'Shoot Scheduled' },
      { value: 'SHOOT_UPDATED', label: 'Shoot Updated' },
      { value: 'SHOOT_REMINDER', label: 'Shoot Reminder' },
      { value: 'SHOOT_COMPLETED', label: 'Shoot Completed' },
      { value: 'SHOOT_CANCELED', label: 'Shoot Canceled' },
      { value: 'SHOOT_REMOVED', label: 'Shoot Removed' },
    ],
  },
  {
    label: 'Payment',
    triggers: [
      { value: 'PAYMENT_COMPLETED', label: 'Payment Completed' },
      { value: 'PAYMENT_FAILED', label: 'Payment Failed' },
      { value: 'PAYMENT_REFUNDED', label: 'Payment Refunded' },
    ],
  },
  {
    label: 'Invoice',
    triggers: [
      { value: 'INVOICE_DUE', label: 'Invoice Due' },
      { value: 'INVOICE_OVERDUE', label: 'Invoice Overdue' },
      { value: 'INVOICE_SUMMARY', label: 'Invoice Summary' },
      { value: 'INVOICE_PAID', label: 'Invoice Paid' },
      { value: 'WEEKLY_PHOTOGRAPHER_INVOICE', label: 'Weekly Photographer Invoice' },
      { value: 'WEEKLY_REP_INVOICE', label: 'Weekly Rep Invoice' },
    ],
  },
  {
    label: 'Media & Workflow',
    triggers: [
      { value: 'PHOTO_UPLOADED', label: 'Photo Uploaded' },
      { value: 'MEDIA_UPLOAD_COMPLETE', label: 'Media Upload Complete' },
      { value: 'EDITING_COMPLETE', label: 'Editing Complete' },
    ],
  },
  {
    label: 'Assignment & Reports',
    triggers: [
      { value: 'PHOTOGRAPHER_ASSIGNED', label: 'Photographer Assigned' },
      { value: 'PROPERTY_CONTACT_REMINDER', label: 'Property Contact Reminder' },
    ],
  },
];

const recipients = [
  { value: 'client', label: 'Client' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'admin', label: 'Admin' },
  { value: 'rep', label: 'Rep' },
];

const shootBasedTriggers = new Set([
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

export function AutomationEditorDialog({ automation, open, onClose, onSuccess }: AutomationEditorDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'SHOOT_BOOKED',
    template_id: '',
    channel_id: '',
    recipients_json: ['client'] as string[],
    is_active: true,
    scope: 'GLOBAL',
  });
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('immediate');
  const [offsetDirection, setOffsetDirection] = useState<'before' | 'after'>('before');
  const [offsetValue, setOffsetValue] = useState('24');
  const [offsetUnit, setOffsetUnit] = useState<'h' | 'd' | 'm'>('h');

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ['templates', 'EMAIL'],
    queryFn: () => getTemplates({ channel: 'EMAIL', is_active: true }),
  });

  // Fetch channels
  const { data: settingsData } = useQuery({
    queryKey: ['email-settings'],
    queryFn: getEmailSettings,
  });

  const channels = settingsData?.channels || [];

  useEffect(() => {
    const parseOffset = (offset?: string) => {
      if (!offset) {
        setScheduleMode('immediate');
        setOffsetDirection('before');
        setOffsetValue('24');
        setOffsetUnit('h');
        return;
      }

      const matches = offset.match(/^([+-]?)(\d+)([hdm])$/);
      if (!matches) {
        setScheduleMode('immediate');
        return;
      }

      setScheduleMode('offset');
      setOffsetDirection(matches[1] === '-' ? 'before' : 'after');
      setOffsetValue(matches[2]);
      setOffsetUnit(matches[3] as 'h' | 'd' | 'm');
    };

    if (automation) {
      setFormData({
        name: automation.name,
        description: automation.description || '',
        trigger_type: automation.trigger_type,
        template_id: automation.template_id?.toString() || '',
        channel_id: automation.channel_id?.toString() || '',
        recipients_json: (Array.isArray(automation.recipients_json) ? automation.recipients_json : automation.recipients_json?.roles || ['client']) as string[],
        is_active: automation.is_active,
        scope: automation.scope,
      });
      parseOffset(automation.schedule_json?.offset);
    } else {
      setFormData({
        name: '',
        description: '',
        trigger_type: 'SHOOT_BOOKED',
        template_id: '',
        channel_id: '',
        recipients_json: ['client'],
        is_active: true,
        scope: 'GLOBAL',
      });
      parseOffset(undefined);
    }
  }, [automation]);

  useEffect(() => {
    if (scheduleMode !== 'offset') {
      return;
    }

    if (!shootBasedTriggers.has(formData.trigger_type)) {
      setScheduleMode('immediate');
    }
  }, [formData.trigger_type, scheduleMode]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (automation) {
        return updateAutomation(automation.id, data);
      } else {
        return createAutomation(data);
      }
    },
    onSuccess: () => {
      toast.success(automation ? 'Automation updated successfully' : 'Automation created successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save automation');
    },
  });

  const handleSave = () => {
    if (!formData.name || !formData.trigger_type) {
      toast.error('Name and trigger are required');
      return;
    }

    if (scheduleMode === 'offset' && !shootBasedTriggers.has(formData.trigger_type)) {
      toast.error('Delayed scheduling is only supported for shoot-based triggers');
      return;
    }

    const normalizedOffsetValue = offsetValue.trim();
    if (scheduleMode === 'offset' && (!normalizedOffsetValue || Number(normalizedOffsetValue) <= 0)) {
      toast.error('Enter a valid schedule delay');
      return;
    }

    const payload = {
      ...formData,
      template_id: formData.template_id ? parseInt(formData.template_id) : null,
      channel_id: formData.channel_id ? parseInt(formData.channel_id) : null,
      schedule_json: scheduleMode === 'offset'
        ? {
            offset: `${offsetDirection === 'before' ? '-' : '+'}${parseInt(normalizedOffsetValue, 10)}${offsetUnit}`,
          }
        : null,
    };

    saveMutation.mutate(payload);
  };

  const toggleRecipient = (recipient: string) => {
    const current = formData.recipients_json || [];
    if (current.includes(recipient)) {
      setFormData({
        ...formData,
        recipients_json: current.filter((r) => r !== recipient),
      });
    } else {
      setFormData({
        ...formData,
        recipients_json: [...current, recipient],
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{automation ? 'Edit Automation' : 'New Automation'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Automation name"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description"
              rows={2}
            />
          </div>

          <div>
            <Label>Trigger Event</Label>
            <Select value={formData.trigger_type} onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {triggerGroups.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.triggers.map((trigger) => (
                      <SelectItem key={trigger.value} value={trigger.value}>
                        {trigger.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border p-4 space-y-3">
            <div>
              <Label>Send Timing</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Custom automations are event-based. Weekly sales report and weekly invoicing run from the system automation section above, while custom rules can send immediately or after a delay from the shoot date/time.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`rounded-lg border p-3 text-left transition ${scheduleMode === 'immediate' ? 'border-primary bg-primary/5' : 'border-border'}`}
                onClick={() => setScheduleMode('immediate')}
              >
                <div className="font-medium">Send immediately</div>
                <div className="mt-1 text-xs text-muted-foreground">Deliver as soon as the trigger happens.</div>
              </button>
              <button
                type="button"
                className={`rounded-lg border p-3 text-left transition ${scheduleMode === 'offset' ? 'border-primary bg-primary/5' : 'border-border'} ${!shootBasedTriggers.has(formData.trigger_type) ? 'opacity-60' : ''}`}
                onClick={() => shootBasedTriggers.has(formData.trigger_type) && setScheduleMode('offset')}
                disabled={!shootBasedTriggers.has(formData.trigger_type)}
              >
                <div className="font-medium">Delay from shoot time</div>
                <div className="mt-1 text-xs text-muted-foreground">Useful for reminders before or after the scheduled shoot.</div>
              </button>
            </div>

            {scheduleMode === 'offset' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Direction</Label>
                  <Select value={offsetDirection} onValueChange={(value: 'before' | 'after') => setOffsetDirection(value)}>
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
                    value={offsetValue}
                    onChange={(e) => setOffsetValue(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select value={offsetUnit} onValueChange={(value: 'h' | 'd' | 'm') => setOffsetUnit(value)}>
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

            {!shootBasedTriggers.has(formData.trigger_type) && (
              <p className="text-xs text-amber-600">
                This trigger does not have a shoot date/time reference, so only immediate delivery is supported.
              </p>
            )}
          </div>

          <div>
            <Label>Email Template</Label>
            <Select value={formData.template_id} onValueChange={(value) => setFormData({ ...formData, template_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Email Channel (Optional)</Label>
            <Select value={formData.channel_id} onValueChange={(value) => setFormData({ ...formData, channel_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Use default" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id.toString()}>
                    {channel.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Recipients</Label>
            <div className="space-y-2 mt-2">
              {recipients.map((recipient) => (
                <div key={recipient.value} className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.recipients_json?.includes(recipient.value)}
                    onCheckedChange={() => toggleRecipient(recipient.value)}
                  />
                  <Label className="cursor-pointer">{recipient.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Automation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

