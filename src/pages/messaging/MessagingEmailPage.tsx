import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/auth/AuthProvider';
import { getAuthToken } from '@/utils/authToken';
import {
  fetchEmailMessages,
  fetchMessagingTemplates,
  sendEmailMessage,
} from '@/services/messagingService';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type EmailMessage = {
  id: number;
  subject: string | null;
  to_address: string;
  status: string;
  created_at: string;
  body_text: string | null;
};

const MessagingEmailPage = () => {
  const { session } = useAuth();
  const token = getAuthToken(session?.accessToken);
  const { toast } = useToast();

  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>();

  const [formValues, setFormValues] = useState({
    to: '',
    subject: '',
    body_html: '',
    body_text: '',
  });

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [messagesResponse, templatesResponse] = await Promise.all([
        fetchEmailMessages<{ data: EmailMessage[] }>(token),
        fetchMessagingTemplates<any[]>(token, 'EMAIL'),
      ]);

      setMessages(messagesResponse.data ?? []);
      setTemplates(templatesResponse ?? []);
    } catch (err) {
      toast({
        title: 'Failed to load email workspace',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((tpl) => String(tpl.id) === templateId);
    if (template) {
      setFormValues((prev) => ({
        ...prev,
        subject: template.subject ?? '',
        body_html: template.body_html ?? '',
        body_text: template.body_text ?? '',
      }));
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const canSend = useMemo(
    () => formValues.to.trim().length > 0 && (!!formValues.body_html || !!formValues.body_text),
    [formValues],
  );

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;

    try {
      setSending(true);
      await sendEmailMessage(formValues, token);
      toast({ title: 'Email sent successfully' });
      setFormValues({
        to: '',
        subject: '',
        body_html: '',
        body_text: '',
      });
      setSelectedTemplate(undefined);
      await loadInitialData();
    } catch (err) {
      toast({
        title: 'Send failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Email workspace"
        description="Compose one-off emails, review history, and manage templates."
        actions={
          <Button size="sm" variant="outline" onClick={loadInitialData} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent emails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading emails…
              </div>
            )}
            {!loading && messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No messages yet. Send your first email using the composer.
              </p>
            )}
            {messages.map((message) => (
              <div key={message.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{message.subject || '(No subject)'}</p>
                <p className="text-xs text-muted-foreground">To {message.to_address}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(message.created_at).toLocaleString()} • {message.status}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Compose email</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSend}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">To</label>
                  <Input
                    type="email"
                    placeholder="client@example.com"
                    value={formValues.to}
                    onChange={(event) => handleChange('to', event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Template</label>
                  <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={String(template.id)}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <Input
                  placeholder="Subject"
                  value={formValues.subject}
                  onChange={(event) => handleChange('subject', event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Rich body (HTML)</label>
                <Textarea
                  placeholder="<p>Hi there...</p>"
                  value={formValues.body_html}
                  onChange={(event) => handleChange('body_html', event.target.value)}
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Plain text</label>
                <Textarea
                  placeholder="Hi there..."
                  value={formValues.body_text}
                  onChange={(event) => handleChange('body_text', event.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!canSend || sending}>
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send now
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedTemplate}
                  onClick={() =>
                    toast({
                      title: 'Template saved',
                      description: 'Use the Settings page for advanced template management.',
                    })
                  }
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Save as template
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MessagingEmailPage;





