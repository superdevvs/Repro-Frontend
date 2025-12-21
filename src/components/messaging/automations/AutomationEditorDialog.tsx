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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AutomationEditorDialogProps {
  automation: AutomationRule | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const triggers = [
  { value: 'ACCOUNT_CREATED', label: 'Account Created' },
  { value: 'SHOOT_BOOKED', label: 'Shoot Booked' },
  { value: 'SHOOT_SCHEDULED', label: 'Shoot Scheduled' },
  { value: 'SHOOT_REMINDER', label: 'Shoot Reminder' },
  { value: 'SHOOT_COMPLETED', label: 'Shoot Completed' },
  { value: 'PAYMENT_COMPLETED', label: 'Payment Completed' },
  { value: 'PHOTO_UPLOADED', label: 'Photo Uploaded' },
];

const recipients = [
  { value: 'client', label: 'Client' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'admin', label: 'Admin' },
  { value: 'rep', label: 'Rep' },
];

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
    if (automation) {
      setFormData({
        name: automation.name,
        description: automation.description || '',
        trigger_type: automation.trigger_type,
        template_id: automation.template_id?.toString() || '',
        channel_id: automation.channel_id?.toString() || '',
        recipients_json: automation.recipients_json || ['client'],
        is_active: automation.is_active,
        scope: automation.scope,
      });
    }
  }, [automation]);

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

    const payload = {
      ...formData,
      template_id: formData.template_id ? parseInt(formData.template_id) : null,
      channel_id: formData.channel_id ? parseInt(formData.channel_id) : null,
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
                {triggers.map((trigger) => (
                  <SelectItem key={trigger.value} value={trigger.value}>
                    {trigger.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

