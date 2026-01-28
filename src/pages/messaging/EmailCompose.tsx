import { useMemo, useState } from 'react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function EmailCompose() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const isClient = role === 'client';
  const isAdmin = role === 'admin' || role === 'superadmin';
  const canUseTemplates = isAdmin || role === 'salesRep';
  const composeLabel = isAdmin ? 'Compose Email' : 'Compose Message';
  const sendLabel = isAdmin ? 'Send Now' : 'Send Message';
  const inboxRecipientLabel = isAdmin ? 'To' : 'To (Admin Inbox)';
  const [formData, setFormData] = useState({
    channel_id: '',
    to: '',
    reply_to: '',
    subject: '',
    body_html: '',
    body_text: '',
    template_id: '',
    related_shoot_id: '',
    related_account_id: '',
    related_invoice_id: '',
    variables: '',
  });
  const [scheduledAt, setScheduledAt] = useState('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  const parsedVariables = useMemo(() => {
    if (!formData.variables) {
      return undefined;
    }

    try {
      return JSON.parse(formData.variables) as Record<string, any>;
    } catch (error) {
      return undefined;
    }
  }, [formData.variables]);

  // Fetch channels
  const { data: settingsData } = useQuery({
    queryKey: ['email-settings'],
    queryFn: getEmailSettings,
    enabled: isAdmin,
  });

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ['templates', 'EMAIL'],
    queryFn: () => getTemplates({ channel: 'EMAIL', is_active: true }),
    enabled: canUseTemplates,
  });

  const channels = isAdmin ? settingsData?.channels || [] : [];

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: composeEmail,
    onSuccess: () => {
      toast.success(isAdmin ? 'Email sent successfully' : 'Message sent to admin inbox');
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
    if (isAdmin && !formData.to) {
      toast.error('Recipient email is required');
      return;
    }

    if (!formData.body_html && !formData.body_text && !formData.template_id) {
      toast.error('Message body is required');
      return;
    }

    sendMutation.mutate({
      channel_id: isAdmin && formData.channel_id ? parseInt(formData.channel_id) : undefined,
      to: isAdmin ? formData.to : undefined,
      subject: formData.subject,
      body_html: formData.body_html,
      body_text: formData.body_text,
      reply_to: isAdmin ? formData.reply_to || undefined : undefined,
      template_id: formData.template_id ? parseInt(formData.template_id) : undefined,
      related_shoot_id: formData.related_shoot_id ? parseInt(formData.related_shoot_id) : undefined,
      related_account_id: formData.related_account_id ? parseInt(formData.related_account_id) : undefined,
      related_invoice_id: formData.related_invoice_id ? parseInt(formData.related_invoice_id) : undefined,
      variables: parsedVariables,
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
      reply_to: formData.reply_to || undefined,
      template_id: formData.template_id ? parseInt(formData.template_id) : undefined,
      related_shoot_id: formData.related_shoot_id ? parseInt(formData.related_shoot_id) : undefined,
      related_account_id: formData.related_account_id ? parseInt(formData.related_account_id) : undefined,
      related_invoice_id: formData.related_invoice_id ? parseInt(formData.related_invoice_id) : undefined,
      variables: parsedVariables,
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
              <h1 className="text-2xl font-bold">{composeLabel}</h1>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                {isAdmin && (
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
                  {sendLabel}
                </Button>
              </div>
            </div>

            {!isAdmin && (
              <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                Messages from non-admin dashboards are internal only. They appear in the admin inbox and do not send
                external emails.
              </div>
            )}

            {/* From */}
            <div className="space-y-2">
              <Label>From</Label>
              {isAdmin ? (
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
              ) : (
                <div className="rounded-md border px-3 py-2 text-sm">
                  {user?.name ? `${user.name} <${user.email}>` : user?.email}
                </div>
              )}
            </div>

            {/* To */}
            <div className="space-y-2">
              <Label>{inboxRecipientLabel}</Label>
              {isAdmin ? (
                <Input
                  type="email"
                  placeholder="recipient@example.com"
                  value={formData.to}
                  onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                />
              ) : (
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  Admin Inbox (contact@reprophotos.com)
                </div>
              )}
            </div>

            {/* Template - Only for non-clients */}
            {canUseTemplates && (
              <div className="space-y-4">
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

                <Accordion type="single" collapsible className="rounded-md border">
                  <AccordionItem value="advanced" className="border-none">
                    <AccordionTrigger className="px-4 text-sm">Advanced template context</AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        {isAdmin && (
                          <div className="space-y-2">
                            <Label>Reply-to (Optional)</Label>
                            <Input
                              type="email"
                              placeholder="reply@example.com"
                              value={formData.reply_to}
                              onChange={(e) => setFormData({ ...formData, reply_to: e.target.value })}
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Related Shoot ID</Label>
                          <Input
                            placeholder="123"
                            value={formData.related_shoot_id}
                            onChange={(e) => setFormData({ ...formData, related_shoot_id: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Related Account ID</Label>
                          <Input
                            placeholder="456"
                            value={formData.related_account_id}
                            onChange={(e) => setFormData({ ...formData, related_account_id: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Related Invoice ID</Label>
                          <Input
                            placeholder="789"
                            value={formData.related_invoice_id}
                            onChange={(e) => setFormData({ ...formData, related_invoice_id: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <Label>Variables (JSON)</Label>
                        <Textarea
                          placeholder='{"client_first_name": "Ava", "shoot_date": "Feb 2"}'
                          rows={4}
                          value={formData.variables}
                          onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                        />
                        {formData.variables && !parsedVariables && (
                          <p className="text-xs text-destructive">Invalid JSON. Variables will be ignored.</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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
            {canUseTemplates && formData.template_id && (
              <Card className="p-4 bg-muted">
                <h3 className="font-semibold mb-2">Available Variables</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Use these placeholders in your message:</p>
                  <code>
                    {'{{client_first_name}}, {{client_last_name}}, {{shoot_date}}, {{shoot_time}}, {{shoot_address}}'}
                  </code>
                </div>
              </Card>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

