import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Send, Clock, Save, FileText } from 'lucide-react';
import { getEmailSettings, getTemplates, composeEmail, scheduleEmail } from '@/services/messaging';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function EmailCompose() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isClient = role === 'client';
  const [formData, setFormData] = useState({
    channel_id: '',
    to: '',
    subject: '',
    body_html: '',
    body_text: '',
    template_id: '',
  });
  const [scheduledAt, setScheduledAt] = useState('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  // Fetch channels
  const { data: settingsData } = useQuery({
    queryKey: ['email-settings'],
    queryFn: getEmailSettings,
  });

  // Fetch templates - only for non-clients
  const { data: templates } = useQuery({
    queryKey: ['templates', 'EMAIL'],
    queryFn: () => getTemplates({ channel: 'EMAIL', is_active: true }),
    enabled: !isClient,
  });

  const channels = settingsData?.channels || [];

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: composeEmail,
    onSuccess: () => {
      toast.success('Email sent successfully');
      navigate('/messaging/email/inbox');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send email');
    },
  });

  // Schedule email mutation
  const scheduleMutation = useMutation({
    mutationFn: scheduleEmail,
    onSuccess: () => {
      toast.success('Email scheduled successfully');
      navigate('/messaging/email/inbox');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to schedule email');
    },
  });

  const handleSendNow = () => {
    if (!formData.to) {
      toast.error('Recipient email is required');
      return;
    }

    if (!formData.body_html && !formData.body_text) {
      toast.error('Message body is required');
      return;
    }

    sendMutation.mutate({
      channel_id: formData.channel_id ? parseInt(formData.channel_id) : undefined,
      to: formData.to,
      subject: formData.subject,
      body_html: formData.body_html,
      body_text: formData.body_text,
      template_id: formData.template_id ? parseInt(formData.template_id) : undefined,
    });
  };

  const handleSchedule = () => {
    if (!formData.to || !scheduledAt) {
      toast.error('Recipient and schedule time are required');
      return;
    }

    scheduleMutation.mutate({
      channel_id: formData.channel_id ? parseInt(formData.channel_id) : undefined,
      to: formData.to,
      subject: formData.subject,
      body_html: formData.body_html,
      body_text: formData.body_text,
      scheduled_at: scheduledAt,
    });
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates?.find((t) => t.id === parseInt(templateId));
    if (template) {
      setFormData({
        ...formData,
        template_id: templateId,
        subject: template.subject || formData.subject,
        body_html: template.body_html || formData.body_html,
        body_text: template.body_text || formData.body_text,
      });
    }
  };

  return (
    <DashboardLayout>
      <EmailNavigation />
      <div className="container mx-auto py-6 max-w-5xl">
        <Card className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Compose Email</h1>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                {!isClient && (
                  <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Clock className="mr-2 h-4 w-4" />
                        Schedule
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Schedule Email</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Date & Time</Label>
                          <Input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={() => {
                            handleSchedule();
                            setShowScheduleDialog(false);
                          }}
                          disabled={scheduleMutation.isPending}
                          className="w-full"
                        >
                          Schedule Send
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                <Button onClick={handleSendNow} disabled={sendMutation.isPending}>
                  <Send className="mr-2 h-4 w-4" />
                  Send Now
                </Button>
              </div>
            </div>

            {/* From */}
            <div className="space-y-2">
              <Label>From</Label>
              <Select value={formData.channel_id} onValueChange={(value) => setFormData({ ...formData, channel_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select email account" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id.toString()}>
                      {channel.display_name} ({channel.from_email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* To */}
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="email"
                placeholder="recipient@example.com"
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              />
            </div>

            {/* Template - Only for non-clients */}
            {!isClient && (
              <div className="space-y-2">
                <Label>Template (Optional)</Label>
                <Select value={formData.template_id} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {template.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Subject */}
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                placeholder="Email subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Write your message here..."
                rows={12}
                value={formData.body_text}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    body_text: e.target.value,
                    body_html: `<p>${e.target.value.replace(/\n/g, '</p><p>')}</p>`,
                  });
                }}
              />
            </div>

            {/* Variables Helper - Only for non-clients */}
            {!isClient && formData.template_id && (
              <Card className="p-4 bg-muted">
                <h3 className="font-semibold mb-2">Available Variables</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Use these placeholders in your message:</p>
                  <code>{'{{client_name}}, {{shoot_date}}, {{shoot_time}}, {{shoot_address}}'}</code>
                </div>
              </Card>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

